import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import { resolveEffectiveSchema, mergeSchema } from "./effective";
import { Validator } from "./validate";

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
    expect(res.effectiveSchema.properties?.value).toMatchObject({
      type: "string",
    });
    // Verify x-origin-keyword is set correctly
    expect(res.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/then/properties/value",
    );
  });

  it("resolves if-then-else (else case)", () => {
    const schema: Schema = {
      if: { properties: { type: { const: "A" } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
    };
    const value = { type: "B", value: 123 };
    const res = resolveEffectiveSchema(validator, schema, value, "#", "");
    expect(res.effectiveSchema.properties?.value).toMatchObject({
      type: "number",
    });
    // Verify x-origin-keyword is set correctly
    expect(res.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/else/properties/value",
    );
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
    const res = resolveEffectiveSchema(validator, schema, 123, "#", "", true);
    expect(res.type).toBe("string");
    expect(res.error).toBeDefined();
    expect(res.error?.valid).toBe(false);
    expect(res.error?.errors?.[0].error).toContain("must be string");
  });

  it("resolves nested if-then-else", () => {
    const schema: Schema = {
      if: { properties: { type: { const: "A" } } },
      then: {
        if: { properties: { subType: { const: "A1" } } },
        then: { properties: { value: { type: "string" } } },
        else: { properties: { value: { type: "number" } } },
      },
    };

    const value1 = { type: "A", subType: "A1", value: "test" };
    const res1 = resolveEffectiveSchema(validator, schema, value1, "#", "");
    expect(res1.effectiveSchema.properties?.value).toMatchObject({
      type: "string",
    });
    // The nested then is resolved at #/then level, so the origin tracks from there
    expect(res1.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/then/properties/value",
    );

    const value2 = { type: "A", subType: "A2", value: 123 };
    const res2 = resolveEffectiveSchema(validator, schema, value2, "#", "");
    expect(res2.effectiveSchema.properties?.value).toMatchObject({
      type: "number",
    });
    expect(res2.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/then/properties/value",
    );
  });

  it("resolves if-then-else inside allOf", () => {
    const schema: Schema = {
      allOf: [
        {
          if: { properties: { type: { const: "A" } } },
          then: { properties: { a: { type: "string" } } },
        },
        {
          if: { properties: { type: { const: "A" } } },
          then: { properties: { b: { type: "number" } } },
        },
      ],
    };
    const value = { type: "A" };
    const res = resolveEffectiveSchema(validator, schema, value, "#", "");
    expect(res.effectiveSchema.properties?.a).toBeDefined();
    expect(res.effectiveSchema.properties?.b).toBeDefined();
  });

  it("resolves if-enum-then", () => {
    const schema: Schema = {
      if: { properties: { type: { enum: ["A", "B"] } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
    };

    const valueA = { type: "A" };
    const resA = resolveEffectiveSchema(validator, schema, valueA, "#", "");
    expect(resA.effectiveSchema.properties?.value).toMatchObject({
      type: "string",
    });
    expect(resA.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/then/properties/value",
    );

    const valueB = { type: "B" };
    const resB = resolveEffectiveSchema(validator, schema, valueB, "#", "");
    expect(resB.effectiveSchema.properties?.value).toMatchObject({
      type: "string",
    });

    const valueC = { type: "C" };
    const resC = resolveEffectiveSchema(validator, schema, valueC, "#", "");
    expect(resC.effectiveSchema.properties?.value).toMatchObject({
      type: "number",
    });
    expect(resC.effectiveSchema.properties?.value?.["x-origin-keyword"]).toBe(
      "#/else/properties/value",
    );
  });

  describe("optional undefined values", () => {
    it("resolves allOf for optional undefined value", () => {
      const schema: Schema = {
        allOf: [{ type: "string" }, { minLength: 1 }],
      };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        false,
      );
      expect(res.effectiveSchema.type).toBe("string");
      expect(res.effectiveSchema.minLength).toBe(1);
      expect(res.type).toBe("string");
      expect(res.error).toBeUndefined();
    });

    it("resolves if-then-else for optional undefined value", () => {
      const schema: Schema = {
        if: { properties: { mode: { const: "advanced" } } },
        then: { properties: { extra: { type: "string" } } },
        else: { properties: { simple: { type: "boolean" } } },
      };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        false,
      );
      // For undefined value, properties check passes (no properties to validate)
      // so it goes to `then` branch
      expect(res.effectiveSchema.properties?.extra).toMatchObject({
        type: "string",
      });
      expect(res.effectiveSchema.properties?.extra?.["x-origin-keyword"]).toBe(
        "#/then/properties/extra",
      );
      expect(res.error).toBeUndefined();
    });

    it("resolves if-then-else else branch for optional undefined value", () => {
      const schema: Schema = {
        // undefined fails type: "object", so it goes to else branch
        if: { type: "object" },
        then: { properties: { extra: { type: "string" } } },
        else: { properties: { simple: { type: "boolean" } } },
      };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        false,
      );
      // undefined is not an object, so it goes to `else` branch
      expect(res.effectiveSchema.properties?.simple).toMatchObject({
        type: "boolean",
      });
      expect(res.effectiveSchema.properties?.simple?.["x-origin-keyword"]).toBe(
        "#/else/properties/simple",
      );
      expect(res.error).toBeUndefined();
    });

    it("resolves anyOf for optional undefined value", () => {
      const schema: Schema = {
        anyOf: [
          { type: "string", minLength: 1 },
          { type: "number", minimum: 0 },
        ],
      };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        false,
      );
      // Should still resolve the schema structure
      expect(res.effectiveSchema).toBeDefined();
      expect(res.error).toBeUndefined();
    });

    it("resolves complex nested schema for optional undefined value", () => {
      const schema: Schema = {
        allOf: [
          { type: "object" },
          {
            // undefined fails type: "object"
            if: { type: "object" },
            then: { properties: { config: { type: "object" } } },
            else: { properties: { reason: { type: "string" } } },
          },
        ],
      };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        false,
      );
      expect(res.effectiveSchema.type).toBe("object");
      // undefined fails the if condition, so else branch is applied
      expect(res.effectiveSchema.properties?.reason).toMatchObject({
        type: "string",
      });
      // The origin is #/allOf/1/properties/reason because the if-then-else
      // is resolved within allOf/1 context
      expect(res.effectiveSchema.properties?.reason?.["x-origin-keyword"]).toBe(
        "#/allOf/1/properties/reason",
      );
      expect(res.error).toBeUndefined();
    });

    it("returns validation error for required undefined value", () => {
      const schema: Schema = { type: "string" };
      const res = resolveEffectiveSchema(
        validator,
        schema,
        undefined,
        "#",
        "",
        true,
      );
      expect(res.type).toBe("string");
      expect(res.error).toBeDefined();
    });
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
