import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Schema Update Scenarios", () => {
  const validator = new Validator();

  it("updates schema dynamically", () => {
    const initialSchema: Schema = {
      type: "object",
      properties: {
        field: { type: "string" },
      },
    };

    const runtime = new SchemaRuntime(validator, initialSchema, {
      field: "value",
    });

    expect(runtime.findNode("/field")?.schema.type).toBe("string");

    // Update schema to change field type
    const newSchema: Schema = {
      type: "object",
      properties: {
        field: { type: "number" },
      },
    };

    runtime.updateSchema(newSchema);

    const node = runtime.findNode("/field");
    expect(node?.schema.type).toBe("number");

    // Value remains "value" (string) but schema expects number, so error should be present
    expect(runtime.getValue("/field")).toBe("value");
    expect(node?.error).toBeDefined();
    expect(node?.error?.valid).toBe(false);
    expect(node?.error?.errors?.[0].error).toContain("must be number");
  });

  it("notifies listeners on schema update", () => {
    const schema: Schema = { type: "string" };
    const runtime = new SchemaRuntime(validator, schema, "test");

    let called = false;
    // updateSchema notifies on "#" path, which normalizes to ""
    runtime.subscribe("", (e) => {
      if (e.type === "schema") called = true;
    });

    runtime.updateSchema({ type: "number" });
    expect(called).toBe(true);
  });

  it("preserves dependencies after schema update", () => {
    const schema1: Schema = {
      type: "object",
      properties: { a: { type: "string" } },
      if: { properties: { a: { const: "foo" } } },
      then: { properties: { b: { type: "string" } } },
    };

    const runtime = new SchemaRuntime(validator, schema1, {
      a: "foo",
      b: "bar",
    });
    expect(runtime.findNode("/b")).toBeTruthy();
    expect(runtime.root.dependencies?.has("/a")).toBe(true);

    // Update schema to remove dependency
    const schema2: Schema = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
    };

    runtime.updateSchema(schema2);

    expect(runtime.findNode("/b")).toBeTruthy();
    // In schema2, no condition, so no dependency on /a
    expect(runtime.root.dependencies?.size).toBe(0);
  });
});
