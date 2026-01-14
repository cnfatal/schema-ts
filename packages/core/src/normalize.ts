/**
 * Schema normalizer that transforms older JSON Schema drafts to draft-2020-12.
 *
 * This allows the validator to only implement draft-2020-12 semantics
 * while still supporting schemas written for older drafts.
 */
import type { Schema } from "./type";
import { detectSchemaDraft, type SchemaDraft } from "./version";

/**
 * Schema normalizer interface for transforming various JSON Schema formats into a unified version.
 */
export interface Normalizer {
  /**
   * Normalizes the given schema.
   * @param schema The raw schema input
   * @returns A schema object following the latest draft specification
   */
  normalize(schema: unknown): Schema;
}

/**
 * Base draft normalizer responsible for converting older JSON Schema keywords to newer versions (e.g., Draft-04 to Draft-2020-12).
 */
export class DraftNormalizer implements Normalizer {
  normalize(schema: unknown): Schema {
    return normalizeSchema(schema);
  }
}

export interface DraftNormalizerOptions {
  /**
   * Source draft version. If not specified, will be auto-detected.
   */
  sourceDraft?: SchemaDraft;
}

/**
 * Normalize a JSON Schema from any supported draft to draft-2020-12 format.
 *
 * Transformations performed:
 * - `id` → `$id` (draft-04)
 * - Boolean `exclusiveMaximum`/`exclusiveMinimum` → numeric values (draft-04)
 * - Array `items` + `additionalItems` → `prefixItems` + `items` (draft-04/07/2019-09)
 * - `dependencies` → `dependentRequired`/`dependentSchemas` (draft-04/07)
 * - `$recursiveRef`/`$recursiveAnchor` → `$dynamicRef`/`$dynamicAnchor` (draft-2019-09)
 *
 * @param schema - The schema to normalize (can be object, boolean, or unknown)
 * @param options - Optional configuration
 * @returns A new schema object in draft-2020-12 format (always returns an object)
 */
export function normalizeSchema(
  schema: unknown,
  options: DraftNormalizerOptions = {},
): Schema {
  // Handle boolean schemas (valid in Draft-06+)
  if (typeof schema === "boolean") {
    return schema ? {} : { not: {} };
  }

  // If not an object, return empty schema
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {} as Schema;
  }

  const schemaObj = schema as Schema;
  const sourceDraft = options.sourceDraft ?? detectSchemaDraft(schemaObj);

  // Create a mutable copy to transform
  const normalized: Schema = { ...schemaObj };

  // 1. Process based on source draft
  switch (sourceDraft) {
    case "draft-04":
      normalizeDraft04(normalized);
      normalizeDraft07(normalized);
      normalizeDraft201909(normalized);
      break;
    case "draft-07":
      normalizeDraft07(normalized);
      normalizeDraft201909(normalized);
      break;
    case "draft-2019-09":
      normalizeDraft07(normalized);
      normalizeDraft201909(normalized);
      break;
  }

  // Process general/OpenAPI extensions (nullable, example)
  normalizeGeneral(normalized);

  // Recursively normalize nested schemas
  normalizeNestedSchemas(normalized, options);

  // Update $schema to indicate normalized version
  if (normalized.$schema) {
    normalized.$schema = "https://json-schema.org/draft/2020-12/schema";
  }

  return normalized;
}

/**
 * Normalize draft-04 specific keywords (like id, exclusiveMaximum, etc.) to newer format.
 */
function normalizeDraft04(schema: Schema): void {
  // Access schema as Record for legacy keywords not in the type
  const legacy = schema as Record<string, unknown>;

  // id → $id
  if ("id" in legacy && !("$id" in schema)) {
    schema.$id = legacy.id as string;
    delete legacy.id;
  }

  // Sibling of $ref should be removed in Draft-04 to preserve semantics
  // (In Draft-04, $ref overrides all other keywords in the same object)
  if ("$ref" in schema) {
    for (const key of Object.keys(schema)) {
      if (
        key !== "$ref" &&
        key !== "$schema" &&
        key !== "id" &&
        key !== "$id" &&
        key !== "$comment"
      ) {
        delete legacy[key];
      }
    }
  }

  // Boolean exclusiveMaximum/exclusiveMinimum → numeric
  // In draft-04: exclusiveMaximum is a boolean, used with maximum
  // In draft-07+: exclusiveMaximum is the numeric limit itself
  if (
    typeof legacy.exclusiveMaximum === "boolean" &&
    legacy.exclusiveMaximum === true
  ) {
    if (schema.maximum !== undefined) {
      schema.exclusiveMaximum = schema.maximum;
      delete schema.maximum;
    } else {
      delete legacy.exclusiveMaximum;
    }
  }

  if (
    typeof legacy.exclusiveMinimum === "boolean" &&
    legacy.exclusiveMinimum === true
  ) {
    if (schema.minimum !== undefined) {
      schema.exclusiveMinimum = schema.minimum;
      delete schema.minimum;
    } else {
      delete legacy.exclusiveMinimum;
    }
  }

  // Clean up false boolean exclusive values
  if (legacy.exclusiveMaximum === false) {
    delete legacy.exclusiveMaximum;
  }
  if (legacy.exclusiveMinimum === false) {
    delete legacy.exclusiveMinimum;
  }

  // enum: [x] -> const: x
  // While enum is still valid, const is the preferred 2020-12 way for single values
  if (
    Array.isArray(schema.enum) &&
    schema.enum.length === 1 &&
    schema.const === undefined
  ) {
    schema.const = schema.enum[0];
  }
}

/**
 * Normalize draft-07 specific keywords to newer format.
 */
function normalizeDraft07(schema: Schema): void {
  // Access schema as Record for legacy keywords not in the type
  const legacy = schema as Record<string, unknown>;

  // Array items + additionalItems → prefixItems + items
  // In draft-04/07: items can be an array (tuple validation), additionalItems for extra
  // In draft-2020-12: prefixItems is the array, items is for additional
  if (Array.isArray(legacy.items)) {
    schema.prefixItems = legacy.items as Schema[];
    if ("additionalItems" in legacy) {
      if (
        typeof legacy.additionalItems === "object" ||
        typeof legacy.additionalItems === "boolean"
      ) {
        schema.items = legacy.additionalItems as Schema;
      }
      delete legacy.additionalItems;
    } else {
      // In Draft-04/07, items without additionalItems means additional items are allowed
      // In Draft-2020-12, prefixItems without items keyword doesn't restrict additional items either.
      // So this is fine.
      delete legacy.items;
    }
  }

  // dependencies → dependentRequired / dependentSchemas
  if ("dependencies" in legacy) {
    const deps = legacy.dependencies as Record<string, string[] | Schema>;

    for (const [prop, value] of Object.entries(deps)) {
      if (Array.isArray(value)) {
        // String array → dependentRequired
        if (!schema.dependentRequired) {
          schema.dependentRequired = {};
        }
        schema.dependentRequired[prop] = value;
      } else {
        // Schema → dependentSchemas
        if (!schema.dependentSchemas) {
          schema.dependentSchemas = {};
        }
        schema.dependentSchemas[prop] = value;
      }
    }

    delete legacy.dependencies;
  }
}

/**
 * Normalize general keywords and common extensions (OpenAPI) to standard format.
 */
function normalizeGeneral(schema: Schema): void {
  // Access schema as Record for legacy keywords not in the type
  const legacy = schema as Record<string, unknown>;

  // Generic/OpenAPI: nullable: true
  if (legacy.nullable === true) {
    if (typeof schema.type === "string") {
      schema.type = [schema.type, "null"];
    } else if (Array.isArray(schema.type)) {
      if (!schema.type.includes("null")) {
        schema.type = [...schema.type, "null"];
      }
    }
    delete legacy.nullable;
  }

  // Generic/OpenAPI: example: x -> examples: [x]
  if ("example" in legacy) {
    if (!("examples" in schema)) {
      schema.examples = [legacy.example];
    }
    delete legacy.example;
  }
}

/**
 * Normalize draft-2019-09 specific keywords to draft-2020-12 format.
 */
function normalizeDraft201909(schema: Schema): void {
  // $recursiveRef → $dynamicRef
  if ("$recursiveRef" in schema) {
    let ref = schema.$recursiveRef as string;
    // Normalized $recursiveRef: "#" to $dynamicRef: "#recursiveAnchor"
    // to match the default anchor we use for $recursiveAnchor
    if (ref === "#") {
      ref = "#recursiveAnchor";
    }
    schema.$dynamicRef = ref;
    delete schema.$recursiveRef;
  }

  // $recursiveAnchor → $dynamicAnchor
  if ("$recursiveAnchor" in schema) {
    // $recursiveAnchor was always true (boolean)
    if (schema.$recursiveAnchor === true) {
      // Use a standard name for the dynamic anchor
      schema.$dynamicAnchor = schema.$dynamicAnchor ?? "recursiveAnchor";
    }
    delete schema.$recursiveAnchor;
  }
}

/** * Recursively normalize all nested schemas within a schema.
 */
function normalizeNestedSchemas(
  schema: Schema,
  options: DraftNormalizerOptions,
): void {
  // Definitions
  if (schema.$defs) {
    schema.$defs = Object.fromEntries(
      Object.entries(schema.$defs).map(([key, subSchema]) => [
        key,
        normalizeSchema(subSchema, options),
      ]),
    );
  }

  // Legacy definitions (draft-04/07 used "definitions")
  if ("definitions" in schema) {
    const defs = schema.definitions as Record<string, Schema>;
    if (!schema.$defs) {
      schema.$defs = {};
    }
    for (const [key, subSchema] of Object.entries(defs)) {
      schema.$defs[key] = normalizeSchema(subSchema, options);
    }
    delete schema.definitions;
  }

  // Properties
  if (schema.properties) {
    schema.properties = Object.fromEntries(
      Object.entries(schema.properties)
        .filter(
          ([_, subSchema]) => subSchema !== null && subSchema !== undefined,
        )
        .map(([key, subSchema]) => [key, normalizeSchema(subSchema, options)]),
    );
  }

  // Pattern properties
  if (schema.patternProperties) {
    schema.patternProperties = Object.fromEntries(
      Object.entries(schema.patternProperties)
        .filter(
          ([_, subSchema]) => subSchema !== null && subSchema !== undefined,
        )
        .map(([key, subSchema]) => [key, normalizeSchema(subSchema, options)]),
    );
  }

  // Additional properties (if schema)
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    schema.additionalProperties = normalizeSchema(
      schema.additionalProperties,
      options,
    );
  }

  // Items (after normalization, this is for additional items)
  if (
    schema.items &&
    typeof schema.items === "object" &&
    !Array.isArray(schema.items)
  ) {
    schema.items = normalizeSchema(schema.items, options);
  }

  // Prefix items
  if (schema.prefixItems) {
    schema.prefixItems = schema.prefixItems.map((s) =>
      normalizeSchema(s, options),
    );
  }

  // Contains
  if (schema.contains) {
    schema.contains = normalizeSchema(schema.contains, options);
  }

  // Applicators
  if (schema.allOf) {
    schema.allOf = schema.allOf.map((s) => normalizeSchema(s, options));
  }
  if (schema.anyOf) {
    schema.anyOf = schema.anyOf.map((s) => normalizeSchema(s, options));
  }
  if (schema.oneOf) {
    schema.oneOf = schema.oneOf.map((s) => normalizeSchema(s, options));
  }
  if (schema.not) {
    schema.not = normalizeSchema(schema.not, options);
  }

  // Conditionals
  if (schema.if) {
    schema.if = normalizeSchema(schema.if, options);
  }
  if (schema.then) {
    schema.then = normalizeSchema(schema.then, options);
  }
  if (schema.else) {
    schema.else = normalizeSchema(schema.else, options);
  }

  // Dependent schemas
  if (schema.dependentSchemas) {
    schema.dependentSchemas = Object.fromEntries(
      Object.entries(schema.dependentSchemas)
        .filter(
          ([_, subSchema]) => subSchema !== null && subSchema !== undefined,
        )
        .map(([key, subSchema]) => [key, normalizeSchema(subSchema, options)]),
    );
  }

  // Unevaluated
  if (schema.unevaluatedItems) {
    schema.unevaluatedItems = normalizeSchema(schema.unevaluatedItems, options);
  }
  if (schema.unevaluatedProperties) {
    schema.unevaluatedProperties = normalizeSchema(
      schema.unevaluatedProperties,
      options,
    );
  }

  // Property names
  if (schema.propertyNames) {
    schema.propertyNames = normalizeSchema(schema.propertyNames, options);
  }

  // Content schema
  if (schema.contentSchema) {
    schema.contentSchema = normalizeSchema(schema.contentSchema, options);
  }
}

/**
 * Enhanced normalizer that adds type inference, automatic required field identification,
 * and support for OpenAPI/Kubernetes extension properties on top of base draft transformations.
 */
export class BetterNormalizer implements Normalizer {
  /**
   * Performs the normalization process:
   * 1. Base draft normalization (DraftNormalizer)
   * 2. Enhanced default value completion (Better logic)
   */
  normalize(schema: unknown): Schema {
    const normalized = normalizeSchema(schema);
    this.defaultSchema(normalized);
    return normalized;
  }

  /**
   * Recursively processes all sub-nodes of the schema, applying default rules.
   */
  private default(schema: Schema, forceRequired = false): Schema {
    this.defaultSchema(schema.if, true);
    this.defaultSchema(schema.then);
    this.defaultSchema(schema.else);
    schema.anyOf?.forEach((s) => this.defaultSchema(s));
    schema.oneOf?.forEach((s) => this.defaultSchema(s));
    schema.allOf?.forEach((s) => this.defaultSchema(s));

    this.defaultSchemaMap(schema.properties, forceRequired);
    this.defaultSchemaMap(schema.patternProperties, forceRequired);
    this.defaultSchema(schema.additionalProperties, forceRequired);
    this.defaultSchema(schema.propertyNames);
    this.defaultSchemaMap(schema.dependentSchemas, true);

    this.defaultSchema(schema.items);
    schema.prefixItems?.forEach((s) => this.defaultSchema(s));
    this.defaultSchema(schema.contains);

    this.defaultSchema(schema.unevaluatedItems);
    this.defaultSchema(schema.unevaluatedProperties);
    this.defaultSchema(schema.contentSchema);
    return schema;
  }

  /**
   * Batch processes Record-type sub-schemas.
   */
  private defaultSchemaMap(
    kvs?: Record<string, Schema>,
    forceRequired = false,
  ) {
    if (!kvs) {
      return;
    }
    Object.entries(kvs).forEach(([_, value]) => {
      this.defaultSchema(value, forceRequired);
    });
  }

  /**
   * Applies inference and heuristic rules to a single schema object.
   * Includes:
   * - `type` inference based on properties (object/array)
   * - Automatically setting properties with `const`/`default`/`enum` as `required`
   * - Handling `required` fields from OpenAPI `discriminator`
   * - Handling `x-required` and `x-kubernetes-patch-merge-key`
   */
  private defaultSchema(schema?: Schema | boolean, forceRequired = false) {
    if (!schema || typeof schema === "boolean") {
      return;
    }
    // 1. Type inference: If object/array specific keywords exist but type is undefined
    if (!schema.type) {
      if (
        schema.properties ||
        schema.patternProperties ||
        schema.additionalProperties
      ) {
        schema.type = "object";
      } else if (schema.items || schema.prefixItems || schema.additionalItems) {
        schema.type = "array";
      }
    }

    // patternProperties -> minProperties: 1
    if (schema.patternProperties && schema.minProperties === undefined) {
      schema.minProperties = 1;
    }

    // implicit required inference
    if (schema.required === undefined) {
      const required = [];
      for (const [key, value] of Object.entries(schema.properties || {})) {
        if (
          forceRequired ||
          value.const !== undefined ||
          (Array.isArray(value.enum) && value.enum.length > 0)
        ) {
          required.push(key);
        }
      }
      if (required.length > 0) {
        schema.required = required;
      }
    }

    // OpenAPI discriminator required
    const discriminator = toObject(schema.discriminator);
    if (discriminator.propertyName) {
      if (typeof discriminator.propertyName === "string") {
        if (schema.required === undefined) {
          schema.required = [discriminator.propertyName];
        } else if (!schema.required.includes(discriminator.propertyName)) {
          schema.required.push(discriminator.propertyName);
        }
      }
    }

    // x-required
    for (const [key, value] of Object.entries(schema.properties || {})) {
      if (value["x-required"] === true) {
        if (schema.required === undefined) {
          schema.required = [key];
        } else if (!schema.required.includes(key)) {
          schema.required.push(key);
        }
      }
    }

    // x-kubernetes-patch-merge-key
    const mergeKey = schema["x-kubernetes-patch-merge-key"];
    if (
      typeof mergeKey === "string" &&
      typeof schema.items === "object" &&
      schema.items !== null
    ) {
      const items = schema.items as Schema;
      if (!items.required) items.required = [];
      if (!items.required.includes(mergeKey)) {
        items.required.push(mergeKey);
      }
    }
    this.default(schema, forceRequired);
  }
}

function toObject(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null) {
    return val as Record<string, unknown>;
  }
  return {};
}
