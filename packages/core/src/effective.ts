import type { Schema, SchemaType, Output } from "./type";
import { matchSchemaType, detectSchemaType } from "./util";
import type { Validator } from "./validate";

export function resolveEffectiveSchema(
  validator: Validator,
  schema: Schema,
  value: unknown,
  keywordLocation: string,
  instanceLocation: string,
  // should validate the value against the effective schema
  validate: boolean = false,
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
      { fastFail: true },
    );
    if (output.valid) {
      if (effective.then) {
        const res = resolveEffectiveSchema(
          validator,
          effective.then,
          value,
          `${keywordLocation}/then`,
          instanceLocation,
          validate,
        );
        effective = mergeSchema(
          effective,
          res.effectiveSchema,
          `${keywordLocation}/then`,
        );
      }
    } else {
      if (effective.else) {
        const res = resolveEffectiveSchema(
          validator,
          effective.else,
          value,
          `${keywordLocation}/else`,
          instanceLocation,
          validate,
        );
        effective = mergeSchema(
          effective,
          res.effectiveSchema,
          `${keywordLocation}/else`,
        );
      }
    }
    // Remove if/then/else to prevent re-evaluation during shallow validation
    const { if: _, then: __, else: ___, ...rest } = effective;
    effective = rest;
  }

  // allOf
  if (effective.allOf) {
    for (const [index, subschema] of effective.allOf.entries()) {
      const subKeywordLocation = `${keywordLocation}/allOf/${index}`;
      const res = resolveEffectiveSchema(
        validator,
        subschema,
        value,
        subKeywordLocation,
        instanceLocation,
        validate,
      );
      effective = mergeSchema(
        effective,
        res.effectiveSchema,
        subKeywordLocation,
      );
    }
    // Remove allOf to prevent re-evaluation during shallow validation
    const { allOf: _, ...rest } = effective;
    effective = rest;
  }

  // anyOf
  if (effective.anyOf) {
    for (const [index, subschema] of effective.anyOf.entries()) {
      const subKeywordLocation = `${keywordLocation}/anyOf/${index}`;
      const output = validator.validate(
        subschema,
        value,
        subKeywordLocation,
        instanceLocation,
      );
      if (output.valid) {
        const res = resolveEffectiveSchema(
          validator,
          subschema,
          value,
          subKeywordLocation,
          instanceLocation,
          validate,
        );
        effective = mergeSchema(
          effective,
          res.effectiveSchema,
          subKeywordLocation,
        );
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
    let lastValidIndex = -1;
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
        lastValidIndex = index;
      }
    }
    if (validCount === 1 && lastValidSchema) {
      effective = mergeSchema(
        effective,
        lastValidSchema,
        `${keywordLocation}/oneOf/${lastValidIndex}`,
      );
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

  // For optional properties with undefined values, skip validation
  // but still return the resolved effective schema for UI rendering
  // FIXME: should remove validate option
  if (!validate) {
    return {
      effectiveSchema: effective,
      type,
      error: undefined,
    };
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

/**
 * Merge schema maps (properties, patternProperties, etc.)
 * Recursive merge for overlapping keys.
 * @param overrideOrigin - The keywordLocation origin for the override schema map
 */
function mergeSchemaMap(
  base?: Record<string, Schema>,
  override?: Record<string, Schema>,
  overrideOrigin?: string,
): Record<string, Schema> | undefined {
  if (base === undefined) {
    if (override === undefined) return undefined;
    // Set x-origin-keyword for each schema in override
    if (overrideOrigin) {
      const result: Record<string, Schema> = {};
      for (const [key, schema] of Object.entries(override)) {
        result[key] = {
          ...schema,
          "x-origin-keyword": `${overrideOrigin}/${key}`,
        };
      }
      return result;
    }
    return override;
  }
  if (override === undefined) return base;

  const merged = { ...base };
  for (const [key, schema] of Object.entries(override)) {
    const childOrigin = overrideOrigin ? `${overrideOrigin}/${key}` : undefined;
    if (merged[key]) {
      merged[key] = mergeSchema(merged[key], schema, childOrigin);
    } else {
      merged[key] = childOrigin
        ? { ...schema, "x-origin-keyword": childOrigin }
        : schema;
    }
  }
  return merged;
}

/**
 * Merge two schemas together.
 * @param overrideOrigin - The keywordLocation origin for the override schema (e.g., "#/allOf/0")
 */
export function mergeSchema(
  base: Schema,
  override?: Schema,
  overrideOrigin?: string,
): Schema {
  if (!override) return base;

  const merged: Schema = {
    ...base,
    ...override,
  };

  // Set x-origin-keyword to track the source of this merged schema
  if (overrideOrigin) {
    merged["x-origin-keyword"] = overrideOrigin;
  }

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

  // properties: merge objects (recursive merge for overlapping keys)
  const propertiesOrigin = overrideOrigin
    ? `${overrideOrigin}/properties`
    : undefined;
  const mergedProperties = mergeSchemaMap(
    base.properties,
    override.properties,
    propertiesOrigin,
  );
  if (mergedProperties !== undefined) {
    merged.properties = mergedProperties;
  }

  // patternProperties: merge objects (recursive merge for overlapping patterns)
  const patternPropertiesOrigin = overrideOrigin
    ? `${overrideOrigin}/patternProperties`
    : undefined;
  const mergedPatternProperties = mergeSchemaMap(
    base.patternProperties,
    override.patternProperties,
    patternPropertiesOrigin,
  );
  if (mergedPatternProperties !== undefined) {
    merged.patternProperties = mergedPatternProperties;
  }

  // items: merge recursively
  const itemsOrigin = overrideOrigin ? `${overrideOrigin}/items` : undefined;
  if (base.items && override.items) {
    merged.items = mergeSchema(base.items, override.items, itemsOrigin);
  } else if (base.items) {
    merged.items = base.items;
  } else if (override.items) {
    merged.items = itemsOrigin
      ? { ...override.items, "x-origin-keyword": itemsOrigin }
      : override.items;
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
      const prefixItemOrigin = overrideOrigin
        ? `${overrideOrigin}/prefixItems/${i}`
        : undefined;
      if (baseSchema && overrideSchema) {
        merged.prefixItems.push(
          mergeSchema(baseSchema, overrideSchema, prefixItemOrigin),
        );
      } else if (overrideSchema) {
        merged.prefixItems.push(
          prefixItemOrigin
            ? { ...overrideSchema, "x-origin-keyword": prefixItemOrigin }
            : overrideSchema,
        );
      } else if (baseSchema) {
        merged.prefixItems.push(baseSchema);
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

  // dependentSchemas: merge objects (recursive merge for overlapping keys)
  const dependentSchemasOrigin = overrideOrigin
    ? `${overrideOrigin}/dependentSchemas`
    : undefined;
  const mergedDependentSchemas = mergeSchemaMap(
    base.dependentSchemas,
    override.dependentSchemas,
    dependentSchemasOrigin,
  );
  if (mergedDependentSchemas !== undefined) {
    merged.dependentSchemas = mergedDependentSchemas;
  }

  // additionalProperties: override takes precedence
  // (already handled by spread, but be explicit about it)

  // not: override takes precedence
  // (already handled by spread)

  return merged;
}
