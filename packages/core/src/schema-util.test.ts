import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import {
  resolveRef,
  dereferenceSchema,
  dereferenceSchemaDeep,
  getSubSchema,
} from "./schema-util";

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
