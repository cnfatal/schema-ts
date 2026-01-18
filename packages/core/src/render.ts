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
  getJsonPointerParent,
} from "./util";
import { resolveEffectiveSchema } from "./effective";
import { dereferenceSchemaDeep, getSubSchema } from "./schema-util";
import { applyDefaults, getDefaultValue } from "./default";
import { DraftNormalizer, Normalizer } from "./normalize";
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
  // Original keyword location tracking the source of this schema (e.g., from allOf, anyOf, if/then/else)
  originKeywordLocation?: string;
  version: number;
  // Absolute paths this node's effective schema depends on
  dependencies?: Set<string>;
  // Whether this node can be removed (array items, additionalProperties, patternProperties)
  canRemove: boolean;
  // Whether this node can have children added (arrays with items, objects with additionalProperties)
  canAdd: boolean;
  // Whether this node is required by its parent (listed in parent's required array)
  required: boolean;
  // Should validate this node
  activated: boolean;
}

export type SchemaChangeEvent = {
  type: "schema" | "value" | "error";
  path: string;
};

export interface SchemaRuntimeOptions {
  /**
   * Control how default values are applied when schema changes.
   * - 'always': Fill all type-based defaults (e.g., [] for array, "" for string)
   * - 'auto': Fill defaults by defaulting rules (required fields, const, default keyword etc.)
   * @default 'auto'
   */
  fillDefaults?: "auto" | "never";

  /**
   * Control behavior when removing the last element from an array or object.
   * - 'never': Always keep empty containers ([] or {})
   * - 'auto': Remove empty container only following rules.
   * @default 'auto'
   */
  removeEmptyContainers?: "never" | "auto";

  /**
   * Custom schema normalizer.
   * If specified, will use this normalizer instead of the default one.
   */
  schemaNormalizer?: Normalizer;
}

export class SchemaRuntime {
  private validator: Validator;

  private normalizer: Normalizer;

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
  private options: SchemaRuntimeOptions;

  /**
   * Create a new SchemaRuntime instance.
   *
   * @param validator - The validator instance for schema validation
   * @param schema - The JSON Schema definition (will be normalized and dereferenced)
   * @param value - The initial data value to manage
   * @param options - Runtime configuration options
   *
   * @example
   * const validator = new Validator();
   * const schema = { type: "object", properties: { name: { type: "string" } } };
   * const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });
   */
  constructor(
    validator: Validator,
    schema: Schema | unknown,
    value: unknown,
    options: SchemaRuntimeOptions = {},
  ) {
    this.validator = validator;
    this.options = {
      fillDefaults: "auto",
      removeEmptyContainers: "auto",
      ...options,
    };
    this.normalizer = options.schemaNormalizer || new DraftNormalizer();
    this.value = value;
    this.rootSchema = this.resolveSchema(schema);
    this.root = this.createEmptyNode("", "#");
    this.buildNode(this.root, this.rootSchema);
  }

  private resolveSchema(schema: Schema | unknown): Schema {
    const normalized = this.normalizer.normalize(schema);
    const dereferenced = dereferenceSchemaDeep(normalized, normalized);
    return dereferenced;
  }

  /**
   * Update the entire schema.
   * This triggers a full rebuild of the node tree while preserving the current value.
   */
  setSchema(schema: Schema | unknown): void {
    this.rootSchema = this.resolveSchema(schema);
    this.root = this.createEmptyNode("", "#");
    this.buildNode(this.root, this.rootSchema);
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
      schema: {}, // Placeholder, will be set in buildNode
      version: -1, // -1 indicates initial construction (not yet built)
      instanceLocation,
      keywordLocation,
      originalSchema: {},
      canRemove: false,
      canAdd: false,
      required: false,
      children: [],
      activated: false,
    };
  }

  /**
   * Reconcile the tree starting from the specified path.
   * Uses findNearestExistingNode to find the target node (or parent if path doesn't exist).
   * Only rebuilds the affected subtree, not the entire tree.
   */
  private reconcile(path: string): void {
    // Find target node (or nearest parent)
    const targetNode = this.findNearestExistingNode(path);
    if (!targetNode) {
      return;
    }
    // when setActivated is true, mark node as activated
    // also activate if value is defined
    targetNode.activated = true;

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
    if (!this.watchers[path]) {
      this.watchers[path] = new Set();
    }
    this.watchers[path].add(cb);
    return () => {
      const watcherSet = this.watchers[path];
      if (watcherSet) {
        watcherSet.delete(cb);
        // Clean up empty watcher sets to prevent memory leaks
        if (watcherSet.size === 0) {
          delete this.watchers[path];
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

    const watchers = this.watchers[event.path];
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
    if (path === "" || path === "#") {
      return this.value;
    }
    return getJsonPointer(this.value, path);
  }

  /**
   * Internal helper to set a value at a normalized path.
   * Handles both root and non-root paths.
   *
   * @param path - The JSON Pointer path
   * @param value - The value to set
   * @returns true if successful, false if the path cannot be set
   */
  private setJsonPointer(path: string, value: unknown): boolean {
    if (path === "" || path === "#") {
      this.value = value;
      return true;
    }
    // Ensure root value is an object/array if setting non-root path
    if (!this.value) {
      this.value = {};
    }
    return setJsonPointer(this.value, path, value);
  }

  /**
   * Remove a node at the specified path.
   * This deletes the value from the data structure (array splice or object delete).
   * After removal, may also remove empty parent containers based on removeEmptyContainers option.
   * @param path - The path to remove
   * @returns true if successful, false if the path cannot be removed
   */
  removeValue(path: string): boolean {
    // Remove the value
    const success = removeJsonPointer(this.value, path);
    if (!success) {
      return false;
    }
    // Cleanup empty parent containers, returns the topmost parent path for reconciliation
    const reconcilePath = this.cleanupEmptyContainers(
      getJsonPointerParent(path),
    );
    // Reconcile from parent to rebuild children
    this.reconcile(reconcilePath);
    this.notify({ type: "value", path: reconcilePath });
    return true;
  }

  /**
   * Clean up empty parent containers after element removal.
   * Recursively removes empty arrays/objects based on removeEmptyContainers option.
   * @param path - The path to check for empty container
   * @returns The topmost parent path changed
   */
  private cleanupEmptyContainers(path: string): string {
    const strategy = this.options.removeEmptyContainers;
    if (strategy === "never") {
      return "";
    }
    const node = this.getNode(path);
    if (!node) {
      return path;
    }
    const value = this.getValue(path);
    const isEmpty =
      value === null ||
      (typeof value === "object" && Object.keys(value).length === 0);

    if (!isEmpty) {
      return path;
    }
    const shouldRemove = strategy === "auto" && !node.required;
    if (!shouldRemove) {
      return path;
    }
    const success = removeJsonPointer(this.value, path);
    if (!success) {
      return path;
    }
    return this.cleanupEmptyContainers(getJsonPointerParent(path));
  }

  /**
   * Get default value for a schema, respecting autoFillDefaults option.
   * Falls back to 'always' strategy if configured strategy returns undefined.
   * If still undefined (e.g., schema has no type), falls back to null as a valid JSON value.
   */
  private newDefaultValue(schema: Schema, required: boolean): unknown {
    const strategy = this.options.fillDefaults;
    if (strategy === "never") {
      return undefined;
    }
    return getDefaultValue(schema, required);
  }

  private addObjectProperty(
    parent: FieldNode,
    parentValue: unknown,
    propertyName: string,
    propertyValue?: unknown,
  ): boolean {
    if (!propertyName) {
      return false;
    }
    // Initialize empty array container if undefined or null
    if (parentValue === undefined || parentValue === null) {
      parentValue = {};
      this.setJsonPointer(parent.instanceLocation, parentValue);
    }
    // Value exists but is not an object, cannot add
    if (typeof parentValue !== "object") {
      return false;
    }
    const { schema, keywordLocationToken, required } = getSubSchema(
      parent.schema,
      propertyName,
    );
    // cannot add if no schema match found, it not an expected property
    if (!keywordLocationToken) {
      return false;
    }
    const defaultValue =
      propertyValue !== undefined
        ? propertyValue
        : this.newDefaultValue(schema, required);
    const propertyPath = jsonPointerJoin(parent.instanceLocation, propertyName);

    const success = setJsonPointer(this.value, propertyPath, defaultValue);
    if (!success) return false;

    // Reconcile from parent to rebuild children
    this.reconcile(parent.instanceLocation);
    this.notify({ type: "value", path: parent.instanceLocation });
    return true;
  }

  private addArrayItem(
    parent: FieldNode,
    parentValue: unknown,
    initialValue?: unknown,
  ): boolean {
    // Initialize empty array container if undefined or null
    if (parentValue === undefined || parentValue === null) {
      parentValue = [];
      this.setJsonPointer(parent.instanceLocation, parentValue);
    }
    // Value exists but is not an array, cannot add
    if (!Array.isArray(parentValue)) {
      return false;
    }
    // Add new item to array
    const newItemIndex = String(parentValue.length);
    const {
      schema: subschema,
      keywordLocationToken,
      required,
    } = getSubSchema(parent.schema, newItemIndex);
    // cannot add if no schema found, it not an expected property
    if (!keywordLocationToken) {
      return false;
    }
    const defaultValue =
      initialValue !== undefined
        ? initialValue
        : this.newDefaultValue(subschema, required);

    const itemPath = jsonPointerJoin(parent.instanceLocation, newItemIndex);
    const success = setJsonPointer(this.value, itemPath, defaultValue);
    if (!success) return false;

    // Reconcile from parent to rebuild children
    this.reconcile(parent.instanceLocation);
    this.notify({ type: "value", path: parent.instanceLocation });
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
  addChild(parentPath: string, key?: string, initialValue?: unknown): boolean {
    const parentNode = this.getNode(parentPath);
    if (!parentNode) {
      return false;
    }

    const parentValue = this.getValue(parentPath);

    if (parentNode.type === "array") {
      return this.addArrayItem(parentNode, parentValue, initialValue);
    } else if (parentNode.type === "object") {
      if (!key) {
        return false;
      }
      return this.addObjectProperty(parentNode, parentValue, key, initialValue);
    }
    return false;
  }

  /**
   * Set the value at a specific path.
   * Creates intermediate containers (objects/arrays) as needed.
   * Triggers reconciliation and notifies subscribers.
   *
   * When value is undefined and the field is not required, the field will be
   * removed from the parent container (similar to removeValue behavior).
   *
   * @param path - The JSON Pointer path (e.g., "/user/name", "" for root)
   * @param value - The new value to set. If undefined and field is optional, removes the field.
   * @returns true if successful, false if the path cannot be set
   *
   * @example
   * runtime.setValue("/name", "Bob"); // set name to "Bob"
   * runtime.setValue("", { name: "Alice" }); // replace entire root value
   * runtime.setValue("/optional", undefined); // remove optional field
   */
  setValue(path: string, value: unknown): boolean {
    if (value === undefined) {
      return this.clearValue(path);
    }
    if (!this.setJsonPointer(path, value)) return false;
    // when setting a value, also mark node as activated
    this.reconcile(path);
    this.notify({ type: "value", path });
    return true;
  }

  clearValue(path: string): boolean {
    const node = this.getNode(path);
    // If node is known and required, do not remove, but reset
    if (node && node.required) {
      // set to null to keep key present
      // if value not nullable, validation will handle error
      const success = this.setJsonPointer(path, null);
      if (success) {
        this.reconcile(path);
        this.notify({ type: "value", path });
      }
      return success;
    }
    // not required, remove the value
    return this.removeValue(path);
  }

  /**
   * Get the FieldNode at a specific path.
   * Returns the node tree representation that includes schema, type, error, and children.
   *
   * @param path - The JSON Pointer path (e.g., "/user/name", "" for root)
   * @returns The FieldNode at the path, or undefined if not found
   *
   * @example
   * const node = runtime.getNode("/name");
   * console.log(node?.schema, node?.type, node?.error);
   */
  getNode(path: string): FieldNode | undefined {
    // fast path for root
    if (path === "") return this.root;

    const segments = parseJsonPointer(path);
    let current: FieldNode | undefined = this.root;
    for (const segment of segments) {
      if (!current?.children) return undefined;
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
    let currentPath = path;
    while (currentPath) {
      const node = this.getNode(currentPath);
      if (node) return node;
      currentPath = getJsonPointerParent(currentPath);
    }
    return this.root;
  }

  validate(path: string): void {
    this.reconcile(path);
    this.notify({ type: "value", path });
  }
  /**
   * Update node dependencies when schema changes.
   * Unregisters old dependencies and registers new ones.
   */
  private updateNodeDependencies(node: FieldNode, schema: Schema): void {
    const { instanceLocation } = node;
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
   * Container initialization rules:
   * - Required containers will be initialized if it has defaults or required properties
   * - Nested containers are initialized only if they are in parent's required array
   *
   * @param instanceLocation - The path to the node
   * @param newSchema - The new effective schema
   * @param type - The schema type
   * @param required - Whether this node is required by its parent
   */
  private applySchemaDefaults(
    instanceLocation: string,
    newSchema: Schema,
    type: SchemaType,
    required: boolean = true,
  ): void {
    const strategy = this.options.fillDefaults;
    // when this field is not required by parent, do not apply defaults
    if (strategy === "never") {
      return;
    }
    const value = this.getValue(instanceLocation);
    const [newValue, changed] = applyDefaults(type, value, newSchema, required);
    if (changed) {
      this.setJsonPointer(instanceLocation, newValue);
    }
  }

  /**
   * Sort property entries by x-order.
   * Properties with lower x-order values come first.
   * Properties without x-order are placed at the end.
   */
  private sortPropertiesByOrder(
    entries: [string, Schema][],
  ): [string, Schema][] {
    return entries.sort(([, schemaA], [, schemaB]) => {
      const orderA =
        typeof schemaA["x-order"] === "number" ? schemaA["x-order"] : Infinity;
      const orderB =
        typeof schemaB["x-order"] === "number" ? schemaB["x-order"] : Infinity;
      return orderA - orderB;
    });
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

    // record this child key as processed
    const processedKeys = new Set<string>();

    // Build new children array to maintain correct order
    const newChildren: FieldNode[] = [];
    const oldChildrenMap = new Map<string, FieldNode>();
    for (const child of node.children || []) {
      oldChildrenMap.set(child.instanceLocation, child);
    }

    const isActivated = node.activated;

    const processChild = (
      childKey: string,
      childSchema: Schema,
      childkeywordLocation: string,
      canRemove: boolean = false,
      isRequired: boolean = false,
      isActivated: boolean = false,
    ) => {
      const childinstanceLocation = jsonPointerJoin(instanceLocation, childKey);
      if (processedKeys.has(childinstanceLocation)) {
        return;
      }
      processedKeys.add(childinstanceLocation);

      // Reuse existing child node or create new one
      let childNode = oldChildrenMap.get(childinstanceLocation);
      if (!childNode) {
        childNode = this.createEmptyNode(
          childinstanceLocation,
          childkeywordLocation,
        );
      }
      childNode.keywordLocation = childkeywordLocation;
      // Use x-origin-keyword from schema if available, otherwise use the constructed keywordLocation
      childNode.originKeywordLocation =
        typeof childSchema["x-origin-keyword"] === "string"
          ? childSchema["x-origin-keyword"]
          : childkeywordLocation;
      childNode.canRemove = canRemove;
      childNode.required = isRequired;
      childNode.activated = isActivated;
      this.buildNode(childNode, childSchema, { ...options });
      newChildren.push(childNode);
    };

    switch (type) {
      case "object": {
        const valueKeys =
          value && typeof value === "object" ? Object.keys(value) : [];

        // Set canAdd based on additionalProperties
        node.canAdd =
          !!effectiveSchema.additionalProperties ||
          !!effectiveSchema.patternProperties;

        // Process properties (cannot be removed)
        if (effectiveSchema.properties) {
          // Sort by x-order if present (lower values first, undefined comes last)
          const propertyEntries = this.sortPropertiesByOrder(
            Object.entries(effectiveSchema.properties),
          );

          for (const [key, subschema] of propertyEntries) {
            const isChildRequired =
              effectiveSchema.required?.includes(key) ?? false;
            processChild(
              key,
              subschema,
              `${keywordLocation}/properties/${key}`,
              false,
              isChildRequired,
              isActivated,
            );
          }
        }

        // Process patternProperties (can be removed)
        if (effectiveSchema.patternProperties) {
          for (const [pattern, subschema] of Object.entries(
            effectiveSchema.patternProperties,
          )) {
            for (const key of valueKeys) {
              if (safeRegexTest(pattern, key)) {
                processChild(
                  key,
                  subschema,
                  `${keywordLocation}/patternProperties/${jsonPointerEscape(pattern)}`,
                  true,
                  false, // patternProperties are never required
                  isActivated,
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
            processChild(
              key,
              subschema,
              `${keywordLocation}/additionalProperties`,
              true,
              false, // additionalProperties are never required
              isActivated,
            );
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
                true, // array prefix items are always considered required
                isActivated,
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
                true, // array items are always considered required
                isActivated,
              );
            }
          }
        }
        break;
      }
    }

    // Cleanup removed children and unregister their dependencies
    for (const [location, child] of oldChildrenMap) {
      if (!processedKeys.has(location)) {
        this.unregisterNodeDependencies(child);
      }
    }

    node.children = newChildren;
  }

  /**
   * Build/update a FieldNode in place.
   * Updates the node's schema, type, error, and children based on the current value.
   * @param schema - Optional. If provided, updates node.originalSchema. Otherwise uses existing.
   * @param isRequired - Whether this node is required by its parent schema.
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
        node.originalSchema = schema;
        this.updateNodeDependencies(node, schema);
      }

      const shouldValidate =
        node.activated && (value !== undefined || node.required);

      // Resolve effective schema based on current value
      const { type, effectiveSchema, error } = resolveEffectiveSchema(
        this.validator,
        node.originalSchema,
        value,
        keywordLocation,
        instanceLocation,
        shouldValidate,
      );

      // Detect changes for notifications
      const effectiveSchemaChanged =
        !deepEqual(effectiveSchema, node.schema) || type !== node.type;
      const errorChanged = !deepEqual(error, node.error);

      // Apply defaults when effective schema changes (e.g., if-then-else branch switch, or initial construction)
      // applySchemaDefaults will respect the autoFillDefaults option internally
      // Child nodes will be built after and will send their own notifications
      if (effectiveSchemaChanged) {
        this.applySchemaDefaults(
          instanceLocation,
          effectiveSchema,
          type,
          node.required,
        );
      }

      // Update node state
      node.schema = effectiveSchema;
      node.type = type;
      node.error = error;
      node.version++;

      // Build children - pass updatedNodes to ensure proper tracking
      // Re-fetch value in case defaults were applied
      const currentValue = this.getValue(instanceLocation);
      this.buildNodeChildren(node, currentValue, {
        updatedNodes,
      });

      // Mark this node as updated
      updatedNodes.add(instanceLocation);

      // Propagate updates to dependent nodes
      const dependentNodes = this.dependentsMap.get(instanceLocation);
      if (dependentNodes) {
        for (const dependentNode of dependentNodes) {
          this.buildNode(dependentNode, undefined, {
            updatedNodes,
          });
        }
      }

      // Send notifications for this node
      // Child nodes handle their own notifications in buildNodeChildren -> buildNode
      // Notify after all updates are done to prevent duplicate notifications
      if (effectiveSchemaChanged) {
        this.notify({ type: "schema", path: instanceLocation });
      }
      if (errorChanged) {
        this.notify({ type: "error", path: instanceLocation });
      }
    } finally {
      this.updatingNodes.delete(instanceLocation);
    }
  }
}
