import type { Schema, SchemaType, Output } from "./type";
import {
  getJsonPointer,
  jsonPointerEscape,
  jsonPointerJoin,
  setJsonPointer,
  removeJsonPointer,
  deepEqual,
  parseJsonPointer,
  safeRegexTest,
} from "./util";
import { resolveEffectiveSchema } from "./effective";
import { dereferenceSchemaDeep, getSubSchema } from "./schema-util";
import { getDefaultValue } from "./default";
import { normalizeSchema } from "./normalize";
import type { Validator } from "./validate";
import { collectDependencies } from "./dependency";

/**
 * Represents a node in the schema tree.
 * Each node corresponds to a location in both the schema and the instance data.
 */
export interface FieldNode {
  type: SchemaType;
  schema: Schema; // effective schema
  originalSchema: Schema;
  error?: Output;
  children?: FieldNode[];
  instanceLocation: string;
  keywordLocation: string;
  version: number;
  // Absolute paths this node's effective schema depends on
  dependencies?: Set<string>;

  // Whether this node can be removed (array items, additionalProperties, patternProperties)
  canRemove: boolean;
  // Whether this node can have children added (arrays with items, objects with additionalProperties)
  canAdd: boolean;
}

/** The canonical representation for root path */
const ROOT_PATH = "";

/**
 * Normalize path to use consistent root representation.
 * Converts "#" to "" (empty string) for internal consistency.
 */
function normalizeRootPath(path: string): string {
  return path === "#" ? ROOT_PATH : path;
}

export type SchemaChangeEvent = {
  type: "schema" | "value" | "error";
  path: string;
};

export class SchemaRuntime {
  private validator: Validator;

  private watchers: Record<string, Set<(e: SchemaChangeEvent) => void>> = {};
  private globalWatchers: Set<(e: SchemaChangeEvent) => void> = new Set();

  // Reverse dependency index: path -> nodes that depend on this path's value
  private dependentsMap: Map<string, Set<FieldNode>> = new Map();

  // Track nodes currently being updated to prevent circular updates
  private updatingNodes: Set<string> = new Set();

  public root: FieldNode;
  private value: unknown;
  private version: number = 0;
  private rootSchema: Schema = {};

  /**
   * Create a new SchemaRuntime instance.
   *
   * @param validator - The validator instance for schema validation
   * @param schema - The JSON Schema definition (will be normalized and dereferenced)
   * @param value - The initial data value to manage
   *
   * @example
   * const validator = new Validator();
   * const schema = { type: "object", properties: { name: { type: "string" } } };
   * const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });
   */
  constructor(validator: Validator, schema: Schema | unknown, value: unknown) {
    this.validator = validator;
    this.value = value;

    const normalized = normalizeSchema(schema);

    this.rootSchema = dereferenceSchemaDeep(normalized, normalized);
    this.root = this.createEmptyNode("", "#");
    this.buildNode(this.root, this.rootSchema);
    this.notify({ type: "schema", path: ROOT_PATH });
  }

  /**
   * Register a node as dependent on a path
   */
  private registerDependent(path: string, node: FieldNode): void {
    let dependents = this.dependentsMap.get(path);
    if (!dependents) {
      dependents = new Set();
      this.dependentsMap.set(path, dependents);
    }
    dependents.add(node);
  }

  /**
   * Unregister a node from a dependency path
   */
  private unregisterDependent(path: string, node: FieldNode): void {
    const dependents = this.dependentsMap.get(path);
    if (dependents) {
      dependents.delete(node);
      if (dependents.size === 0) {
        this.dependentsMap.delete(path);
      }
    }
  }

  /**
   * Unregister all dependencies for a node and its children.
   * Note: Does NOT clean up external watchers - callers are responsible
   * for calling unsubscribe() when they no longer need updates.
   */
  private unregisterNodeDependencies(node: FieldNode): void {
    // Unregister this node's dependencies
    if (node.dependencies) {
      for (const depPath of node.dependencies) {
        this.unregisterDependent(depPath, node);
      }
    }

    // Recursively unregister children's dependencies
    if (node.children) {
      for (const child of node.children) {
        this.unregisterNodeDependencies(child);
      }
    }
  }

  /**
   * Create an empty FieldNode with default values.
   */
  private createEmptyNode(
    instanceLocation: string,
    keywordLocation: string,
  ): FieldNode {
    return {
      type: "null",
      schema: {},
      version: -1,
      instanceLocation,
      keywordLocation,
      originalSchema: {},
      canRemove: false,
      canAdd: false,
      children: [],
    };
  }

  /**
   * Reconcile the tree starting from the specified path.
   * Uses findNearestExistingNode to find the target node (or parent if path doesn't exist).
   * Only rebuilds the affected subtree, not the entire tree.
   */
  private reconcile(path: string): void {
    const normalizedPath = normalizeRootPath(path);

    // Find target node (or nearest parent)
    const targetNode = this.findNearestExistingNode(normalizedPath);
    if (!targetNode) {
      return;
    }

    // Build node from target path
    this.buildNode(targetNode, targetNode.originalSchema);
  }

  /**
   * Get the current version number.
   * The version increments on every notify call (value, schema, or error changes).
   * Useful for detecting if the runtime state has changed.
   *
   * @returns The current version number
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Subscribe to changes at a specific path.
   * The callback is invoked when the value, schema, or error at the path changes.
   *
   * @param path - The JSON Pointer path to watch (e.g., "/user/name", "" for root)
   * @param cb - Callback function invoked with the change event
   * @returns Unsubscribe function to remove the listener
   *
   * @example
   * const unsubscribe = runtime.subscribe("/name", (event) => {
   *   console.log(`${event.type} changed at ${event.path}`);
   * });
   * // Later: unsubscribe();
   */
  subscribe(path: string, cb: (e: SchemaChangeEvent) => void): () => void {
    const normalizedPath = normalizeRootPath(path);
    if (!this.watchers[normalizedPath]) {
      this.watchers[normalizedPath] = new Set();
    }
    this.watchers[normalizedPath].add(cb);
    return () => {
      const watcherSet = this.watchers[normalizedPath];
      if (watcherSet) {
        watcherSet.delete(cb);
        // Clean up empty watcher sets to prevent memory leaks
        if (watcherSet.size === 0) {
          delete this.watchers[normalizedPath];
        }
      }
    };
  }

  /**
   * Subscribe to all events in the runtime.
   * The callback is invoked for any change at any path.
   *
   * @param cb - Callback function invoked with every change event
   * @returns Unsubscribe function to remove the listener
   */
  subscribeAll(cb: (e: SchemaChangeEvent) => void): () => void {
    this.globalWatchers.add(cb);
    return () => {
      this.globalWatchers.delete(cb);
    };
  }

  /**
   * Emit a change event to all relevant subscribers.
   * Increments the version number and notifies both path-specific and global watchers.
   *
   * @param event - The change event containing type and path
   */
  notify(event: SchemaChangeEvent) {
    this.version++;

    const normalizedPath = normalizeRootPath(event.path);
    const watchers = this.watchers[normalizedPath];
    if (watchers) {
      for (const cb of watchers) {
        try {
          cb(event);
        } catch (err) {
          console.error("SchemaRuntime: watcher callback error:", err);
        }
      }
    }

    // Call global watchers
    for (const cb of this.globalWatchers) {
      try {
        cb(event);
      } catch (err) {
        console.error("SchemaRuntime: global watcher callback error:", err);
      }
    }
  }

  /**
   * Update the entire schema.
   * This triggers a full rebuild of the node tree while preserving the current value.
   */
  setSchema(schema: Schema | unknown): void {
    const normalized = normalizeSchema(schema);
    this.rootSchema = dereferenceSchemaDeep(normalized, normalized);
    // Reinitialize root node with new schema
    this.root = this.createEmptyNode("", "#");
    this.buildNode(this.root, this.rootSchema);
    this.notify({ type: "schema", path: ROOT_PATH });
  }

  /**
   * Get the value at a specific path.
   *
   * @param path - The JSON Pointer path (e.g., "/user/name", "" for root)
   * @returns The value at the path, or undefined if not found
   *
   * @example
   * runtime.getValue(""); // returns entire root value
   * runtime.getValue("/name"); // returns value at /name
   */
  getValue(path: string): unknown {
    const normalizedPath = normalizeRootPath(path);
    if (normalizedPath === ROOT_PATH) return this.value;
    return getJsonPointer(this.value, normalizedPath);
  }

  /**
   * Remove a node at the specified path.
   * This deletes the value from the data structure (array splice or object delete).
   * @param path - The path to remove
   * @returns true if successful, false if the path cannot be removed
   */
  removeValue(path: string): boolean {
    const normalizedPath = normalizeRootPath(path);
    if (normalizedPath === ROOT_PATH) {
      // Cannot remove root
      return false;
    }

    // Check if the node exists and can be removed
    const node = this.findNode(normalizedPath);
    if (!node || !node.canRemove) {
      return false;
    }

    // Remove the value
    const success = removeJsonPointer(this.value, normalizedPath);
    if (!success) {
      return false;
    }

    // Find parent path for reconciliation
    const lastSlash = normalizedPath.lastIndexOf("/");
    const parentPath =
      lastSlash <= 0 ? ROOT_PATH : normalizedPath.substring(0, lastSlash);

    // Reconcile from parent to rebuild children
    this.reconcile(parentPath);
    this.notify({ type: "value", path: parentPath });
    return true;
  }

  /**
   * Add a new child to an array or object at the specified parent path.
   * For arrays, appends a new item with default value based on items schema.
   * For objects, adds a new property with the given key and default value based on additionalProperties schema.
   * @param parentPath - The path to the parent array or object
   * @param key - For objects: the property key. For arrays: optional, ignored (appends to end)
   * @param initialValue - Optional initial value to set. If not provided, uses default from schema.
   * @returns true if successful, false if cannot add
   */
  addValue(parentPath: string, key?: string, initialValue?: unknown): boolean {
    const normalizedPath = normalizeRootPath(parentPath);
    const parentNode = this.findNode(normalizedPath);

    if (!parentNode || !parentNode.canAdd) {
      return false;
    }

    const parentValue = this.getValue(normalizedPath);
    const parentSchema = parentNode.schema;

    if (parentNode.type === "array" && Array.isArray(parentValue)) {
      // Add new item to array
      const newIndex = parentValue.length;
      const { schema: subschema, keywordLocationToken } = getSubSchema(
        parentSchema,
        String(newIndex),
      );
      // cannot add if no schema found
      if (!keywordLocationToken) {
        return false;
      }
      const defaultValue =
        initialValue !== undefined ? initialValue : getDefaultValue(subschema);
      const itemPath = jsonPointerJoin(normalizedPath, String(newIndex));
      const success = setJsonPointer(this.value, itemPath, defaultValue);
      if (!success) return false;

      // Reconcile from parent to rebuild children
      this.reconcile(normalizedPath);
      this.notify({ type: "value", path: normalizedPath });
      return true;
    } else if (
      parentNode.type === "object" &&
      parentValue &&
      typeof parentValue === "object"
    ) {
      // Add new property to object
      if (!key) {
        return false;
      }
      const { schema: subschema, keywordLocationToken } = getSubSchema(
        parentSchema,
        key,
      );
      // cannot add if no schema found
      if (!keywordLocationToken) {
        return false;
      }
      const defaultValue =
        initialValue !== undefined ? initialValue : getDefaultValue(subschema);
      const propertyPath = jsonPointerJoin(normalizedPath, key);
      const success = setJsonPointer(this.value, propertyPath, defaultValue);
      if (!success) return false;

      // Reconcile from parent to rebuild children
      this.reconcile(normalizedPath);
      this.notify({ type: "value", path: normalizedPath });
      return true;
    }

    return false;
  }

  /**
   * Set the value at a specific path.
   * Creates intermediate containers (objects/arrays) as needed.
   * Triggers reconciliation and notifies subscribers.
   *
   * @param path - The JSON Pointer path (e.g., "/user/name", "" for root)
   * @param value - The new value to set
   * @returns true if successful, false if the path cannot be set
   *
   * @example
   * runtime.setValue("/name", "Bob"); // set name to "Bob"
   * runtime.setValue("", { name: "Alice" }); // replace entire root value
   */
  setValue(path: string, value: unknown): boolean {
    const normalizedPath = normalizeRootPath(path);

    // Update value
    if (normalizedPath === ROOT_PATH) {
      this.value = value;
    } else {
      const success = setJsonPointer(this.value, normalizedPath, value);
      if (!success) return false;
    }

    // Reconcile and notify
    this.reconcile(normalizedPath);
    this.notify({ type: "value", path: normalizedPath });
    return true;
  }

  /**
   * Find the FieldNode at a specific path.
   * Returns the node tree representation that includes schema, type, error, and children.
   *
   * @param path - The JSON Pointer path (e.g., "/user/name", "" for root)
   * @returns The FieldNode at the path, or undefined if not found
   *
   * @example
   * const node = runtime.findNode("/name");
   * console.log(node?.schema, node?.type, node?.error);
   */
  findNode(path: string): FieldNode | undefined {
    const normalizedPath = normalizeRootPath(path);
    // Handle root node queries
    if (normalizedPath === ROOT_PATH) return this.root;

    const segments = parseJsonPointer(normalizedPath);

    let current: FieldNode | undefined = this.root;
    for (const segment of segments) {
      if (!current?.children) return undefined;

      // Build the expected exact path for this child
      const expectedPath = jsonPointerJoin(current.instanceLocation, segment);
      const found: FieldNode | undefined = current.children?.find(
        (child) => child.instanceLocation === expectedPath,
      );

      if (!found) return undefined;
      current = found;
    }

    return current;
  }

  private findNearestExistingNode(path: string): FieldNode | undefined {
    const normalizedPath = normalizeRootPath(path);
    let currentPath = normalizedPath;

    while (currentPath !== ROOT_PATH) {
      const node = this.findNode(currentPath);
      if (node) return node;

      const lastSlash = currentPath.lastIndexOf("/");
      currentPath =
        lastSlash <= 0 ? ROOT_PATH : currentPath.substring(0, lastSlash);
    }

    return this.root;
  }

  /**
   * Update node dependencies when schema changes.
   * Unregisters old dependencies and registers new ones.
   */
  private updateNodeDependencies(node: FieldNode, schema: Schema): void {
    const { instanceLocation } = node;

    node.originalSchema = schema;
    const dependencies = collectDependencies(schema, instanceLocation);

    // Unregister old dependencies
    for (const depPath of node.dependencies || []) {
      this.unregisterDependent(depPath, node);
    }

    node.dependencies = dependencies;

    // Register new dependencies
    for (const depPath of dependencies) {
      this.registerDependent(depPath, node);
    }
  }

  /**
   * Apply default values when effective schema changes.
   * This handles cases like if-then-else where new properties with defaults
   * may appear when conditions change.
   *
   * @param instanceLocation - The path to the node
   * @param newSchema - The new effective schema
   * @param type - The schema type
   */
  private applySchemaDefaults(
    instanceLocation: string,
    newSchema: Schema,
    type: SchemaType,
  ): void {
    const value = this.getValue(instanceLocation);

    if (type === "object" && newSchema.properties) {
      const obj =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : null;
      if (!obj) return;

      for (const [key, subschema] of Object.entries(newSchema.properties)) {
        // Fill defaults for properties that don't have a value yet
        // This applies when switching branches (if-then-else) where
        // the new branch may have different defaults
        const hasValue = obj[key] !== undefined;

        if (!hasValue) {
          const defaultValue = getDefaultValue(subschema);
          if (defaultValue !== undefined) {
            const propertyPath = jsonPointerJoin(instanceLocation, key);
            setJsonPointer(this.value, propertyPath, defaultValue);
          }
        }
      }

      return;
    }

    if (type === "array" && newSchema.prefixItems) {
      const arr = Array.isArray(value) ? value : null;
      if (!arr) return;

      // Fill defaults for prefixItems positions that don't have values
      for (let i = 0; i < newSchema.prefixItems.length; i++) {
        if (arr[i] === undefined) {
          const defaultValue = getDefaultValue(newSchema.prefixItems[i]);
          if (defaultValue !== undefined) {
            const itemPath = jsonPointerJoin(instanceLocation, String(i));
            setJsonPointer(this.value, itemPath, defaultValue);
          }
        }
      }
    }
  }

  /**
   * Build children for object and array nodes.
   * Reuses existing child nodes where possible.
   */
  private buildNodeChildren(
    node: FieldNode,
    value: unknown,
    options: {
      updatedNodes?: Set<string>;
    },
  ): void {
    const { keywordLocation, instanceLocation } = node;
    const effectiveSchema = node.schema;
    const type = node.type;

    // Build children map for reuse
    const oldChildrenMap = new Map<string, FieldNode>();
    if (node.children) {
      for (const child of node.children) {
        oldChildrenMap.set(child.instanceLocation, child);
      }
    }

    const newChildren: FieldNode[] = [];

    const processChild = (
      childKey: string,
      childSchema: Schema,
      childkeywordLocation: string,
      canRemove: boolean = false,
    ) => {
      const childinstanceLocation = jsonPointerJoin(instanceLocation, childKey);

      // Reuse or create child node
      let childNode = oldChildrenMap.get(childinstanceLocation);
      if (childNode) {
        oldChildrenMap.delete(childinstanceLocation);
        childNode.keywordLocation = childkeywordLocation;
      } else {
        childNode = this.createEmptyNode(
          childinstanceLocation,
          childkeywordLocation,
        );
      }

      childNode.canRemove = canRemove;
      this.buildNode(childNode, childSchema, options);
      newChildren.push(childNode);
    };

    switch (type) {
      case "object": {
        const valueKeys =
          value && typeof value === "object" ? Object.keys(value) : [];
        const processedKeys = new Set<string>();

        // Set canAdd based on additionalProperties
        node.canAdd = !!effectiveSchema.additionalProperties;

        // Process properties (cannot be removed)
        if (effectiveSchema.properties) {
          for (const [key, subschema] of Object.entries(
            effectiveSchema.properties,
          )) {
            processedKeys.add(key);
            processChild(
              key,
              subschema,
              `${keywordLocation}/properties/${key}`,
              false,
            );
          }
        }

        // Process patternProperties (can be removed)
        if (effectiveSchema.patternProperties) {
          for (const [pattern, subschema] of Object.entries(
            effectiveSchema.patternProperties,
          )) {
            for (const key of valueKeys) {
              if (safeRegexTest(pattern, key) && !processedKeys.has(key)) {
                processedKeys.add(key);
                processChild(
                  key,
                  subschema,
                  `${keywordLocation}/patternProperties/${jsonPointerEscape(pattern)}`,
                  true,
                );
              }
            }
          }
        }

        // Process additionalProperties (can be removed)
        if (effectiveSchema.additionalProperties) {
          const subschema =
            typeof effectiveSchema.additionalProperties === "object"
              ? effectiveSchema.additionalProperties
              : {};

          for (const key of valueKeys) {
            if (!processedKeys.has(key)) {
              processChild(
                key,
                subschema,
                `${keywordLocation}/additionalProperties`,
                true,
              );
            }
          }
        }
        break;
      }
      case "array": {
        // Set canAdd based on items schema
        node.canAdd = !!effectiveSchema.items;

        if (Array.isArray(value)) {
          let prefixItemsLength = 0;

          // Process prefixItems (cannot be removed)
          if (effectiveSchema.prefixItems) {
            prefixItemsLength = effectiveSchema.prefixItems.length;
            for (
              let i = 0;
              i < Math.min(value.length, prefixItemsLength);
              i++
            ) {
              processChild(
                String(i),
                effectiveSchema.prefixItems[i],
                `${keywordLocation}/prefixItems/${i}`,
                false,
              );
            }
          }

          // Process items (can be removed)
          if (effectiveSchema.items && value.length > prefixItemsLength) {
            for (let i = prefixItemsLength; i < value.length; i++) {
              processChild(
                String(i),
                effectiveSchema.items,
                `${keywordLocation}/items`,
                true,
              );
            }
          }
        }
        break;
      }
    }

    // Cleanup removed children
    for (const oldChild of oldChildrenMap.values()) {
      this.unregisterNodeDependencies(oldChild);
    }

    node.children = newChildren;
  }

  /**
   * Build/update a FieldNode in place.
   * Updates the node's schema, type, error, and children based on the current value.
   * @param schema - Optional. If provided, updates node.originalSchema. Otherwise uses existing.
   */
  private buildNode(
    node: FieldNode,
    schema?: Schema,
    options: {
      updatedNodes?: Set<string>;
    } = {},
  ): void {
    const { keywordLocation, instanceLocation } = node;
    const value = this.getValue(instanceLocation);

    // Circular update protection
    if (this.updatingNodes.has(instanceLocation)) {
      return;
    }

    // Track updated nodes to prevent duplicate updates
    const updatedNodes = options.updatedNodes || new Set<string>();
    if (updatedNodes.has(instanceLocation)) {
      return;
    }

    this.updatingNodes.add(instanceLocation);

    try {
      // Update dependencies if schema changed
      const schemaChanged =
        schema !== undefined && !deepEqual(schema, node.originalSchema);
      if (schemaChanged) {
        this.updateNodeDependencies(node, schema);
      }

      // Resolve effective schema based on current value
      const { type, effectiveSchema, error } = resolveEffectiveSchema(
        this.validator,
        node.originalSchema,
        value,
        keywordLocation,
        instanceLocation,
      );

      // Detect changes for notifications
      const effectiveSchemaChanged =
        !deepEqual(effectiveSchema, node.schema) || type !== node.type;
      const errorChanged = !deepEqual(error, node.error);

      // Apply defaults when effective schema changes (e.g., if-then-else branch switch)
      // Child nodes will be built after and will send their own notifications
      if (effectiveSchemaChanged) {
        this.applySchemaDefaults(instanceLocation, effectiveSchema, type);
      }

      // Update node state
      node.schema = effectiveSchema;
      node.type = type;
      node.error = error;
      node.version++;

      // Build children - pass updatedNodes to ensure proper tracking
      // Re-fetch value in case defaults were applied
      const currentValue = this.getValue(instanceLocation);
      this.buildNodeChildren(node, currentValue, { ...options, updatedNodes });

      // Send notifications for this node only
      // Child nodes handle their own notifications in buildNodeChildren -> buildNode
      if (effectiveSchemaChanged) {
        this.notify({ type: "schema", path: instanceLocation });
      }
      if (errorChanged) {
        this.notify({ type: "error", path: instanceLocation });
      }

      // Mark this node as updated
      updatedNodes.add(instanceLocation);

      // Propagate updates to dependent nodes
      const dependentNodes = this.dependentsMap.get(instanceLocation);
      if (dependentNodes) {
        for (const dependentNode of dependentNodes) {
          this.buildNode(dependentNode, undefined, {
            ...options,
            updatedNodes,
          });
        }
      }
    } finally {
      this.updatingNodes.delete(instanceLocation);
    }
  }
}
