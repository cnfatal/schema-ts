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
  jsonPointer: string;
  schemaPath: string;
  schema: Schema; // effective schema
  originalSchema: Schema;
  type: SchemaType;
  value?: unknown;
  defaultValue?: unknown;
  error?: Output;
  children?: FieldNode[];
  // Absolute paths this node's effective schema depends on
  dependencies: Set<string>;
  version: number;
}

export type SchemaChangeEvent = {
  type: "schema" | "value" | "error";
  path: string;
};

export class SchemaRuntime {
  private validator: Validator;

  private watchers: Record<string, Set<(e: SchemaChangeEvent) => void>> = {};

  // Reverse dependency index: path -> nodes that depend on this path's value
  private dependentsMap: Map<string, Set<FieldNode>> = new Map();

  // Track nodes currently being updated to prevent circular updates
  private updatingNodes: Set<string> = new Set();

  // The root schema (pre-dereferenced, all $refs resolved)
  private rootSchema!: Schema;

  public root!: FieldNode;

  private version: number = 0;

  // Note: Validation is now performed inside resolveEffectiveSchema,
  // so we don't need a separate validateNode method.

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
   * Unregister all dependencies for a node and its children,
   * and clean up any watchers associated with the node's path
   */
  private unregisterNodeDependencies(node: FieldNode): void {
    // Unregister this node's dependencies
    if (node.dependencies) {
      for (const depPath of node.dependencies) {
        this.unregisterDependent(depPath, node);
      }
    }

    // Clean up watchers for this node's path
    if (this.watchers[node.jsonPointer]) {
      delete this.watchers[node.jsonPointer];
    }

    // Recursively unregister children's dependencies
    if (node.children) {
      for (const child of node.children) {
        this.unregisterNodeDependencies(child);
      }
    }
  }

  constructor(validator: Validator, schema: Schema | unknown, value: unknown) {
    this.validator = validator;
    this.initializeTree(schema, value);
  }

  private initializeTree(schema: Schema | unknown, value: unknown): void {
    // 1. Normalize and update root schema
    const normalized = normalizeSchema(schema);
    this.rootSchema = dereferenceSchemaDeep(normalized, normalized);

    // 2. Clear all dependency tracking
    this.dependentsMap.clear();

    // 3. Build/Rebuild the tree
    this.root = this.buildNode(this.rootSchema, "#", "", value);
  }

  getVersion(): number {
    return this.version;
  }

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

  notify(event: SchemaChangeEvent) {
    this.version++;
    const pathsToNotify = [event.path];
    if (event.path !== "#") {
      pathsToNotify.push("#");
    }

    for (const path of pathsToNotify) {
      const watchers = this.watchers[path];
      if (watchers) {
        for (const cb of watchers) {
          try {
            cb(event);
          } catch (err) {
            // Log the error but don't let one watcher's failure prevent others from being notified
            console.error("SchemaRuntime: watcher callback error:", err);
          }
        }
      }
    }
  }

  /**
   * Update the entire schema.
   * This triggers a full rebuild of the node tree while preserving the current value (if possible).
   */
  updateSchema(schema: Schema | unknown): void {
    this.initializeTree(schema, this.root.value);

    // Notify listeners that the root schema has changed
    this.notify({ type: "schema", path: "#" });
  }

  getValue(path: string): unknown {
    if (path === "" || path === "#") return this.root.value;
    return getJsonPointer(this.root.value, path);
  }

  setValue(path: string, value: unknown): boolean {
    if (path === "" || path === "#") {
      this.root.value = value;
    } else {
      const success = setJsonPointer(this.root.value, path, value);
      if (!success) return false;
    }

    this.notify({ type: "value", path });

    // 1. Update the target node and its children's values
    const targetNode = this.findNode(path);
    if (targetNode) {
      this.updateNodeValue(targetNode);
    }

    // 2. Trigger dependent nodes to re-resolve their schemas
    const dependentNodes = this.dependentsMap.get(path);
    if (dependentNodes) {
      for (const node of dependentNodes) {
        // Prevent circular updates
        if (!this.updatingNodes.has(node.jsonPointer)) {
          this.updatingNodes.add(node.jsonPointer);
          this.reconcileNode(node);
          this.updatingNodes.delete(node.jsonPointer);
        }
      }
    }

    return true;
  }

  /**
   * Update a node's value without re-resolving its schema
   */
  private updateNodeValue(node: FieldNode): void {
    node.value = getJsonPointer(this.root.value, node.jsonPointer);
    // Re-validate when value changes
    const { error } = resolveEffectiveSchema(
      this.validator,
      node.schema,
      node.value,
      node.schemaPath,
      node.jsonPointer,
    );
    node.error = error;
    node.version++;
    if (node.children) {
      for (const child of node.children) {
        this.updateNodeValue(child);
      }
    }
  }

  getSchema(path: string): Schema {
    const node = this.findNode(path);
    return node ? node.schema : {};
  }

  findNode(path: string): FieldNode | null {
    // Handle root node queries
    if (path === "" || path === "#") return this.root;

    const segments = parseJsonPointer(path);
    let current: FieldNode = this.root;

    for (const segment of segments) {
      if (!current.children) return null;

      // Build the expected exact path for this child
      const expectedPath = jsonPointerJoin(current.jsonPointer, segment);
      const found = current.children.find(
        (child) => child.jsonPointer === expectedPath,
      );

      if (!found) return null;
      current = found;
    }

    return current;
  }

  private reconcileNode(node: FieldNode): void {
    // 1. Update value from root
    const newValue = getJsonPointer(this.root.value, node.jsonPointer);
    node.value = newValue;

    // 2. Resolve Effective Schema (includes validation)
    const {
      schema: newEffectiveSchema,
      type: newType,
      error: newError,
      defaultValue,
    } = resolveEffectiveSchema(
      this.validator,
      node.originalSchema,
      newValue,
      node.schemaPath,
      node.jsonPointer,
    );

    // 3. Check for Schema Change
    if (!deepEqual(newEffectiveSchema, node.schema) || newType !== node.type) {
      // Schema or Type changed -> Unregister old dependencies first
      this.unregisterNodeDependencies(node);

      // Full rebuild of this subtree without registering dependencies
      // (we'll register them to the original node instead)
      const newNode = this.buildNode(
        node.originalSchema,
        node.schemaPath,
        node.jsonPointer,
        newValue,
        { skipDependencyRegistration: true },
      );

      // Register dependencies to the original node (not newNode)
      for (const depPath of newNode.dependencies) {
        this.registerDependent(depPath, node);
      }

      // Copy rebuilt node properties
      node.schema = newNode.schema;
      node.type = newNode.type;
      node.error = newNode.error;
      node.defaultValue = newNode.defaultValue;
      node.children = newNode.children;
      node.dependencies = newNode.dependencies;
      node.version++;

      this.notify({ type: "schema", path: node.jsonPointer });
      return;
    }

    // 4. Schema unchanged -> update error/default (validation was done in resolveEffectiveSchema)
    node.error = newError;
    node.defaultValue = defaultValue;
    node.version++;

    // 5. Reconcile all children
    this.reconcileChildren(node, newEffectiveSchema, newType, newValue);
  }

  private reconcileChildren(
    node: FieldNode,
    effectiveSchema: Schema,
    type: string,
    value: unknown,
  ): void {
    if (type !== "object" && type !== "array") return;
    if (!node.children) node.children = [];

    const valueKeys =
      value && typeof value === "object" ? Object.keys(value) : [];
    const existingChildMap = new Map(
      node.children.map((c) => [c.jsonPointer, c]),
    );
    const newChildren: FieldNode[] = [];

    for (const key of valueKeys) {
      const childPath = jsonPointerJoin(node.jsonPointer, key);
      const existingChild = existingChildMap.get(childPath);

      if (existingChild) {
        this.reconcileNode(existingChild);
        newChildren.push(existingChild);
      } else {
        // New child - build it
        const childResult = this.buildChildNode(
          effectiveSchema,
          type,
          key,
          node,
          value,
        );
        if (childResult) {
          newChildren.push(childResult);
        }
      }
    }

    node.children = newChildren;
    node.version++;
  }

  private buildChildNode(
    effectiveSchema: Schema,
    type: string,
    key: string,
    parentNode: FieldNode,
    parentValue: unknown,
  ): FieldNode | null {
    const childSchema = this.getSchemaForChild(effectiveSchema, type, key);
    if (!childSchema) return null;

    let subKeywordPath = "";
    if (type === "object") {
      if (effectiveSchema.properties && effectiveSchema.properties[key]) {
        subKeywordPath = `/properties/${key}`;
      } else if (effectiveSchema.patternProperties) {
        for (const p in effectiveSchema.patternProperties) {
          if (safeRegexTest(p, key)) {
            subKeywordPath = `/patternProperties/${jsonPointerEscape(p)}`;
            break;
          }
        }
      } else if (effectiveSchema.additionalProperties) {
        subKeywordPath = `/additionalProperties`;
      }
    } else if (type === "array") {
      const i = Number(key);
      if (
        effectiveSchema.prefixItems &&
        i < effectiveSchema.prefixItems.length
      ) {
        subKeywordPath = `/prefixItems/${i}`;
      } else {
        subKeywordPath = `/items`;
      }
    }

    if (!subKeywordPath) return null;

    const childPath = jsonPointerJoin(parentNode.jsonPointer, key);
    return this.buildNode(
      childSchema,
      parentNode.schemaPath + subKeywordPath,
      childPath,
      get(parentValue, [key]),
    );
  }

  private getSchemaForChild(
    schema: Schema,
    type: string,
    key: string,
  ): Schema | undefined {
    if (type === "object") {
      // 1. Properties
      if (schema.properties && Object.hasOwn(schema.properties, key)) {
        return schema.properties[key];
      }
      // 2. Pattern Properties
      if (schema.patternProperties) {
        for (const [pattern, subschema] of Object.entries(
          schema.patternProperties,
        )) {
          if (safeRegexTest(pattern, key)) {
            return subschema;
          }
        }
      }
      // 3. Additional Properties
      if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        return schema.additionalProperties;
      }
    } else if (type === "array") {
      const idx = Number(key);
      if (!isNaN(idx)) {
        if (schema.prefixItems && idx < schema.prefixItems.length) {
          return schema.prefixItems[idx];
        }
        if (schema.items) {
          return schema.items;
        }
      }
    }
    return undefined;
  }

  buildNode(
    schema: Schema,
    keywordLocation: string = "#",
    instanceLocation: string = "",
    value: unknown,
    options: { skipDependencyRegistration?: boolean } = {},
  ): FieldNode {
    // Collect dependencies first
    const dependencies = this.collectDependencies(schema, instanceLocation);

    const {
      schema: effectiveSchema,
      type,
      error,
      defaultValue,
    } = resolveEffectiveSchema(
      this.validator,
      schema,
      value,
      keywordLocation,
      instanceLocation,
    );

    const node: FieldNode = {
      jsonPointer: instanceLocation,
      schemaPath: keywordLocation,
      schema: effectiveSchema,
      originalSchema: schema,
      type,
      value,
      error,
      defaultValue,

      dependencies,
      version: 0,
    };

    // Register this node in the dependentsMap (unless skipped for efficiency)
    if (!options.skipDependencyRegistration) {
      for (const depPath of dependencies) {
        this.registerDependent(depPath, node);
      }
    }

    switch (node.type) {
      case "string":
      case "number":
      case "boolean":
      case "null":
        break;
      case "object": {
        node.children = [];
        const valueKeys =
          value && typeof value === "object" ? Object.keys(value) : [];
        const processedKeys = new Set<string>();

        // 1. Properties
        if (effectiveSchema.properties) {
          for (const [key, subschema] of Object.entries(
            effectiveSchema.properties,
          )) {
            processedKeys.add(key);
            const childNode = this.buildNode(
              subschema,
              `${keywordLocation}/properties/${key}`,
              jsonPointerJoin(instanceLocation, key),
              get(value, [key]),
            );
            node.children.push(childNode);
          }
        }

        // 2. Pattern Properties
        if (effectiveSchema.patternProperties) {
          for (const [pattern, subschema] of Object.entries(
            effectiveSchema.patternProperties,
          )) {
            for (const key of valueKeys) {
              if (safeRegexTest(pattern, key) && !processedKeys.has(key)) {
                processedKeys.add(key);
                const childNode = this.buildNode(
                  subschema,
                  `${keywordLocation}/patternProperties/${jsonPointerEscape(pattern)}`,
                  jsonPointerJoin(instanceLocation, key),
                  get(value, [key]),
                );
                node.children.push(childNode);
              }
            }
          }
        }

        // 3. Additional Properties
        if (effectiveSchema.additionalProperties !== undefined) {
          if (typeof effectiveSchema.additionalProperties === "object") {
            for (const key of valueKeys) {
              if (!processedKeys.has(key)) {
                const childNode = this.buildNode(
                  effectiveSchema.additionalProperties,
                  `${keywordLocation}/additionalProperties`,
                  jsonPointerJoin(instanceLocation, key),
                  get(value, [key]),
                );
                node.children.push(childNode);
              }
            }
          }
        }
        break;
      }
      case "array":
        node.children = [];
        if (Array.isArray(value)) {
          let prefixItemsLength = 0;
          // 1. Prefix Items
          if (effectiveSchema.prefixItems) {
            prefixItemsLength = effectiveSchema.prefixItems.length;
            for (
              let i = 0;
              i < Math.min(value.length, prefixItemsLength);
              i++
            ) {
              const childNode = this.buildNode(
                effectiveSchema.prefixItems[i],
                `${keywordLocation}/prefixItems/${i}`,
                jsonPointerJoin(instanceLocation, String(i)),
                get(value, [String(i)]),
              );
              node.children.push(childNode);
            }
          }

          // 2. Items (tuple or list)
          if (effectiveSchema.items && value.length > prefixItemsLength) {
            for (let i = prefixItemsLength; i < value.length; i++) {
              const childNode = this.buildNode(
                effectiveSchema.items,
                `${keywordLocation}/items`,
                jsonPointerJoin(instanceLocation, String(i)),
                get(value, [String(i)]),
              );
              node.children.push(childNode);
            }
          }
        }
        break;
      default:
        break;
    }
    return node;
  }
}
