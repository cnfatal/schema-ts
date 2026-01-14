import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import { getDefaultValue, applyDefaults } from "./default";

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
    expect(getDefaultValue({ type: "string" }, "always")).toBe("");
  });

  it("returns 0 for number type", () => {
    expect(getDefaultValue({ type: "number" }, "always")).toBe(0);
  });

  it("returns 0 for integer type", () => {
    expect(getDefaultValue({ type: "integer" }, "always")).toBe(0);
  });

  it("returns false for boolean type", () => {
    expect(getDefaultValue({ type: "boolean" }, "always")).toBe(false);
  });

  it("returns null for null type", () => {
    expect(getDefaultValue({ type: "null" }, "always")).toBe(null);
  });

  it("returns empty array for array type", () => {
    expect(getDefaultValue({ type: "array" }, "always")).toEqual([]);
    expect(
      getDefaultValue({ type: "array", items: { type: "string" } }, "always"),
    ).toEqual([]);
  });

  it("returns empty object for object type without properties", () => {
    expect(getDefaultValue({ type: "object" }, "always")).toEqual({});
  });

  it("returns object with all properties initialized when strategy is always", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["name", "age"],
    };
    expect(getDefaultValue(schema, "always")).toEqual({
      name: "",
      age: 0,
      active: false,
    });
  });

  it("returns object with only required properties when strategy is explicit", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        required: { type: "string", default: "val" },
        optional: { type: "string", default: "opt" },
      },
      required: ["required"],
    };
    const result = getDefaultValue(schema, "explicit") as Record<
      string,
      unknown
    >;
    expect(result).toHaveProperty("required", "val");
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
    expect(getDefaultValue(schema, "always")).toEqual({
      user: { name: "" },
    });
  });

  it("uses first type if type is an array", () => {
    expect(getDefaultValue({ type: ["string", "number"] }, "always")).toBe("");
    expect(getDefaultValue({ type: ["number", "string"] }, "always")).toBe(0);
  });

  it("returns undefined if type is not specified (no inference)", () => {
    const schema: Schema = {
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    expect(getDefaultValue(schema, "always")).toBeUndefined();
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
    expect(getDefaultValue(schema, "always")).toEqual({
      status: "active",
    });
  });

  it("returns default values for prefixItems in array", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number", default: 10 }],
    };
    expect(getDefaultValue(schema, "always")).toEqual(["", 10]);
  });
});

describe("applyDefaults", () => {
  it("returns default value if input is undefined", () => {
    const schema: Schema = { type: "string" };
    expect(applyDefaults("string", undefined, schema, "always")).toEqual([
      "",
      true,
    ]);
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
    expect(applyDefaults("object", {}, schema)).toEqual([
      { a: "default" },
      true,
    ]);
    expect(applyDefaults("object", { b: 1 }, schema)).toEqual([
      { a: "default", b: 1 },
      true,
    ]);
  });

  it("returns same value and false if no changes needed", () => {
    const schema: Schema = {
      type: "object",
      properties: { a: { default: 1 } },
      required: ["a"],
    };
    expect(applyDefaults("object", { a: 2 }, schema)).toEqual([
      { a: 2 },
      false,
    ]);
  });

  it("fills all properties when strategy is always", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
      },
      required: ["a"],
    };
    const [result] = applyDefaults("object", {}, schema, "always");
    expect(result).toEqual({ a: "", b: "" });
  });

  it("recursively fills defaults via getDefaultValue", () => {
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
    expect(applyDefaults("object", {}, schema, "always")).toEqual([
      { nested: { x: "x" } },
      true,
    ]);
  });

  it("fills defaults in tuple items (prefixItems) when items are undefined", () => {
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
    expect(applyDefaults("array", [undefined, undefined], schema)).toEqual([
      [{ a: "A" }, { b: "B" }],
      true,
    ]);
  });

  it("does not deep fill if array items already exist", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [
        {
          type: "object",
          properties: { a: { type: "string", default: "A" } },
          required: ["a"],
        },
      ],
    };
    // applyDefaults is shallow for existing items
    expect(applyDefaults("array", [{}], schema)).toEqual([[{}], false]);
  });
});
