import type { Schema, SchemaType, Output } from "./type";
import {
  matchSchemaType,
  detectSchemaType,
  parseJsonPointer,
  safeRegexTest,
} from "./util";
import type { Validator } from "./validate";

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
 * Maximum recursion depth for extractReferencedPaths to prevent stack overflow
 */
const MAX_EXTRACT_DEPTH = 100;

/**
 * Extract referenced paths from a conditional schema (if, oneOf, anyOf, etc.)
 * Returns paths relative to the current node
 *
 * @param conditionSchema - The schema to extract paths from
 * @param basePath - Base path for relative paths
 * @param depth - Current recursion depth (internal use)
 */
export function extractReferencedPaths(
  conditionSchema: Schema,
  basePath: string = "",
  depth: number = 0,
): string[] {
  // Prevent stack overflow on deeply nested schemas
  if (depth > MAX_EXTRACT_DEPTH) {
    console.warn(
      `extractReferencedPaths: max depth (${MAX_EXTRACT_DEPTH}) exceeded at path: ${basePath}`,
    );
    return [];
  }

  const paths: string[] = [];

  // Schema is expected to be pre-dereferenced
  const schema = conditionSchema;

  // 1. properties - checking child properties
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      const childPath = basePath ? `${basePath}/${key}` : `/${key}`;
      paths.push(childPath);
      // Recursively extract paths from nested conditions
      paths.push(
        ...extractReferencedPaths(schema.properties[key], childPath, depth + 1),
      );
    }
  }

  // 2. items - checking array elements
  if (schema.items && typeof schema.items === "object") {
    // items condition means dependency on the array itself
    paths.push(basePath || "/");
    paths.push(...extractReferencedPaths(schema.items, basePath, depth + 1));
  }

  // 3. prefixItems - checking specific indexed elements
  if (schema.prefixItems) {
    schema.prefixItems.forEach((itemSchema: Schema, index: number) => {
      const indexPath = basePath ? `${basePath}/${index}` : `/${index}`;
      paths.push(indexPath);
      paths.push(...extractReferencedPaths(itemSchema, indexPath, depth + 1));
    });
  }

  // 4. const/enum - value constraints at current path
  if (schema.const !== undefined || schema.enum) {
    if (basePath) {
      paths.push(basePath);
    }
  }

  // 5. type constraint
  if (schema.type && basePath) {
    paths.push(basePath);
  }

  // 6. Value constraints (minimum, maximum, minLength, maxLength, pattern, format)
  const valueConstraints = [
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "pattern",
    "format",
  ];
  for (const constraint of valueConstraints) {
    if (
      (schema as Record<string, unknown>)[constraint] !== undefined &&
      basePath
    ) {
      paths.push(basePath);
      break;
    }
  }

  // 7. Nested conditions - recursive handling
  if (schema.if) {
    paths.push(...extractReferencedPaths(schema.if, basePath, depth + 1));
  }
  if (schema.then) {
    paths.push(...extractReferencedPaths(schema.then, basePath, depth + 1));
  }
  if (schema.else) {
    paths.push(...extractReferencedPaths(schema.else, basePath, depth + 1));
  }

  // 8. allOf/anyOf/oneOf
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const subSchemas = schema[keyword];
    if (subSchemas) {
      for (const subSchema of subSchemas) {
        paths.push(...extractReferencedPaths(subSchema, basePath, depth + 1));
      }
    }
  }

  // 9. dependentSchemas - when a property exists, apply additional schema
  if (schema.dependentSchemas) {
    for (const [key, subSchema] of Object.entries(schema.dependentSchemas)) {
      const keyPath = basePath ? `${basePath}/${key}` : `/${key}`;
      // The presence of the key triggers the dependent schema
      paths.push(keyPath);
      // The dependent schema may reference other paths
      paths.push(...extractReferencedPaths(subSchema, basePath, depth + 1));
    }
  }

  // 10. contains - dependency on array elements
  if (schema.contains) {
    paths.push(basePath || "/");
    paths.push(...extractReferencedPaths(schema.contains, basePath, depth + 1));
  }

  // Deduplicate
  return [...new Set(paths)];
}

export function resolveEffectiveSchema(
  validator: Validator,
  schema: Schema,
  value: unknown,
  keywordLocation: string,
  instanceLocation: string,
): {
  effectiveSchema: Schema;
  type: SchemaType;
  error?: Output;
} {
  // Schema is expected to be pre-dereferenced (all $refs resolved)
  let effective = schema;

  // if-then-else
  if (effective.if) {
    const output = validator.validate(
      effective.if,
      value,
      `${keywordLocation}/if`,
      instanceLocation,
    );
    if (output.valid) {
      if (effective.then) {
        const res = resolveEffectiveSchema(
          validator,
          effective.then,
          value,
          `${keywordLocation}/then`,
          instanceLocation,
        );
        effective = mergeSchema(effective, res.effectiveSchema);
      }
    } else {
      if (effective.else) {
        const res = resolveEffectiveSchema(
          validator,
          effective.else,
          value,
          `${keywordLocation}/else`,
          instanceLocation,
        );
        effective = mergeSchema(effective, res.effectiveSchema);
      }
    }
    // Remove if/then/else to prevent re-evaluation during shallow validation
    const { if: _, then: __, else: ___, ...rest } = effective;
    effective = rest;
  }

  // allOf
  if (effective.allOf) {
    for (const [index, subschema] of effective.allOf.entries()) {
      const res = resolveEffectiveSchema(
        validator,
        subschema,
        value,
        `${keywordLocation}/allOf/${index}`,
        instanceLocation,
      );
      effective = mergeSchema(effective, res.effectiveSchema);
    }
    // Remove allOf to prevent re-evaluation during shallow validation
    const { allOf: _, ...rest } = effective;
    effective = rest;
  }

  // anyOf
  if (effective.anyOf) {
    for (const [index, subschema] of effective.anyOf.entries()) {
      const output = validator.validate(
        subschema,
        value,
        keywordLocation + `/anyOf/` + index,
        instanceLocation,
      );
      if (output.valid) {
        const res = resolveEffectiveSchema(
          validator,
          subschema,
          value,
          keywordLocation + `/anyOf/` + index,
          instanceLocation,
        );
        effective = mergeSchema(effective, res.effectiveSchema);
        break;
      }
    }
    // Remove anyOf to prevent re-evaluation during shallow validation
    const { anyOf: _, ...rest } = effective;
    effective = rest;
  }

  // oneOf
  if (effective.oneOf) {
    let validCount = 0;
    let lastValidSchema: Schema | null = null;
    for (const [index, subschema] of effective.oneOf.entries()) {
      const output = validator.validate(
        subschema,
        value,
        `${keywordLocation}/oneOf/${index}`,
        instanceLocation,
      );
      if (output.valid) {
        validCount++;
        lastValidSchema = subschema;
      }
    }
    if (validCount === 1 && lastValidSchema) {
      effective = mergeSchema(effective, lastValidSchema);
    }
    // Remove oneOf to prevent re-evaluation during shallow validation
    const { oneOf: _, ...rest } = effective;
    effective = rest;
  }

  // type - determine the effective type for rendering purposes
  let type: SchemaType = "unknown";
  if (effective.type) {
    const allowedTypes = Array.isArray(effective.type)
      ? effective.type
      : [effective.type];
    const matched = allowedTypes.find((t) => matchSchemaType(value, t));
    if (matched) {
      type = matched as SchemaType;
    } else {
      // Use first allowed type as the effective type for rendering
      type = allowedTypes[0] as SchemaType;
    }
  } else {
    type = detectSchemaType(value) as SchemaType;
  }

  // Perform shallow validation to get all errors
  const validationOutput = validator.validate(
    effective,
    value,
    keywordLocation,
    instanceLocation,
    { shallow: true },
  );

  return {
    effectiveSchema: effective,
    type,
    error: validationOutput.valid ? undefined : validationOutput,
  };
}

function mergeStrings(a?: string[], b?: string[]): string[] | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const merged = Array.from(new Set([...a, ...b]));
  return merged.length === 0 ? undefined : merged;
}

function mergeType(
  a?: string[] | string,
  b?: string[] | string,
): string[] | string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const arrayA = Array.isArray(a) ? a : [a];
  const arrayB = Array.isArray(b) ? b : [b];
  const merged = arrayA.filter((t) => arrayB.includes(t));
  if (merged.length === 0) return undefined;
  return merged.length === 1 ? merged[0] : merged;
}

/**
 * Merge schema arrays by concatenation (for allOf/anyOf/oneOf)
 */
function mergeSchemaArrays(a?: Schema[], b?: Schema[]): Schema[] | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  // Concatenate both arrays
  return [...a, ...b];
}

export function mergeSchema(base: Schema, override?: Schema): Schema {
  if (!override) return base;

  const merged: Schema = {
    ...base,
    ...override,
  };

  // $defs: merge definitions
  if (base.$defs || override.$defs) {
    merged.$defs = {
      ...base.$defs,
      ...override.$defs,
    };
  }

  // required: union of required fields
  const mergedRequired = mergeStrings(base.required, override.required);
  if (mergedRequired !== undefined) {
    merged.required = mergedRequired;
  }

  // type: intersection of types
  const mergedType = mergeType(base.type, override.type);
  if (mergedType !== undefined) {
    merged.type = mergedType;
  }

  // dependentRequired: merge objects
  if (base.dependentRequired || override.dependentRequired) {
    merged.dependentRequired = {
      ...base.dependentRequired,
      ...override.dependentRequired,
    };
  }

  // properties: merge objects (override takes precedence)
  if (base.properties || override.properties) {
    merged.properties = {
      ...base.properties,
      ...override.properties,
    };
  }

  // patternProperties: merge objects
  if (base.patternProperties || override.patternProperties) {
    merged.patternProperties = {
      ...base.patternProperties,
      ...override.patternProperties,
    };
  }

  // items: merge recursively
  if (base.items && override.items) {
    merged.items = mergeSchema(base.items, override.items);
  } else if (base.items) {
    merged.items = base.items;
  } else if (override.items) {
    merged.items = override.items;
  }

  // prefixItems: merge with pairwise merge
  if (base.prefixItems || override.prefixItems) {
    merged.prefixItems = [];
    const len = Math.max(
      base.prefixItems?.length || 0,
      override.prefixItems?.length || 0,
    );
    for (let i = 0; i < len; i++) {
      const baseSchema = base.prefixItems?.[i];
      const overrideSchema = override.prefixItems?.[i];
      if (baseSchema && overrideSchema) {
        merged.prefixItems.push(mergeSchema(baseSchema, overrideSchema));
      } else {
        const schema = baseSchema || overrideSchema;
        if (schema) {
          merged.prefixItems.push(schema);
        }
      }
    }
  }

  // allOf/anyOf/oneOf: concatenate arrays
  const combinatorKeywords = ["allOf", "anyOf", "oneOf"] as const;
  for (const keyword of combinatorKeywords) {
    const mergedArray = mergeSchemaArrays(base[keyword], override[keyword]);
    if (mergedArray !== undefined) {
      merged[keyword] = mergedArray;
    }
  }

  // if/then/else: override takes precedence (no merge, just override behavior)
  // Note: if both have if/then/else, the override's conditional logic replaces base's
  // This is intentional as conditional schemas are context-dependent

  // dependentSchemas: merge objects
  if (base.dependentSchemas || override.dependentSchemas) {
    merged.dependentSchemas = {
      ...base.dependentSchemas,
      ...override.dependentSchemas,
    };
  }

  // additionalProperties: override takes precedence
  // (already handled by spread, but be explicit about it)

  // not: override takes precedence
  // (already handled by spread)

  return merged;
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

/**
 * Generate a default value for a schema based on its type and constraints.
 *
 * Priority order for determining the default value:
 *   1. const - if defined, returns the const value
 *   2. default - if defined, returns the default value
 *   3. Type-based defaults:
 *      - string: ""
 *      - number/integer: 0
 *      - boolean: false
 *      - null: null
 *      - object: {} with required properties recursively initialized
 *      - array: []
 *
 * For objects, only required properties are initialized with their default values.
 * If no type is specified but properties exist, the schema is treated as an object.
 *
 * @param schema - The JSON Schema to generate a default value for
 * @returns The generated default value, or undefined if type cannot be determined
 *
 * @example
 * getDefaultValue({ type: "string" }) // returns ""
 * getDefaultValue({ type: "number", default: 42 }) // returns 42
 * getDefaultValue({ const: "fixed" }) // returns "fixed"
 * getDefaultValue({
 *   type: "object",
 *   properties: { name: { type: "string" } },
 *   required: ["name"]
 * }) // returns { name: "" }
 */
export function getDefaultValue(schema: Schema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.default !== undefined) return schema.default;

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "object": {
      const obj: Record<string, unknown> = {};
      if (schema.properties) {
        for (const [key, subschema] of Object.entries(schema.properties)) {
          if (schema.required?.includes(key)) {
            obj[key] = getDefaultValue(subschema);
          }
        }
      }
      return obj;
    }
    case "array":
      return [];
    default:
      // If no type but has properties, assume object
      if (schema.properties) {
        return getDefaultValue({ ...schema, type: "object" });
      }
      return undefined;
  }
}
