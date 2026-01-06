import type { Schema, SchemaType, Output } from "./type";
import { matchSchemaType, detectSchemaType } from "./util";
import type { Validator } from "./validate";

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

/**
 * Merge schema maps (properties, patternProperties, etc.)
 * Recursive merge for overlapping keys.
 */
function mergeSchemaMap(
  base?: Record<string, Schema>,
  override?: Record<string, Schema>,
): Record<string, Schema> | undefined {
  if (base === undefined) return override;
  if (override === undefined) return base;

  const merged = { ...base };
  for (const [key, schema] of Object.entries(override)) {
    if (merged[key]) {
      merged[key] = mergeSchema(merged[key], schema);
    } else {
      merged[key] = schema;
    }
  }
  return merged;
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

  // properties: merge objects (recursive merge for overlapping keys)
  const mergedProperties = mergeSchemaMap(base.properties, override.properties);
  if (mergedProperties !== undefined) {
    merged.properties = mergedProperties;
  }

  // patternProperties: merge objects (recursive merge for overlapping patterns)
  const mergedPatternProperties = mergeSchemaMap(
    base.patternProperties,
    override.patternProperties,
  );
  if (mergedPatternProperties !== undefined) {
    merged.patternProperties = mergedPatternProperties;
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

  // dependentSchemas: merge objects (recursive merge for overlapping keys)
  const mergedDependentSchemas = mergeSchemaMap(
    base.dependentSchemas,
    override.dependentSchemas,
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
