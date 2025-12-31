import type { Schema } from "./type";

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
 * If a value is provided, it will be used as the base and missing defaults will be filled in.
 *
 * @param schema - The JSON Schema to generate a default value for
 * @param value - Optional existing value to fill defaults into
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
 * getDefaultValue({ type: "object", properties: { a: { default: 1 } } }, {}) // returns { a: 1 }
 */
export function getDefaultValue(schema: Schema, value?: unknown): unknown {
  if (value === undefined) {
    if (schema.const !== undefined) return schema.const;
    if (schema.default !== undefined) return schema.default;
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  if (type === "object" || (!type && schema.properties)) {
    let obj: Record<string, unknown>;
    if (value === undefined) {
      obj = {};
    } else if (typeof value === "object" && value !== null) {
      obj = value as Record<string, unknown>;
    } else {
      return value;
    }

    if (schema.properties) {
      for (const [key, subschema] of Object.entries(schema.properties)) {
        if (obj[key] !== undefined) {
          obj[key] = getDefaultValue(subschema, obj[key]);
        } else if (schema.required?.includes(key)) {
          obj[key] = getDefaultValue(subschema);
        }
      }
    }
    return obj;
  }

  if (type === "array") {
    let arr: unknown[];
    if (value === undefined) {
      arr = [];
    } else if (Array.isArray(value)) {
      arr = value;
    } else {
      return value;
    }

    if (schema.prefixItems) {
      schema.prefixItems.forEach((subschema, index) => {
        if (index < arr.length) {
          arr[index] = getDefaultValue(subschema, arr[index]);
        } else if (value === undefined) {
          arr.push(getDefaultValue(subschema));
        }
      });
    }

    if (value !== undefined && schema.items) {
      const startIndex = schema.prefixItems ? schema.prefixItems.length : 0;
      for (let i = startIndex; i < arr.length; i++) {
        arr[i] = getDefaultValue(schema.items, arr[i]);
      }
    }

    return arr;
  }

  if (value !== undefined) {
    return value;
  }

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
    default:
      return undefined;
  }
}
