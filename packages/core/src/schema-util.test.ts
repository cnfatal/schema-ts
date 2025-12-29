import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import {
  extractReferencedPaths,
  resolveEffectiveSchema,
  resolveRef,
  dereferenceSchema,
  dereferenceSchemaDeep,
  mergeSchema,
  getSubSchema,
  getDefaultValue,
} from "./schema-util";
import { Validator } from "./validate";

describe("extractReferencedPaths", () => {
  it("extracts paths from properties", () => {
    const schema: Schema = {
      properties: {
        foo: { type: "string" },
        bar: {
          properties: {
            baz: { type: "number" },
          },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/bar");
    expect(paths).toContain("/bar/baz");
  });

  it("extracts paths from items", () => {
    const schema: Schema = {
      items: {
        properties: {
          foo: { type: "string" },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // items dependency means dependency on the array itself (basePath)
    expect(paths).toContain("/");
    expect(paths).toContain("/foo");
  });

  it("extracts paths from prefixItems", () => {
    const schema: Schema = {
      prefixItems: [
        { type: "string" },
        { properties: { foo: { type: "number" } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/0");
    expect(paths).toContain("/1");
    expect(paths).toContain("/1/foo");
  });

  it("extracts paths from const and enum", () => {
    const schema: Schema = {
      properties: {
        foo: { const: "bar" },
        baz: { enum: [1, 2] },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/baz");
  });

  it("extracts paths from conditional keywords (if, then, else)", () => {
    const schema: Schema = {
      if: {
        properties: { type: { const: "A" } },
      },
      then: {
        properties: { valueA: { type: "string" } },
      },
      else: {
        properties: { valueB: { type: "number" } },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/type");
    expect(paths).toContain("/valueA");
    expect(paths).toContain("/valueB");
  });

  it("extracts paths from combinators (allOf, anyOf, oneOf)", () => {
    const schema: Schema = {
      oneOf: [
        { properties: { foo: { type: "string" } } },
        { properties: { bar: { type: "number" } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/foo");
    expect(paths).toContain("/bar");
  });

  it("handles value constraints", () => {
    const schema: Schema = {
      properties: {
        age: { minimum: 18, maximum: 100 },
        name: { minLength: 2, pattern: "^[A-Z]" },
      },
    };
    const paths = extractReferencedPaths(schema);
    expect(paths).toContain("/age");
    expect(paths).toContain("/name");
  });

  it("deduplicates paths", () => {
    const schema: Schema = {
      allOf: [
        { properties: { foo: { type: "string" } } },
        { properties: { foo: { minLength: 1 } } },
      ],
    };
    const paths = extractReferencedPaths(schema);
    expect(paths.filter((p) => p === "/foo").length).toBe(1);
  });

  it("extracts paths from dependentSchemas", () => {
    const schema: Schema = {
      dependentSchemas: {
        creditCard: {
          properties: {
            billingAddress: { type: "string" },
          },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // Should include the trigger property
    expect(paths).toContain("/creditCard");
    // Should include properties from the dependent schema
    expect(paths).toContain("/billingAddress");
  });

  it("extracts paths from contains", () => {
    const schema: Schema = {
      contains: {
        properties: {
          id: { type: "number" },
        },
      },
    };
    const paths = extractReferencedPaths(schema);
    // contains means dependency on the array itself
    expect(paths).toContain("/");
    expect(paths).toContain("/id");
  });
});

describe("resolveEffectiveSchema", () => {
  const validator = new Validator();

  it("resolves simple schema", () => {
    const schema: Schema = { type: "string" };
    const res = resolveEffectiveSchema(validator, schema, "hello", "#", "");
    expect(res.effectiveSchema).toEqual(schema);
    expect(res.type).toBe("string");
    expect(res.error).toBeUndefined();
  });

  it("resolves if-then-else (then case)", () => {
    const schema: Schema = {
      if: { properties: { type: { const: "A" } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
    };
    const value = { type: "A", value: "test" };
    const res = resolveEffectiveSchema(validator, schema, value, "#", "");
    expect(res.effectiveSchema.properties?.value).toEqual({ type: "string" });
  });

  it("resolves if-then-else (else case)", () => {
    const schema: Schema = {
      if: { properties: { type: { const: "A" } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
    };
    const value = { type: "B", value: 123 };
    const res = resolveEffectiveSchema(validator, schema, value, "#", "");
    expect(res.effectiveSchema.properties?.value).toEqual({ type: "number" });
  });

  it("resolves allOf", () => {
    const schema: Schema = {
      allOf: [
        { properties: { a: { type: "string" } } },
        { properties: { b: { type: "number" } } },
      ],
    };
    const res = resolveEffectiveSchema(validator, schema, {}, "#", "");
    expect(res.effectiveSchema.properties?.a).toBeDefined();
    expect(res.effectiveSchema.properties?.b).toBeDefined();
  });

  it("resolves anyOf", () => {
    const schema: Schema = {
      anyOf: [{ type: "string" }, { type: "number" }],
    };
    const res = resolveEffectiveSchema(validator, schema, "test", "#", "");
    expect(res.effectiveSchema.type).toBe("string");
  });

  it("handles type mismatch", () => {
    const schema: Schema = { type: "string" };
    const res = resolveEffectiveSchema(validator, schema, 123, "#", "");
    expect(res.type).toBe("string");
    expect(res.error).toBeDefined();
    expect(res.error?.valid).toBe(false);
    expect(res.error?.errors?.[0].error).toContain("must be string");
  });
});

describe("resolveRef", () => {
  it("resolves basic $defs reference", () => {
    const rootSchema: Schema = {
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
        },
      },
    };
    const resolved = resolveRef("#/$defs/Address", rootSchema);
    expect(resolved).toBeDefined();
    expect(resolved?.type).toBe("object");
    expect(resolved?.properties?.street).toEqual({ type: "string" });
  });

  it("resolves nested path reference", () => {
    const rootSchema: Schema = {
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
      },
    };
    const resolved = resolveRef("#/properties/user", rootSchema);
    expect(resolved?.type).toBe("object");
    expect(resolved?.properties?.name).toEqual({ type: "string" });
  });

  it("returns undefined for external refs", () => {
    const rootSchema: Schema = {};
    const resolved = resolveRef("https://example.com/schema.json", rootSchema);
    expect(resolved).toBeUndefined();
  });

  it("returns undefined for non-existent ref", () => {
    const rootSchema: Schema = { $defs: {} };
    const resolved = resolveRef("#/$defs/NonExistent", rootSchema);
    expect(resolved).toBeUndefined();
  });

  it("detects circular references", () => {
    const rootSchema: Schema = {
      $defs: {
        Circular: {
          $ref: "#/$defs/Circular",
        },
      },
    };
    const resolved = resolveRef("#/$defs/Circular", rootSchema);
    expect(resolved).toBeUndefined();
  });

  it("resolves reference to root schema", () => {
    const rootSchema: Schema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    const resolved = resolveRef("#", rootSchema);
    expect(resolved).toBe(rootSchema);
  });
});

describe("dereferenceSchema", () => {
  it("returns schema unchanged if no $ref", () => {
    const rootSchema: Schema = {};
    const schema: Schema = { type: "string" };
    const result = dereferenceSchema(schema, rootSchema);
    expect(result).toEqual(schema);
  });

  it("resolves $ref and merges with siblings", () => {
    const rootSchema: Schema = {
      $defs: {
        Base: {
          type: "string",
          minLength: 1,
        },
      },
    };
    const schema: Schema = {
      $ref: "#/$defs/Base",
      description: "A name field",
    };
    const result = dereferenceSchema(schema, rootSchema);
    expect(result.type).toBe("string");
    expect(result.minLength).toBe(1);
    expect(result.description).toBe("A name field");
    expect(result.$ref).toBeUndefined();
  });

  it("handles unresolvable $ref gracefully", () => {
    const rootSchema: Schema = {};
    const schema: Schema = {
      $ref: "#/$defs/Missing",
      title: "Some title",
    };
    const result = dereferenceSchema(schema, rootSchema);
    expect(result.title).toBe("Some title");
    expect(result.$ref).toBeUndefined();
  });
});

describe("dereferenceSchemaDeep", () => {
  it("resolves all $refs in nested properties", () => {
    const rootSchema: Schema = {
      $defs: {
        Name: { type: "string", minLength: 1 },
        Age: { type: "integer", minimum: 0 },
      },
      type: "object",
      properties: {
        name: { $ref: "#/$defs/Name" },
        age: { $ref: "#/$defs/Age" },
      },
    };
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.properties?.name.type).toBe("string");
    expect(result.properties?.name.minLength).toBe(1);
    expect(result.properties?.name.$ref).toBeUndefined();
    expect(result.properties?.age.type).toBe("integer");
    expect(result.properties?.age.minimum).toBe(0);
  });

  it("resolves $refs in array items", () => {
    const rootSchema: Schema = {
      $defs: {
        Item: { type: "object", properties: { id: { type: "number" } } },
      },
      type: "array",
      items: { $ref: "#/$defs/Item" },
    };
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.items?.type).toBe("object");
    expect(result.items?.properties?.id).toEqual({ type: "number" });
    expect(result.items?.$ref).toBeUndefined();
  });

  it("resolves $refs in allOf/anyOf/oneOf", () => {
    const rootSchema: Schema = {
      $defs: {
        StringType: { type: "string" },
        NumberType: { type: "number" },
      },
      oneOf: [{ $ref: "#/$defs/StringType" }, { $ref: "#/$defs/NumberType" }],
    };
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.oneOf?.[0].type).toBe("string");
    expect(result.oneOf?.[1].type).toBe("number");
  });

  it("resolves $refs in if/then/else", () => {
    const rootSchema: Schema = {
      $defs: {
        TypeA: { properties: { valueA: { type: "string" } } },
        TypeB: { properties: { valueB: { type: "number" } } },
      },
      if: { properties: { type: { const: "A" } } },
      then: { $ref: "#/$defs/TypeA" },
      else: { $ref: "#/$defs/TypeB" },
    };
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.then?.properties?.valueA).toEqual({ type: "string" });
    expect(result.else?.properties?.valueB).toEqual({ type: "number" });
  });

  it("handles deeply nested $refs", () => {
    const rootSchema: Schema = {
      $defs: {
        Inner: { type: "string" },
        Outer: {
          type: "object",
          properties: {
            inner: { $ref: "#/$defs/Inner" },
          },
        },
      },
      type: "object",
      properties: {
        outer: { $ref: "#/$defs/Outer" },
      },
    };
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.properties?.outer.type).toBe("object");
    expect(result.properties?.outer.properties?.inner.type).toBe("string");
  });

  it("handles circular references without infinite loop", () => {
    // Schema where Node references itself via children
    const rootSchema: Schema = {
      $defs: {
        Node: {
          type: "object",
          properties: {
            value: { type: "string" },
            children: {
              type: "array",
              items: { $ref: "#/$defs/Node" },
            },
          },
        },
      },
      $ref: "#/$defs/Node",
    };
    // Should not throw or hang
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.type).toBe("object");
    expect(result.properties?.value?.type).toBe("string");
    expect(result.properties?.children?.type).toBe("array");
  });

  it("handles mutually recursive schemas", () => {
    // A references B, B references A
    const rootSchema: Schema = {
      $defs: {
        A: {
          type: "object",
          properties: {
            b: { $ref: "#/$defs/B" },
          },
        },
        B: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
          },
        },
      },
      $ref: "#/$defs/A",
    };
    // Should not throw or hang
    const result = dereferenceSchemaDeep(rootSchema, rootSchema);
    expect(result.type).toBe("object");
    expect(result.properties?.b?.type).toBe("object");
  });
});

describe("mergeSchema", () => {
  it("merges items", () => {
    const base: Schema = { items: { type: "string" } };
    const override: Schema = { items: { minLength: 5 } };
    const merged = mergeSchema(base, override);
    expect(merged.items).toMatchObject({ type: "string", minLength: 5 });
  });

  it("intersects types", () => {
    const base: Schema = { type: ["string", "number"] };
    const override: Schema = { type: "string" };
    const merged = mergeSchema(base, override);
    expect(merged.type).toBe("string");
  });

  it("merges prefixItems", () => {
    const base: Schema = { prefixItems: [{ type: "string" }] };
    const override: Schema = {
      prefixItems: [{ minLength: 5 }, { type: "number" }],
    };
    const merged = mergeSchema(base, override);
    expect(merged.prefixItems).toHaveLength(2);
    expect(merged.prefixItems![0]).toMatchObject({
      type: "string",
      minLength: 5,
    });
    expect(merged.prefixItems![1]).toMatchObject({ type: "number" });
  });
  it("returns base schema when override is missing", () => {
    const base: Schema = { type: "string" };
    expect(mergeSchema(base)).toEqual(base);
    expect(mergeSchema(base, undefined)).toEqual(base);
  });
});

describe("getSubSchema", () => {
  it("returns schema for object properties", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };
    const result = getSubSchema(schema, "name");
    expect(result.schema).toEqual({ type: "string" });
    expect(result.keywordLocationToken).toBe("properties/name");
  });

  it("returns schema for patternProperties", () => {
    const schema: Schema = {
      type: "object",
      patternProperties: {
        "^S_": { type: "string" },
        "^I_": { type: "integer" },
      },
    };
    const result = getSubSchema(schema, "S_name");
    expect(result.schema).toEqual({ type: "string" });
    expect(result.keywordLocationToken).toBe("patternProperties/^S_");

    const result2 = getSubSchema(schema, "I_count");
    expect(result2.schema).toEqual({ type: "integer" });
    expect(result2.keywordLocationToken).toBe("patternProperties/^I_");
  });

  it("returns schema for additionalProperties (object)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: { type: "number" },
    };
    const result = getSubSchema(schema, "unknownKey");
    expect(result.schema).toEqual({ type: "number" });
    expect(result.keywordLocationToken).toBe("additionalProperties");
  });

  it("returns empty schema for additionalProperties: true", () => {
    const schema: Schema = {
      type: "object",
      additionalProperties: true,
    };
    const result = getSubSchema(schema, "anyKey");
    expect(result.schema).toEqual({});
    expect(result.keywordLocationToken).toBe("additionalProperties");
  });

  it("returns empty schema when additionalProperties: false and key not found", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: false,
    };
    const result = getSubSchema(schema, "unknownKey");
    expect(result.schema).toEqual({});
    expect(result.keywordLocationToken).toBe("");
  });

  it("returns schema for array prefixItems", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: "boolean" },
    };
    const result0 = getSubSchema(schema, "0");
    expect(result0.schema).toEqual({ type: "string" });
    expect(result0.keywordLocationToken).toBe("prefixItems/0");

    const result1 = getSubSchema(schema, "1");
    expect(result1.schema).toEqual({ type: "number" });
    expect(result1.keywordLocationToken).toBe("prefixItems/1");
  });

  it("returns schema for array items (beyond prefixItems)", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }],
      items: { type: "boolean" },
    };
    const result = getSubSchema(schema, "5");
    expect(result.schema).toEqual({ type: "boolean" });
    expect(result.keywordLocationToken).toBe("items");
  });

  it("returns schema for array items (no prefixItems)", () => {
    const schema: Schema = {
      type: "array",
      items: { type: "number" },
    };
    const result = getSubSchema(schema, "0");
    expect(result.schema).toEqual({ type: "number" });
    expect(result.keywordLocationToken).toBe("items");
  });

  it("prioritizes properties over patternProperties", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        S_name: { type: "string", description: "from properties" },
      },
      patternProperties: {
        "^S_": { type: "string", description: "from pattern" },
      },
    };
    const result = getSubSchema(schema, "S_name");
    expect(result.schema.description).toBe("from properties");
    expect(result.keywordLocationToken).toBe("properties/S_name");
  });

  it("prioritizes patternProperties over additionalProperties", () => {
    const schema: Schema = {
      type: "object",
      patternProperties: {
        "^S_": { type: "string" },
      },
      additionalProperties: { type: "number" },
    };
    const result = getSubSchema(schema, "S_name");
    expect(result.schema).toEqual({ type: "string" });
    expect(result.keywordLocationToken).toBe("patternProperties/^S_");

    const result2 = getSubSchema(schema, "other");
    expect(result2.schema).toEqual({ type: "number" });
    expect(result2.keywordLocationToken).toBe("additionalProperties");
  });

  it("returns empty schema for non-numeric key on array", () => {
    const schema: Schema = {
      type: "array",
      items: { type: "string" },
    };
    const result = getSubSchema(schema, "notAnIndex");
    expect(result.schema).toEqual({});
    expect(result.keywordLocationToken).toBe("");
  });

  it("returns empty schema when no matching schema found", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };
    const result = getSubSchema(schema, "unknownKey");
    expect(result.schema).toEqual({});
    expect(result.keywordLocationToken).toBe("");
  });
});

describe("getDefaultValue", () => {
  it("returns const value if defined", () => {
    expect(getDefaultValue({ const: "fixed" })).toBe("fixed");
    expect(getDefaultValue({ const: 42 })).toBe(42);
    expect(getDefaultValue({ const: true })).toBe(true);
    expect(getDefaultValue({ const: null })).toBe(null);
  });

  it("returns default value if defined", () => {
    expect(getDefaultValue({ type: "string", default: "hello" })).toBe("hello");
    expect(getDefaultValue({ type: "number", default: 42 })).toBe(42);
  });

  it("prioritizes const over default", () => {
    expect(getDefaultValue({ const: "const", default: "default" })).toBe(
      "const",
    );
  });

  it("returns empty string for string type", () => {
    expect(getDefaultValue({ type: "string" })).toBe("");
  });

  it("returns 0 for number type", () => {
    expect(getDefaultValue({ type: "number" })).toBe(0);
  });

  it("returns 0 for integer type", () => {
    expect(getDefaultValue({ type: "integer" })).toBe(0);
  });

  it("returns false for boolean type", () => {
    expect(getDefaultValue({ type: "boolean" })).toBe(false);
  });

  it("returns null for null type", () => {
    expect(getDefaultValue({ type: "null" })).toBe(null);
  });

  it("returns empty array for array type", () => {
    expect(getDefaultValue({ type: "array" })).toEqual([]);
    expect(
      getDefaultValue({ type: "array", items: { type: "string" } }),
    ).toEqual([]);
  });

  it("returns empty object for object type without properties", () => {
    expect(getDefaultValue({ type: "object" })).toEqual({});
  });

  it("returns object with required properties initialized", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["name", "age"],
    };
    expect(getDefaultValue(schema)).toEqual({ name: "", age: 0 });
  });

  it("does not include optional properties", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        required: { type: "string" },
        optional: { type: "string" },
      },
      required: ["required"],
    };
    const result = getDefaultValue(schema) as Record<string, unknown>;
    expect(result).toHaveProperty("required");
    expect(result).not.toHaveProperty("optional");
  });

  it("handles nested objects", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
      required: ["user"],
    };
    expect(getDefaultValue(schema)).toEqual({ user: { name: "" } });
  });

  it("uses first type if type is an array", () => {
    expect(getDefaultValue({ type: ["string", "number"] })).toBe("");
    expect(getDefaultValue({ type: ["number", "string"] })).toBe(0);
  });

  it("infers object type from properties", () => {
    const schema: Schema = {
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    expect(getDefaultValue(schema)).toEqual({ name: "" });
  });

  it("returns undefined for unknown type", () => {
    expect(getDefaultValue({})).toBeUndefined();
  });

  it("handles default value for nested required property", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        status: { type: "string", default: "active" },
      },
      required: ["status"],
    };
    expect(getDefaultValue(schema)).toEqual({ status: "active" });
  });
});
