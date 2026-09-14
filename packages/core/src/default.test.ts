import { describe, it, expect } from "vitest";
import type { Schema } from "./type";
import { getDefaultValue, applyDefaults, projectDefaults } from "./default";

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
    expect(getDefaultValue({ type: "string" }, true)).toBe("");
  });

  it("returns 0 for number type", () => {
    expect(getDefaultValue({ type: "number" }, true)).toBe(0);
  });

  it("returns 0 for integer type", () => {
    expect(getDefaultValue({ type: "integer" }, true)).toBe(0);
  });

  it("returns false for boolean type", () => {
    expect(getDefaultValue({ type: "boolean" }, true)).toBe(false);
  });

  it("returns null for null type", () => {
    expect(getDefaultValue({ type: "null" }, true)).toBeUndefined();
  });

  it("returns empty array for array type", () => {
    expect(getDefaultValue({ type: "array" }, true)).toEqual([]);
    expect(
      getDefaultValue({ type: "array", items: { type: "string" } }, true),
    ).toEqual([]);
  });

  it("returns empty object for object type without properties", () => {
    expect(getDefaultValue({ type: "object" }, true)).toEqual({});
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
    expect(getDefaultValue(schema, true)).toEqual({
      name: "",
      age: 0,
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
    const result = getDefaultValue(schema) as Record<string, unknown>;
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
    expect(getDefaultValue(schema, true)).toEqual({
      user: { name: "" },
    });
  });

  it("uses first type if type is an array", () => {
    expect(getDefaultValue({ type: ["string", "number"] }, true)).toBe("");
    expect(getDefaultValue({ type: ["number", "string"] }, true)).toBe(0);
  });

  it("returns undefined if type is not specified (no inference)", () => {
    const schema: Schema = {
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };
    expect(getDefaultValue(schema, true)).toBeUndefined();
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
    expect(getDefaultValue(schema, true)).toEqual({
      status: "active",
    });
  });

  it("returns default values for prefixItems in array", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number", default: 10 }],
    };
    expect(getDefaultValue(schema, true)).toEqual(["", 10]);
  });
});

describe("applyDefaults", () => {
  it("returns default value if input is undefined", () => {
    const schema: Schema = { type: "string" };
    expect(applyDefaults("string", undefined, schema, true)).toEqual([
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
    expect(applyDefaults("object", {}, schema, true)).toEqual([
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

  it("fills falsy default values (false, 0, empty string)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        flag: { type: "boolean", default: false },
        count: { type: "integer", default: 0 },
        label: { type: "string", default: "" },
        title: { type: "string", default: "x" },
      },
    };
    expect(applyDefaults("object", {}, schema, false)).toEqual([
      { flag: false, count: 0, label: "", title: "x" },
      true,
    ]);
  });

  it("fills required children with zero values even when the parent is optional", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        flag: { type: "boolean" },
      },
      required: ["name", "flag"],
    };
    expect(applyDefaults("object", {}, schema, false)).toEqual([
      { name: "", flag: false },
      true,
    ]);
  });
});

describe("projectDefaults", () => {
  it("does not mutate the input value", () => {
    const schema: Schema = {
      type: "object",
      properties: { flag: { type: "boolean", default: false } },
    };
    const value: Record<string, unknown> = {};
    const projected = projectDefaults("object", value, schema, false) as Record<
      string,
      unknown
    >;
    expect(projected).toEqual({ flag: false });
    expect(value).toEqual({});
    expect(projected).not.toBe(value);
  });

  it("omits optional properties without a default", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string", default: "b" },
      },
    };
    expect(projectDefaults("object", {}, schema, false)).toEqual({ b: "b" });
  });

  it("recursively projects required nested object defaults", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: { flag: { type: "boolean", default: false } },
        },
      },
      required: ["nested"],
    };
    expect(projectDefaults("object", {}, schema, false)).toEqual({
      nested: { flag: false },
    });
  });

  it("projects optional defaults when a required container is absent", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string", default: "b" },
      },
      required: ["a"],
    };
    expect(projectDefaults("object", undefined, schema, true)).toEqual({
      a: "",
      b: "b",
    });
  });

  it("returns the original value when nothing changes", () => {
    const schema: Schema = {
      type: "object",
      properties: { a: { type: "string" } },
    };
    const value = { a: "x" };
    expect(projectDefaults("object", value, schema, false)).toBe(value);
  });

  it("projects defaults into existing array items without mutating them", () => {
    const schema: Schema = {
      type: "array",
      items: {
        type: "object",
        properties: { flag: { type: "boolean", default: false } },
      },
    };
    const value = [{}];
    const projected = projectDefaults(
      "array",
      value,
      schema,
      false,
    ) as unknown[];
    expect(projected[0]).toEqual({ flag: false });
    expect(value[0]).toEqual({});
  });
});
