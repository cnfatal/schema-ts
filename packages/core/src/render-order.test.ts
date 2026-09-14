import { describe, expect, it } from "vitest";
import type { Schema } from "./type";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";

function order(schema: Schema, value: unknown = {}): string[] {
  const runtime = new SchemaRuntime(new Validator(), schema, value);
  return (runtime.root.children ?? []).map((child) =>
    child.instanceLocation.replace(/^\//, ""),
  );
}

describe("rendering order", () => {
  it("follows properties declaration order", () => {
    const schema: Schema = {
      type: "object",
      properties: { b: {}, a: {}, c: {} },
    };
    expect(order(schema)).toEqual(["b", "a", "c"]);
  });

  it("appends allOf entries in array order after the base properties", () => {
    const schema: Schema = {
      type: "object",
      properties: { a: {}, c: {} },
      allOf: [{ properties: { b: {}, d: {} } }, { properties: { e: {} } }],
    };
    expect(order(schema)).toEqual(["a", "c", "b", "d", "e"]);
  });

  it("keeps the first position when a later entry redeclares a key", () => {
    const schema: Schema = {
      type: "object",
      properties: { a: {} },
      allOf: [{ properties: { a: {}, b: {} } }],
    };
    expect(order(schema)).toEqual(["a", "b"]);
  });

  it("appends if/then contributions after the base", () => {
    const schema: Schema = {
      type: "object",
      properties: { a: {} },
      if: { properties: { a: { const: 1 } }, required: ["a"] },
      then: { properties: { b: {} } },
    };
    expect(order(schema, { a: 1 })).toEqual(["a", "b"]);
  });

  it("appends anyOf and oneOf contributions after the base", () => {
    const anySchema: Schema = {
      type: "object",
      properties: { a: {} },
      anyOf: [{ properties: { b: {} } }],
    };
    const any = order(anySchema);
    expect(any).toContain("b");
    expect(any.indexOf("a")).toBeLessThan(any.indexOf("b"));

    const oneSchema: Schema = {
      type: "object",
      properties: { a: {} },
      oneOf: [{ properties: { b: {} } }],
    };
    const one = order(oneSchema);
    expect(one).toContain("b");
    expect(one.indexOf("a")).toBeLessThan(one.indexOf("b"));
  });

  it("sorts by x-order ascending, overriding definition order", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        b: { "x-order": 1 },
        a: { "x-order": 2 },
        c: {},
      },
    };
    expect(order(schema)).toEqual(["b", "a", "c"]);
  });

  it("keeps definition order for ties and missing x-order (stable sort)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        b: { "x-order": 1 },
        a: { "x-order": 1 },
        d: {},
        c: {},
      },
    };
    expect(order(schema)).toEqual(["b", "a", "d", "c"]);
  });

  it("renders array items in index order (prefixItems then items)", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ title: "first" }, { title: "second" }],
      items: { title: "rest" },
    };
    const runtime = new SchemaRuntime(new Validator(), schema, ["x", "y", "z"]);
    expect(
      (runtime.root.children ?? []).map((c) => c.instanceLocation),
    ).toEqual(["/0", "/1", "/2"]);
  });
});
