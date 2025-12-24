import type { Schema, SchemaType, Output } from "./type";
import {
  get,
  getJsonPointer,
  jsonPointerEscape,
  jsonPointerJoin,
  setJsonPointer,
  deepEqual,
  resolveAbsolutePath,
  parseJsonPointer,
  safeRegexTest,
} from "./util";
import {
  extractReferencedPaths,
  resolveEffectiveSchema,
  dereferenceSchemaDeep,
} from "./schema-util";
import { normalizeSchema } from "./normalize";
import type { Validator } from "./validate";

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

  constructor(validator: Validator, schema: Schema | unknown, value: unknown) {
    const normalized = normalizeSchema(schema);

    this.rootSchema = dereferenceSchemaDeep(normalized, normalized);
    this.validator = validator;
    this.value = value;
    this.root = this.createEmptyNode("", "#");
    this.buildNode(this.root, this.value, this.rootSchema);
  }

  /**
   * Collect all dependencies for a node's schema.
   *
   * Key insight: We extract paths from condition keywords (if, oneOf, anyOf)
   * using extractReferencedPaths, but for then/else/allOf keywords, we recursively
   * call collectDependencies to ensure proper dependency isolation between
   * parent and child nodes.
   */
  private collectDependencies(
    schema: Schema,
    instanceLocation: string,
  ): Set<string> {
    const deps = new Set<string>();

    // Handle if-then-else
    if (schema.if) {
      // Extract paths from the if condition
      const relativePaths = extractReferencedPaths(schema.if, "");
      for (const relPath of relativePaths) {
        deps.add(resolveAbsolutePath(instanceLocation, relPath));
      }

      // Recursively extract from then/else which may have nested conditions
      if (schema.then) {
        const thenDeps = this.collectDependencies(
          schema.then,
          instanceLocation,
        );
        thenDeps.forEach((d) => deps.add(d));
      }
      if (schema.else) {
        const elseDeps = this.collectDependencies(
          schema.else,
          instanceLocation,
        );
        elseDeps.forEach((d) => deps.add(d));
      }
    }

    // Handle oneOf - each option may check different conditions
    // We need both direct paths (from condition checks) and nested dependencies
    if (schema.oneOf) {
      for (const subSchema of schema.oneOf) {
        // Extract direct referenced paths from the condition
        const relativePaths = extractReferencedPaths(subSchema, "");
        for (const relPath of relativePaths) {
          deps.add(resolveAbsolutePath(instanceLocation, relPath));
        }
        // Also recursively collect dependencies from nested conditions
        const subDeps = this.collectDependencies(subSchema, instanceLocation);
        subDeps.forEach((d) => deps.add(d));
      }
    }

    // Handle anyOf - same treatment as oneOf
    if (schema.anyOf) {
      for (const subSchema of schema.anyOf) {
        const relativePaths = extractReferencedPaths(subSchema, "");
        for (const relPath of relativePaths) {
          deps.add(resolveAbsolutePath(instanceLocation, relPath));
        }
        const subDeps = this.collectDependencies(subSchema, instanceLocation);
        subDeps.forEach((d) => deps.add(d));
      }
    }

    // Handle allOf (may contain conditions)
    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        const subDeps = this.collectDependencies(subSchema, instanceLocation);
        subDeps.forEach((d) => deps.add(d));
      }
    }

    return deps;
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
    // Pass originalSchema to trigger dependency calculation on initial build
    // buildNode will handle updating dependent nodes automatically
    this.buildNode(
      targetNode,
      this.getValue(targetNode.instanceLocation),
      targetNode.originalSchema,
    );
  }

  getVersion(): number {
    return this.version;
  }

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
   */
  subscribeAll(cb: (e: SchemaChangeEvent) => void): () => void {
    this.globalWatchers.add(cb);
    return () => {
      this.globalWatchers.delete(cb);
    };
  }

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
  updateSchema(schema: Schema | unknown): void {
    const normalized = normalizeSchema(schema);
    this.rootSchema = dereferenceSchemaDeep(normalized, normalized);
    // Reinitialize root node with new schema
    this.root = {
      instanceLocation: "",
      keywordLocation: "#",
      schema: this.rootSchema,
      originalSchema: {},
      type: "null",
      dependencies: new Set(),
      version: 0,
    };
    this.buildNode(this.root, this.getValue(ROOT_PATH), this.rootSchema);
    this.notify({ type: "schema", path: ROOT_PATH });
  }

  getValue(path: string): unknown {
    const normalizedPath = normalizeRootPath(path);
    if (normalizedPath === ROOT_PATH) return this.value;
    return getJsonPointer(this.value, normalizedPath);
  }

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

  getSchema(path: string): Schema {
    const node = this.findNode(path);
    return node ? node.schema : {};
  }

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

  findNearestExistingNode(path: string): FieldNode | undefined {
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
   * Build/update a FieldNode in place.
   * Updates the node's schema, type, error, and children based on the current value.
   * @param schema - Optional. If provided, updates node.originalSchema. Otherwise uses existing.
   */
  buildNode(
    node: FieldNode,
    value: unknown,
    schema?: Schema,
    options: {
      skipDependencyRegistration?: boolean;
      updatedNodes?: Set<string>;
    } = {},
  ): void {
    const { keywordLocation, instanceLocation } = node;

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

    // Only recalculate dependencies when originalSchema changes
    if (schema && !deepEqual(schema, node.originalSchema)) {
      node.originalSchema = schema;
      const dependencies = this.collectDependencies(
        node.originalSchema,
        instanceLocation,
      );
      // Unregister old dependencies
      for (const depPath of node.dependencies || []) {
        this.unregisterDependent(depPath, node);
      }
      node.dependencies = dependencies;
      if (!options.skipDependencyRegistration) {
        for (const depPath of dependencies) {
          this.registerDependent(depPath, node);
        }
      }
    }

    // value change may affect effective schema, type, error
    const { type, effectiveSchema, error } = resolveEffectiveSchema(
      this.validator,
      node.originalSchema,
      value,
      keywordLocation,
      instanceLocation,
    );
    // record changes
    const effectiveSchemaChanged =
      !deepEqual(effectiveSchema, node.schema) || type !== node.type;
    const errorChanged = !deepEqual(error, node.error);

    node.schema = effectiveSchema;
    node.type = type;
    node.error = error;
    node.version++;

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
      // recursively build child node
      const childValue = get(value, [childKey]);
      this.buildNode(childNode, childValue, childSchema, options);
      newChildren.push(childNode);
    };

    switch (type) {
      case "object": {
        const valueKeys =
          value && typeof value === "object" ? Object.keys(value) : [];
        const processedKeys = new Set<string>();

        if (effectiveSchema.properties) {
          for (const [key, subschema] of Object.entries(
            effectiveSchema.properties,
          )) {
            processedKeys.add(key);
            processChild(
              key,
              subschema,
              `${keywordLocation}/properties/${key}`,
            );
          }
        }

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
                );
              }
            }
          }
        }

        if (effectiveSchema.additionalProperties !== undefined) {
          if (typeof effectiveSchema.additionalProperties === "object") {
            for (const key of valueKeys) {
              if (!processedKeys.has(key)) {
                processChild(
                  key,
                  effectiveSchema.additionalProperties,
                  `${keywordLocation}/additionalProperties`,
                );
              }
            }
          }
        }
        break;
      }
      case "array": {
        if (Array.isArray(value)) {
          let prefixItemsLength = 0;
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
              );
            }
          }

          if (effectiveSchema.items && value.length > prefixItemsLength) {
            for (let i = prefixItemsLength; i < value.length; i++) {
              processChild(
                String(i),
                effectiveSchema.items,
                `${keywordLocation}/items`,
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

    // Notify if effective schema changed
    if (effectiveSchemaChanged) {
      this.notify({ type: "schema", path: node.instanceLocation });
    }
    // Notify if error changed
    if (errorChanged) {
      this.notify({ type: "error", path: node.instanceLocation });
    }

    // Mark this node as updated and clean up updating state
    updatedNodes.add(instanceLocation);
    this.updatingNodes.delete(instanceLocation);

    // Handle dependents - other nodes that depend on this path's value
    // Note: dependents don't need to recalculate dependencies (their originalSchema hasn't changed)
    const dependentNodes = this.dependentsMap.get(instanceLocation);
    if (dependentNodes) {
      for (const dependentNode of dependentNodes) {
        // Don't pass schema - only value changed, not originalSchema
        this.buildNode(
          dependentNode,
          this.getValue(dependentNode.instanceLocation),
          undefined,
          { ...options, updatedNodes },
        );
      }
    }
  }
}
