/*
 * Definition of JSON Schema type according to JSON Schema 2020-12 specification
 * Spec references:
 * - spec/draft/2020-12/jsonschema-core.md
 * - spec/draft/2020-12/jsonschema-validation.md
 */
export type Schema = {
  // Core keywords - identifiers
  $schema?: string;
  $id?: string;
  $anchor?: string;
  $dynamicAnchor?: string;
  $ref?: string;
  $dynamicRef?: string;
  $defs?: Record<string, Schema>;
  $comment?: string;

  // Metadata annotations
  title?: string;
  description?: string;
  default?: unknown;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  examples?: unknown[];

  // Validation keywords - any instance type
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;

  // Validation keywords - numeric instances
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;

  // Validation keywords - strings
  maxLength?: number;
  minLength?: number;
  pattern?: string;

  // Semantic validation with format
  format?: string;

  // Validation keywords - arrays
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxContains?: number;
  minContains?: number;

  // Validation keywords - objects
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  dependentRequired?: Record<string, string[]>;

  // Applicator keywords - applying subschemas with logic
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  not?: Schema;

  // Applicator keywords - conditional
  if?: Schema;
  then?: Schema;
  else?: Schema;
  dependentSchemas?: Record<string, Schema>;

  // Applicator keywords - arrays
  prefixItems?: Schema[];
  items?: Schema;
  contains?: Schema;

  // Applicator keywords - objects
  properties?: Record<string, Schema>;
  patternProperties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  propertyNames?: Schema;

  // Applicator keywords - unevaluated locations
  unevaluatedItems?: Schema;
  unevaluatedProperties?: Schema;

  // String-encoded data
  contentEncoding?: string;
  contentMediaType?: string;
  contentSchema?: Schema;

  // Allow additional JSON Schema keywords (extensions)
  [key: string]: unknown;
};

/**
 * Result of schema validation
 */
export interface Output {
  valid: boolean;
  keywordLocation: string;
  instanceLocation: string;
  absoluteKeywordLocation?: string;
  absoluteInstanceLocation?: string;
  error?: string;
  errors: Output[];
  annotations?: Output[];
}

/**
 * Structured error message for i18n support.
 * Used internally by ErrorFormatter to produce localized error strings.
 */
export interface ErrorMessage {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * JSON Schema type values
 */
export type SchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null"
  | "unknown";
