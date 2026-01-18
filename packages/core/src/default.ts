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
    for (const [key, subschema] of Object.entries(schema.properties || {})) {
      if (obj[key] !== undefined) continue;
      if (schema.required?.includes(key) || subschema.default) {
        const defaultValue = getDefaultValue(subschema, required);
        // when defaultValue is undefined, we remove the key to treat it as missing
        if (defaultValue == undefined) {
          delete obj[key];
        }
        obj[key] = defaultValue;
        changed = true;
      }
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
      arr[index] = getDefaultValue(subschema, true);
      changed = true;
    });
    return [arr, changed];
  }
  return [value, false];
}
