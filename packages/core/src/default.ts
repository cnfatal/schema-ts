import type { Schema } from "./type";

export interface GetDefaultValueOptions {
  /** Optional existing value to fill defaults into */
  value?: unknown;
  /**
   * Controls type-based default behavior:
   *   - 'always': Returns type-based defaults (e.g., "" for string, [] for array)
   *   - 'explicit' (default): Only returns explicitly declared schema.const or schema.default
   */
  strategy?: "always" | "explicit";
}

export function typeNullable(schema: Schema): [string | undefined, boolean] {
  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  const nullable = types.includes("null");
  const type = types.find((t) => t !== "null");
  return [type, nullable];
}

/**
 * Generate a default value for a schema based on its type and constraints.
 *
 * Priority order for determining the default value:
 *   1. const - if defined, returns the const value
 *   2. default - if defined, returns the default value
 *   3. Type-based defaults (controlled by strategy):
 *
 * For objects, only required properties are initialized with their default values.
 * If no type is specified but properties exist, the schema is treated as an object.
 *
 * If a value is provided, it will be used as the base and missing defaults will be filled in.
 *
 * @param schema - The JSON Schema to generate a default value for
 * @param required - Whether the property is required (affects object property initialization)
 * @returns The generated default value, or undefined if type cannot be determined
 */
export function getDefaultValue(
  schema: Schema,
  required: boolean = false,
): unknown {
  if (schema.const !== undefined) return schema.const;
  if (schema.default !== undefined) return schema.default;

  const [type, nullable] = typeNullable(schema);
  switch (type) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const [key, subschema] of Object.entries(schema.properties || {})) {
        if (schema.required?.includes(key)) {
          obj[key] = getDefaultValue(subschema, true);
        }
      }
      if (Object.keys(obj).length === 0) {
        // when no properties to set but required, return null or empty object to satisfy required
        return required ? (nullable ? null : {}) : undefined;
      }
      return obj;
    }
    case "array": {
      const arr: unknown[] = [];
      schema.prefixItems?.forEach((subschema) => {
        arr.push(getDefaultValue(subschema, true));
      });
      if (arr.length === 0) {
        return required ? (nullable ? null : []) : undefined;
      }
      return arr;
    }
    case "string":
      return required ? (nullable ? null : "") : undefined;
    case "number":
      return required ? (nullable ? null : 0) : undefined;
    case "integer":
      return required ? (nullable ? null : 0) : undefined;
    case "boolean":
      return required ? (nullable ? null : false) : undefined;
    case "null":
      return null;
    default:
      return undefined;
  }
}

/**
 * The missing-property defaults the runtime materializes into an object value.
 * Returned as `[key, defaultValue]` entries. Shared by `applyDefaults`
 * (materialize into state) and `projectDefaults` (project a read-only copy) so
 * both agree on which properties receive a value and what that value is.
 */
function missingPropertyDefaults(
  schema: Schema,
  isMissing: (key: string) => boolean,
): Array<[string, unknown]> {
  const result: Array<[string, unknown]> = [];
  for (const [key, subschema] of Object.entries(schema.properties || {})) {
    if (!isMissing(key)) continue;
    const required = schema.required?.includes(key) ?? false;
    // A property is materialized when it is required or declares a default.
    // Compare with === undefined (not truthiness) so falsy defaults such as
    // false, 0 and "" are applied.
    if (!required && subschema.default === undefined) continue;
    const value = getDefaultValue(subschema, required);
    // A required property whose type cannot be inferred has no value to apply;
    // leave the key absent instead of storing undefined.
    if (value === undefined) continue;
    result.push([key, value]);
  }
  return result;
}

export function applyDefaults(
  type: string,
  value: unknown,
  schema: Schema,
  required: boolean = false,
): [unknown, boolean] {
  if (value === undefined) {
    if (!required) {
      return [value, false];
    }
    const defaultValue = getDefaultValue(schema, required);
    return [defaultValue, defaultValue !== undefined];
  }
  const [_, nullable] = typeNullable(schema);
  if (nullable && value === null) {
    return [null, false];
  }

  let changed = false;
  if (type === "object") {
    // existing value must be an object
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return [value, false];
    }
    const obj = value as Record<string, unknown>;
    for (const [key, defaultValue] of missingPropertyDefaults(
      schema,
      (key) => obj[key] === undefined,
    )) {
      obj[key] = defaultValue;
      changed = true;
    }
    return [obj, changed];
  }
  if (type === "array") {
    // existing value must be an array
    if (!Array.isArray(value)) {
      return [value, false];
    }
    const arr = value as unknown[];
    schema.prefixItems?.forEach((subschema, index) => {
      if (arr[index] !== undefined) return;
      const defaultValue = getDefaultValue(subschema, true);
      if (defaultValue === undefined) return;
      arr[index] = defaultValue;
      changed = true;
    });
    return [arr, changed];
  }
  return [value, false];
}

/**
 * Build a copy of `value` with the defaults the runtime would materialize,
 * without mutating the input or the runtime state.
 *
 * `default` is a JSON Schema annotation and does not affect validation, but this
 * runtime materializes defaults while building form nodes. Conditional schemas
 * (`if`/`then`/`else`) must therefore be evaluated against the value the form
 * displays; otherwise a discriminator declared with a default (e.g.
 * `enabled: { default: false }`) is seen as absent and vacuously satisfies
 * `then`. This mirrors `applyDefaults`, so a branch is never selected based on
 * a default that would not actually be stored.
 *
 * @param type - Effective schema type for `value`
 * @param value - Current instance value (never mutated)
 * @param schema - Schema providing defaults
 * @param required - Whether this node is required by its parent
 * @returns A projected copy, or the original value when nothing changes
 */
export function projectDefaults(
  type: string,
  value: unknown,
  schema: Schema,
  required: boolean = false,
): unknown {
  if (value === undefined) {
    if (!required) return value;
    const defaultValue = getDefaultValue(schema, required);
    if (defaultValue === null || typeof defaultValue !== "object") {
      return defaultValue;
    }
    // Project the materialized container so optional/`default` properties and
    // nested defaults are included, exactly as `applyDefaults` would store.
    return projectDefaults(type, defaultValue, schema, required);
  }

  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }
    const source = value as Record<string, unknown>;
    // Same missing-property rule the runtime materializes.
    const defaults = new Map(
      missingPropertyDefaults(schema, (key) => source[key] === undefined),
    );
    let copy: Record<string, unknown> | undefined;
    for (const [key, subschema] of Object.entries(schema.properties || {})) {
      const current = source[key];
      const isRequired = schema.required?.includes(key) ?? false;
      const next = current === undefined ? defaults.get(key) : current;
      if (next === undefined) continue;
      const [childType] = typeNullable(subschema);
      const projected = projectDefaults(
        childType ?? "",
        next,
        subschema,
        isRequired,
      );
      const changed =
        current === undefined ? next !== undefined : projected !== current;
      if (changed) {
        if (!copy) copy = { ...source };
        copy[key] = projected;
      }
    }
    return copy ?? value;
  }

  if (type === "array") {
    if (!Array.isArray(value)) return value;
    let copy: unknown[] | undefined;
    value.forEach((item, index) => {
      const itemSchema =
        schema.prefixItems?.[index] ??
        (typeof schema.items === "object" ? schema.items : undefined);
      if (!itemSchema) return;
      const [childType] = typeNullable(itemSchema);
      const projected = projectDefaults(
        childType ?? "",
        item,
        itemSchema,
        true,
      );
      if (projected !== item) {
        if (!copy) copy = value.slice();
        copy[index] = projected;
      }
    });
    return copy ?? value;
  }

  return value;
}
