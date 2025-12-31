import type { Schema } from "./type";
import { parseJsonPointer, safeRegexTest } from "./util";
import { mergeSchema } from "./effective";

/**
 * Configuration for schema utilities logging.
 * Set to null to disable warnings.
 */
export let schemaUtilLogger: {
  warn: (message: string) => void;
} | null = {
  warn: (message: string) => console.warn(message),
};

/**
 * Set the logger for schema utilities.
 * Pass null to disable logging.
 */
export function setSchemaUtilLogger(
  logger: { warn: (message: string) => void } | null,
): void {
  schemaUtilLogger = logger;
}

/**
 * Resolve a $ref reference within a root schema.
 * Supports:
 * - Internal references: #/$defs/Address, #/properties/name
 * - Does NOT support external URL references
 *
 * @param ref - The $ref value (e.g., "#/$defs/Address")
 * @param rootSchema - The root schema containing $defs
 * @param visited - Set of visited refs to detect circular references
 * @returns The resolved schema, or undefined if:
 *   - The reference is external (not starting with #)
 *   - The reference is circular
 *   - The reference path doesn't exist in the schema
 */
export function resolveRef(
  ref: string,
  rootSchema: Schema,
  visited: Set<string> = new Set(),
): Schema | undefined {
  // Only support internal references starting with #
  if (!ref.startsWith("#")) {
    schemaUtilLogger?.warn(`External $ref not supported: ${ref}`);
    return undefined;
  }

  // Detect circular reference
  if (visited.has(ref)) {
    schemaUtilLogger?.warn(`Circular $ref detected: ${ref}`);
    return undefined;
  }
  visited.add(ref);

  // Parse the JSON Pointer part (after #)
  const pointer = ref.slice(1); // Remove leading #
  if (pointer === "" || pointer === "/") {
    // Reference to root schema itself
    return rootSchema;
  }

  // Navigate through the schema using JSON Pointer
  const segments = parseJsonPointer(pointer);
  let current: unknown = rootSchema;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (current === null || current === undefined) {
    return undefined;
  }

  const resolved = current as Schema;

  // If the resolved schema also has a $ref, resolve it recursively
  if (resolved.$ref) {
    return resolveRef(resolved.$ref, rootSchema, visited);
  }

  return resolved;
}

/**
 * Dereference a schema by resolving any $ref it may contain.
 * The resolved schema is merged with any sibling keywords (JSON Schema 2019-09+ behavior).
 *
 * @param schema - The schema to dereference
 * @param rootSchema - The root schema for resolving references
 * @returns The dereferenced schema
 */
export function dereferenceSchema(schema: Schema, rootSchema: Schema): Schema {
  if (!schema.$ref) {
    return schema;
  }

  const resolved = resolveRef(schema.$ref, rootSchema);
  if (!resolved) {
    // If we can't resolve the ref, return the schema without the $ref
    // This allows partial functionality even with unresolved refs
    const { $ref: _, ...rest } = schema;
    return rest as Schema;
  }

  // Merge resolved schema with sibling properties (JSON Schema 2019-09+)
  // Sibling properties override the referenced schema
  const { $ref: _, ...siblings } = schema;
  return mergeSchema(resolved, siblings as Schema);
}

/**
 * Recursively dereference all $ref in a schema tree.
 * This should be called once at initialization to pre-process the entire schema.
 *
 * @param schema - The schema to dereference
 * @param rootSchema - The root schema for resolving references
 * @param processed - Map of already processed schemas to their results (for caching)
 * @param inProgress - Set of schemas currently being processed (for cycle detection)
 * @returns A new schema with all $refs resolved
 */
export function dereferenceSchemaDeep(
  schema: Schema,
  rootSchema: Schema,
  processed: WeakMap<object, Schema> = new WeakMap(),
  inProgress: WeakSet<object> = new WeakSet(),
): Schema {
  // Check if we've already fully processed this schema (cache hit)
  const cached = processed.get(schema);
  if (cached !== undefined) {
    return cached;
  }

  // Detect circular reference: if we're currently processing this schema,
  // return the original to avoid infinite recursion
  if (inProgress.has(schema)) {
    // Return original schema to break the cycle
    // This preserves the $ref for later resolution if needed
    return schema;
  }

  // Mark as in-progress before processing children
  inProgress.add(schema);

  // First resolve any $ref at this level
  let result = dereferenceSchema(schema, rootSchema);

  // If dereferencing returned the same object, we need to create a copy to avoid mutation
  if (result === schema) {
    result = { ...schema };
  }

  // Recursively process all sub-schemas
  // Properties
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, subSchema]) => [
        key,
        dereferenceSchemaDeep(subSchema, rootSchema, processed, inProgress),
      ]),
    );
  }

  // Pattern Properties
  if (result.patternProperties) {
    result.patternProperties = Object.fromEntries(
      Object.entries(result.patternProperties).map(([key, subSchema]) => [
        key,
        dereferenceSchemaDeep(subSchema, rootSchema, processed, inProgress),
      ]),
    );
  }

  // Additional Properties
  if (
    result.additionalProperties &&
    typeof result.additionalProperties === "object"
  ) {
    result.additionalProperties = dereferenceSchemaDeep(
      result.additionalProperties,
      rootSchema,
      processed,
      inProgress,
    );
  }

  // Items
  if (result.items) {
    result.items = dereferenceSchemaDeep(
      result.items,
      rootSchema,
      processed,
      inProgress,
    );
  }

  // Prefix Items
  if (result.prefixItems) {
    result.prefixItems = result.prefixItems.map((s) =>
      dereferenceSchemaDeep(s, rootSchema, processed, inProgress),
    );
  }

  // Contains
  if (result.contains) {
    result.contains = dereferenceSchemaDeep(
      result.contains,
      rootSchema,
      processed,
      inProgress,
    );
  }

  // allOf, anyOf, oneOf
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const subSchemas = result[keyword];
    if (subSchemas) {
      result[keyword] = subSchemas.map((s) =>
        dereferenceSchemaDeep(s, rootSchema, processed, inProgress),
      );
    }
  }

  // not
  if (result.not) {
    result.not = dereferenceSchemaDeep(
      result.not,
      rootSchema,
      processed,
      inProgress,
    );
  }

  // if/then/else
  if (result.if) {
    result.if = dereferenceSchemaDeep(
      result.if,
      rootSchema,
      processed,
      inProgress,
    );
  }
  if (result.then) {
    result.then = dereferenceSchemaDeep(
      result.then,
      rootSchema,
      processed,
      inProgress,
    );
  }
  if (result.else) {
    result.else = dereferenceSchemaDeep(
      result.else,
      rootSchema,
      processed,
      inProgress,
    );
  }

  // dependentSchemas
  if (result.dependentSchemas) {
    result.dependentSchemas = Object.fromEntries(
      Object.entries(result.dependentSchemas).map(([key, subSchema]) => [
        key,
        dereferenceSchemaDeep(subSchema, rootSchema, processed, inProgress),
      ]),
    );
  }

  // $defs (also dereference definitions themselves)
  if (result.$defs) {
    result.$defs = Object.fromEntries(
      Object.entries(result.$defs).map(([key, subSchema]) => [
        key,
        dereferenceSchemaDeep(subSchema, rootSchema, processed, inProgress),
      ]),
    );
  }

  // Cache the fully processed result
  processed.set(schema, result);

  return result;
}

/**
 * Get the subschema for a specific property or array item.
 *
 * This function determines the appropriate schema for a given key within a parent schema.
 * It handles both object and array schemas, checking in the following priority order:
 *
 * For objects:
 *   1. properties - exact property match
 *   2. patternProperties - regex pattern match
 *   3. additionalProperties - fallback for unknown properties
 *
 * For arrays:
 *   1. prefixItems - positional tuple items
 *   2. items - schema for remaining array items
 *
 * @param schema - The parent schema to look up the subschema from
 * @param key - The property name (for objects) or index as string (for arrays)
 * @returns An object containing:
 *   - schema: The resolved subschema, or empty object if not found
 *   - keywordLocationToken: The JSON Schema keyword path (e.g., "properties/name", "items")
 *
 * @example
 * // Object property lookup
 * const result = getSubSchema({ properties: { name: { type: "string" } } }, "name");
 * // result.schema = { type: "string" }
 * // result.keywordLocationToken = "properties/name"
 *
 * @example
 * // Array item lookup
 * const result = getSubSchema({ items: { type: "number" } }, "0");
 * // result.schema = { type: "number" }
 * // result.keywordLocationToken = "items"
 */
export function getSubSchema(
  schema: Schema,
  key: string,
): { schema: Schema; keywordLocationToken: string } {
  // Object properties
  if (schema.properties && schema.properties[key]) {
    return {
      schema: schema.properties[key],
      keywordLocationToken: `properties/${key}`,
    };
  }

  // Object pattern properties
  if (schema.patternProperties) {
    for (const [pattern, subschema] of Object.entries(
      schema.patternProperties,
    )) {
      if (safeRegexTest(pattern, key)) {
        return {
          schema: subschema,
          keywordLocationToken: `patternProperties/${pattern}`,
        };
      }
    }
  }

  // Object additional properties
  if (
    schema.additionalProperties !== undefined &&
    schema.additionalProperties !== false
  ) {
    return {
      schema:
        typeof schema.additionalProperties === "object"
          ? schema.additionalProperties
          : {},
      keywordLocationToken: "additionalProperties",
    };
  }

  // Array items
  if (schema.items || schema.prefixItems) {
    const index = parseInt(key, 10);
    if (!isNaN(index)) {
      if (schema.prefixItems && index < schema.prefixItems.length) {
        return {
          schema: schema.prefixItems[index],
          keywordLocationToken: `prefixItems/${index}`,
        };
      }
      if (schema.items) {
        return {
          schema: schema.items,
          keywordLocationToken: "items",
        };
      }
    }
  }

  return {
    schema: {},
    keywordLocationToken: "",
  };
}
