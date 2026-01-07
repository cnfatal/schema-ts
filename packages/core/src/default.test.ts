import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import { getDefaultValue } from "./default";

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
    expect(getDefaultValue({ type: "string" }, { strategy: "always" })).toBe(
      "",
    );
  });

  it("returns 0 for number type", () => {
    expect(getDefaultValue({ type: "number" }, { strategy: "always" })).toBe(0);
  });

  it("returns 0 for integer type", () => {
    expect(getDefaultValue({ type: "integer" }, { strategy: "always" })).toBe(
      0,
    );
  });

  it("returns false for boolean type", () => {
    expect(getDefaultValue({ type: "boolean" }, { strategy: "always" })).toBe(
      false,
    );
  });

  it("returns null for null type", () => {
    expect(getDefaultValue({ type: "null" }, { strategy: "always" })).toBe(
      null,
    );
  });

  it("returns empty array for array type", () => {
    expect(getDefaultValue({ type: "array" }, { strategy: "always" })).toEqual(
      [],
    );
    expect(
      getDefaultValue(
        { type: "array", items: { type: "string" } },
        { strategy: "always" },
      ),
    ).toEqual([]);
  });

  it("returns empty object for object type without properties", () => {
    expect(getDefaultValue({ type: "object" }, { strategy: "always" })).toEqual(
      {},
    );
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
    expect(getDefaultValue(schema, { strategy: "always" })).toEqual({
      name: "",
      age: 0,
    });
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
    const result = getDefaultValue(schema, { strategy: "always" }) as Record<
      string,
      unknown
    >;
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
    expect(getDefaultValue(schema, { strategy: "always" })).toEqual({
      user: { name: "" },
    });
  });

  it("uses first type if type is an array", () => {
    expect(
      getDefaultValue({ type: ["string", "number"] }, { strategy: "always" }),
    ).toBe("");
    expect(
      getDefaultValue({ type: ["number", "string"] }, { strategy: "always" }),
    ).toBe(0);
  });

  it("infers object type from properties", () => {
    const schema: Schema = {
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    expect(getDefaultValue(schema, { strategy: "always" })).toEqual({
      name: "",
    });
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
    expect(getDefaultValue(schema, { strategy: "always" })).toEqual({
      status: "active",
    });
  });

  it("returns default values for prefixItems in array", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number", default: 10 }],
    };
    expect(getDefaultValue(schema, { strategy: "always" })).toEqual(["", 10]);
  });

  it("returns default value if input is undefined (with value arg)", () => {
    expect(getDefaultValue({ type: "string" }, { strategy: "always" })).toBe(
      "",
    );
    expect(
      getDefaultValue(
        {
          type: "object",
          properties: { a: { type: "string" } },
          required: ["a"],
        },
        { strategy: "always" },
      ),
    ).toEqual({ a: "" });
  });

  it("fills missing required properties in object", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        a: { type: "string", default: "default" },
        b: { type: "number" },
      },
      required: ["a"],
    };
    expect(getDefaultValue(schema, { value: {} })).toEqual({ a: "default" });
    expect(getDefaultValue(schema, { value: { b: 1 } })).toEqual({
      a: "default",
      b: 1,
    });
  });

  it("recursively fills defaults", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            x: { type: "string", default: "x" },
          },
          required: ["x"],
        },
      },
      required: ["nested"],
    };
    expect(getDefaultValue(schema, { value: {}, strategy: "always" })).toEqual({
      nested: { x: "x" },
    });
    expect(
      getDefaultValue(schema, { value: { nested: {} }, strategy: "always" }),
    ).toEqual({
      nested: { x: "x" },
    });
  });

  it("fills defaults in array items", () => {
    const schema: Schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          a: { type: "string", default: "filled" },
        },
        required: ["a"],
      },
    };
    expect(getDefaultValue(schema, { value: [{}, { a: "exists" }] })).toEqual([
      { a: "filled" },
      { a: "exists" },
    ]);
  });

  it("fills defaults in tuple items (prefixItems)", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [
        {
          type: "object",
          properties: { a: { type: "string", default: "A" } },
          required: ["a"],
        },
        {
          type: "object",
          properties: { b: { type: "string", default: "B" } },
          required: ["b"],
        },
      ],
    };
    expect(getDefaultValue(schema, { value: [{}, {}] })).toEqual([
      { a: "A" },
      { b: "B" },
    ]);
  });
});
