import type { ErrorMessage } from "./type";

/**
 * Default error message templates for i18n support.
 * Keys are translation keys, values are English templates with {param} placeholders.
 */
export const MESSAGES: Record<string, string> = {
  "validation.anyOf": "must match at least one schema",
  "validation.oneOf": "must match exactly one schema, matched {count}",
  "validation.not": "must not match schema",
  "validation.const": "must be equal to constant",
  "validation.enum": "must be equal to one of the allowed values",
  "validation.type": "must be {expected}",
  "validation.maximum": "must be <= {value}",
  "validation.exclusiveMaximum": "must be < {value}",
  "validation.minimum": "must be >= {value}",
  "validation.exclusiveMinimum": "must be > {value}",
  "validation.multipleOf": "must be multiple of {value}",
  "validation.maxLength": "must be shorter than or equal to {value} characters",
  "validation.minLength": "must be longer than or equal to {value} characters",
  "validation.pattern": 'must match pattern "{pattern}"',
  "validation.format": 'must match format "{format}"',
  "validation.maxItems": "must have at most {value} items",
  "validation.minItems": "must have at least {value} items",
  "validation.uniqueItems": "must not contain duplicate items",
  "validation.contains": "must contain at least one valid item",
  "validation.minContains": "must contain at least {value} valid items",
  "validation.maxContains": "must contain at most {value} valid items",
  "validation.maxProperties": "must have at most {value} properties",
  "validation.minProperties": "must have at least {value} properties",
  "validation.required": "must have required property '{property}'",
  "validation.dependentRequired":
    "property '{source}' requires property '{target}'",
  "validation.additionalProperties":
    "must not have additional properties: {properties}",
  "validation.failed": "validation failed",
};

/**
 * Formats ErrorMessage to string for Output.error.
 * Provide a custom implementation for i18n support.
 */
export type ErrorFormatter = (msg: ErrorMessage) => string;

/**
 * Default error formatter: looks up template from MESSAGES and interpolates params.
 */
export const defaultErrorFormatter: ErrorFormatter = (msg) => {
  const template = MESSAGES[msg.key] ?? msg.key;
  if (!msg.params) return template;

  let result = template;
  for (const [k, v] of Object.entries(msg.params)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
};
