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
    expect(res1.effectiveSchema.properties?.value).toEqual({ type: "string" });

    const value2 = { type: "A", subType: "A2", value: 123 };
    const res2 = resolveEffectiveSchema(validator, schema, value2, "#", "");
    expect(res2.effectiveSchema.properties?.value).toEqual({ type: "number" });
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
    expect(resA.effectiveSchema.properties?.value).toEqual({ type: "string" });

    const valueB = { type: "B" };
    const resB = resolveEffectiveSchema(validator, schema, valueB, "#", "");
    expect(resB.effectiveSchema.properties?.value).toEqual({ type: "string" });

    const valueC = { type: "C" };
    const resC = resolveEffectiveSchema(validator, schema, valueC, "#", "");
    expect(resC.effectiveSchema.properties?.value).toEqual({ type: "number" });
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
