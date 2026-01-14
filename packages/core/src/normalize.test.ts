import { describe, expect, it } from "vitest";
import { normalizeSchema, BetterNormalizer } from "./normalize";
import { detectSchemaDraft } from "./version";
import { validateSchema } from "./validate";
import type { Schema } from "./type";

describe("detectSchemaDraft", () => {
  it("detects draft-2020-12 from $schema", () => {
    expect(
      detectSchemaDraft({
        $schema: "https://json-schema.org/draft/2020-12/schema",
      }),
    ).toBe("draft-2020-12");
  });

  it("detects draft-2019-09 from $schema", () => {
    expect(
      detectSchemaDraft({
        $schema: "https://json-schema.org/draft/2019-09/schema",
      }),
    ).toBe("draft-2019-09");
  });

  it("detects draft-07 from $schema", () => {
    expect(
      detectSchemaDraft({
        $schema: "http://json-schema.org/draft-07/schema#",
      }),
    ).toBe("draft-07");
  });

  it("detects draft-04 from $schema", () => {
    expect(
      detectSchemaDraft({
        $schema: "http://json-schema.org/draft-04/schema#",
      }),
    ).toBe("draft-04");
  });

  it("detects draft-04 from id keyword", () => {
    expect(detectSchemaDraft({ id: "http://example.com/schema" })).toBe(
      "draft-04",
    );
  });

  it("detects draft-04 from boolean exclusiveMaximum", () => {
    expect(detectSchemaDraft({ maximum: 10, exclusiveMaximum: true })).toBe(
      "draft-04",
    );
  });

  it("detects draft-2019-09 from $recursiveRef", () => {
    expect(detectSchemaDraft({ $recursiveRef: "#" })).toBe("draft-2019-09");
  });

  it("detects draft-2020-12 from prefixItems", () => {
    expect(detectSchemaDraft({ prefixItems: [{ type: "string" }] })).toBe(
      "draft-2020-12",
    );
  });

  it("defaults to draft-2020-12 when no distinguishing features", () => {
    expect(detectSchemaDraft({ type: "string" })).toBe("draft-2020-12");
  });
});

describe("normalizeSchema", () => {
  describe("draft-04 normalization", () => {
    it("converts id to $id", () => {
      const schema = { id: "http://example.com/schema" };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.$id).toBe("http://example.com/schema");
      expect("id" in normalized).toBe(false);
    });

    it("converts boolean exclusiveMaximum to numeric", () => {
      const schema = {
        maximum: 10,
        exclusiveMaximum: true,
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.exclusiveMaximum).toBe(10);
      expect("maximum" in normalized).toBe(false);
    });

    it("converts boolean exclusiveMinimum to numeric", () => {
      const schema = {
        minimum: 5,
        exclusiveMinimum: true,
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.exclusiveMinimum).toBe(5);
      expect("minimum" in normalized).toBe(false);
    });

    it("removes false boolean exclusive values", () => {
      const schema = {
        maximum: 10,
        exclusiveMaximum: false,
        minimum: 0,
        exclusiveMinimum: false,
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.maximum).toBe(10);
      expect(normalized.minimum).toBe(0);
      expect("exclusiveMaximum" in normalized).toBe(false);
      expect("exclusiveMinimum" in normalized).toBe(false);
    });
  });

  describe("draft-07 normalization", () => {
    it("converts array items to prefixItems", () => {
      const schema = {
        items: [{ type: "string" }, { type: "number" }],
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-07" });
      expect(normalized.prefixItems).toEqual([
        { type: "string" },
        { type: "number" },
      ]);
      expect("items" in normalized).toBe(false);
    });

    it("converts array items + additionalItems to prefixItems + items", () => {
      const schema = {
        items: [{ type: "string" }],
        additionalItems: { type: "number" },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-07" });
      expect(normalized.prefixItems).toEqual([{ type: "string" }]);
      expect(normalized.items).toEqual({ type: "number" });
      expect("additionalItems" in normalized).toBe(false);
    });

    it("converts dependencies with string array to dependentRequired", () => {
      const schema = {
        dependencies: {
          credit_card: ["billing_address"],
        },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-07" });
      expect(normalized.dependentRequired).toEqual({
        credit_card: ["billing_address"],
      });
      expect("dependencies" in normalized).toBe(false);
    });

    it("converts dependencies with schema to dependentSchemas", () => {
      const schema = {
        dependencies: {
          credit_card: {
            properties: {
              billing_address: { type: "string" },
            },
          },
        },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-07" });
      expect(normalized.dependentSchemas).toEqual({
        credit_card: {
          properties: {
            billing_address: { type: "string" },
          },
        },
      });
      expect("dependencies" in normalized).toBe(false);
    });

    it("handles mixed dependencies (array and schema)", () => {
      const schema = {
        dependencies: {
          credit_card: ["billing_address"],
          name: { required: ["email"] },
        },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-07" });
      expect(normalized.dependentRequired).toEqual({
        credit_card: ["billing_address"],
      });
      expect(normalized.dependentSchemas).toEqual({
        name: { required: ["email"] },
      });
    });
  });

  describe("draft-2019-09 normalization", () => {
    it("converts $recursiveRef to $dynamicRef", () => {
      const schema = { $recursiveRef: "#" };
      const normalized = normalizeSchema(schema, {
        sourceDraft: "draft-2019-09",
      });
      expect(normalized.$dynamicRef).toBe("#recursiveAnchor");
      expect("$recursiveRef" in normalized).toBe(false);
    });

    it("converts $recursiveAnchor to $dynamicAnchor", () => {
      const schema = { $recursiveAnchor: true };
      const normalized = normalizeSchema(schema, {
        sourceDraft: "draft-2019-09",
      });
      expect(normalized.$dynamicAnchor).toBe("recursiveAnchor");
      expect("$recursiveAnchor" in normalized).toBe(false);
    });
  });

  describe("nested schema normalization", () => {
    it("normalizes properties", () => {
      const schema = {
        type: "object",
        properties: {
          age: {
            maximum: 100,
            exclusiveMaximum: true,
          },
        },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.properties?.age.exclusiveMaximum).toBe(100);
    });

    it("normalizes allOf/anyOf/oneOf", () => {
      const schema = {
        allOf: [{ id: "http://example.com/a" }],
        anyOf: [{ id: "http://example.com/b" }],
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.allOf?.[0].$id).toBe("http://example.com/a");
      expect(normalized.anyOf?.[0].$id).toBe("http://example.com/b");
    });

    it("normalizes definitions to $defs", () => {
      const schema = {
        definitions: {
          address: { type: "object" },
        },
      };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.$defs?.address).toEqual({ type: "object" });
      expect("definitions" in normalized).toBe(false);
    });
  });

  describe("validation after normalization", () => {
    it("validates draft-04 tuple schema after normalization", () => {
      // Draft-04 style tuple
      const draft04Schema = {
        $schema: "http://json-schema.org/draft-04/schema#",
        items: [{ type: "string" }, { type: "number" }],
        additionalItems: false,
      };

      const normalized = normalizeSchema(draft04Schema);

      // Should validate correctly
      expect(validateSchema(normalized, ["hello", 42]).valid).toBe(true);
      expect(validateSchema(normalized, ["hello", "world"]).valid).toBe(false);
    });

    it("validates draft-07 dependencies after normalization", () => {
      const draft07Schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          credit_card: { type: "string" },
          billing_address: { type: "string" },
        },
        dependencies: {
          credit_card: ["billing_address"],
        },
      };

      const normalized = normalizeSchema(draft07Schema);

      expect(
        validateSchema(normalized, {
          credit_card: "1234",
          billing_address: "123 Main St",
        }).valid,
      ).toBe(true);
      expect(validateSchema(normalized, { credit_card: "1234" }).valid).toBe(
        false,
      );
      expect(validateSchema(normalized, { name: "John" }).valid).toBe(true);
    });

    it("validates draft-04 exclusive bounds after normalization", () => {
      const draft04Schema = {
        $schema: "http://json-schema.org/draft-04/schema#",
        type: "number",
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: true,
        exclusiveMaximum: true,
      };

      const normalized = normalizeSchema(draft04Schema);

      expect(validateSchema(normalized, 50).valid).toBe(true);
      expect(validateSchema(normalized, 0).valid).toBe(false); // exclusive
      expect(validateSchema(normalized, 100).valid).toBe(false); // exclusive
      expect(validateSchema(normalized, 1).valid).toBe(true);
      expect(validateSchema(normalized, 99).valid).toBe(true);
    });
  });

  describe("boolean schemas", () => {
    it("normalizes true to empty object", () => {
      expect(normalizeSchema(true)).toEqual({});
    });

    it("normalizes false to { not: {} }", () => {
      expect(normalizeSchema(false)).toEqual({ not: {} });
    });
  });

  describe("OpenAPI/extenstion keywords", () => {
    it("converts nullable: true for string", () => {
      const schema = { type: "string", nullable: true } as any;
      const normalized = normalizeSchema(schema);
      expect(normalized.type).toEqual(["string", "null"]);
    });

    it("converts nullable: true for array type", () => {
      const schema = { type: ["string", "number"], nullable: true } as any;
      const normalized = normalizeSchema(schema);
      expect(normalized.type).toEqual(["string", "number", "null"]);
    });

    it("converts example to examples", () => {
      const schema = { type: "string", example: "hello" } as any;
      const normalized = normalizeSchema(schema);
      expect(normalized.examples).toEqual(["hello"]);
    });
  });

  describe("other transformations", () => {
    it("converts single-item enum to const", () => {
      const schema = { enum: ["fixed"] };
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.const).toBe("fixed");
    });

    it("removes siblings of $ref for draft-04", () => {
      const schema = {
        $ref: "#/definitions/foo",
        description: "ignored",
      } as any;
      const normalized = normalizeSchema(schema, { sourceDraft: "draft-04" });
      expect(normalized.$ref).toBe("#/definitions/foo");
      expect(normalized.description).toBeUndefined();
    });
  });
});

describe("BetterNormalizer", () => {
  const normalizer = new BetterNormalizer();

  describe("type inference", () => {
    it("infers type: 'object' from properties", () => {
      const schema: Schema = {
        properties: {
          foo: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("object");
    });

    it("infers type: 'object' from patternProperties", () => {
      const schema: Schema = {
        patternProperties: {
          "^f": { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("object");
    });

    it("infers type: 'object' from additionalProperties", () => {
      const schema: Schema = {
        additionalProperties: { type: "string" },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("object");
    });

    it("infers type: 'array' from items", () => {
      const schema: Schema = {
        items: { type: "string" },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("array");
    });

    it("infers type: 'array' from additionalItems", () => {
      const schema: any = {
        additionalItems: { type: "string" },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("array");
    });

    it("does not overwrite existing type", () => {
      const schema: Schema = {
        type: "string",
        properties: {
          foo: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("string");
    });
  });

  describe("required inference", () => {
    it("adds properties with const to required", () => {
      const schema: Schema = {
        properties: {
          foo: { const: "bar" },
          baz: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toEqual(["foo"]);
    });

    it("does not add properties with default to required", () => {
      const schema: Schema = {
        properties: {
          foo: { default: "bar" },
          baz: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toBe(undefined);
    });

    it("adds properties with enum to required", () => {
      const schema: Schema = {
        properties: {
          foo: { enum: ["bar", "baz"] },
          qux: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toEqual(["foo"]);
    });

    it("does not add empty enum to required", () => {
      const schema: Schema = {
        properties: {
          foo: { enum: [] },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toBe(undefined);
    });

    it("adds const and enum properties to required", () => {
      const schema: Schema = {
        properties: {
          foo: { const: "bar" },
          baz: { default: "qux" },
          other: { enum: [1, 2] },
          plain: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      // default is no longer added to required
      expect(normalized.required).toEqual(["foo", "other"]);
    });

    it("does not overwrite existing required", () => {
      const schema: Schema = {
        properties: {
          foo: { const: "bar" },
        },
        required: ["other"],
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toEqual(["other"]);
    });

    it("handles missing properties", () => {
      const schema: Schema = {
        type: "object",
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toBe(undefined);
    });
  });

  describe("recursive normalization", () => {
    it("normalizes nested properties", () => {
      const schema: Schema = {
        properties: {
          nested: {
            properties: {
              foo: { const: "bar" },
            },
          },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("object");
      expect(normalized.properties?.nested.type).toBe("object");
      expect(normalized.properties?.nested.required).toEqual(["foo"]);
    });

    it("normalizes schemas in anyOf", () => {
      const schema: Schema = {
        anyOf: [
          { properties: { foo: { const: "bar" } } },
          { items: { type: "string" } },
        ],
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.anyOf?.[0].type).toBe("object");
      expect(normalized.anyOf?.[0].required).toEqual(["foo"]);
      expect(normalized.anyOf?.[1].type).toBe("array");
    });

    it("normalizes schemas in allOf", () => {
      const schema: Schema = {
        allOf: [{ properties: { foo: { const: "bar" } } }],
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.allOf?.[0].type).toBe("object");
      expect(normalized.allOf?.[0].required).toEqual(["foo"]);
    });

    it("normalizes schemas in oneOf", () => {
      const schema: Schema = {
        oneOf: [{ properties: { foo: { const: "bar" } } }],
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.oneOf?.[0].type).toBe("object");
      expect(normalized.oneOf?.[0].required).toEqual(["foo"]);
    });

    it("normalizes items and prefixItems", () => {
      const schema: Schema = {
        prefixItems: [{ properties: { foo: { const: "bar" } } }],
        items: { properties: { baz: { default: 1 } } },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.type).toBe("array");
      expect(normalized.prefixItems?.[0].type).toBe("object");
      expect(normalized.prefixItems?.[0].required).toEqual(["foo"]);
      expect((normalized.items as Schema).type).toBe("object");
      expect((normalized.items as Schema).required).toBe(undefined);
    });
  });

  describe("edge cases", () => {
    it("handles boolean schemas", () => {
      const schema = {
        properties: {
          foo: true,
          bar: false,
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.properties?.foo).toEqual({});
      expect(normalized.properties?.bar).toEqual({ not: {} });
    });

    it("normalizes dependentSchemas and forces required", () => {
      const schema: Schema = {
        dependentSchemas: {
          foo: {
            properties: {
              bar: { type: "string" },
            },
          },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.dependentSchemas?.foo.type).toBe("object");
      expect(normalized.dependentSchemas?.foo.required).toEqual(["bar"]);
    });

    it("handles discriminator property as required", () => {
      const schema: any = {
        discriminator: { propertyName: "type" },
        properties: {
          type: { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toContain("type");
    });

    it("handles x-required on properties", () => {
      const schema: any = {
        properties: {
          foo: { type: "string", "x-required": true },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.required).toContain("foo");
    });

    it("handles patternProperties and sets minProperties: 1", () => {
      const schema: Schema = {
        patternProperties: {
          "^S_": { type: "string" },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.minProperties).toBe(1);
    });

    it("handles x-kubernetes-patch-merge-key", () => {
      const schema: any = {
        type: "array",
        "x-kubernetes-patch-merge-key": "name",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "string" },
          },
        },
      };
      const normalized = normalizer.normalize(schema);
      expect((normalized.items as Schema).required).toContain("name");
    });

    it("handles null/undefined values in properties", () => {
      const schema: any = {
        properties: {
          foo: null,
        },
      };
      const normalized = normalizer.normalize(schema);
      expect(normalized.properties?.foo).toBe(undefined);
    });
  });
});
