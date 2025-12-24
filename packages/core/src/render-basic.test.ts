import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("SchemaRuntime", () => {
  const validator = new Validator();

  it("infers type from value when schema type is missing", () => {
    const schema: Schema = {};
    const runtime = new SchemaRuntime(validator, schema, "hello");
    expect(runtime.root.type).toBe("string");
  });

  it("uses schema type if present", () => {
    const schema: Schema = { type: "number" };
    const runtime = new SchemaRuntime(validator, schema, 123);
    expect(runtime.root.type).toBe("number");
  });

  it("handles type mismatch", () => {
    const schema: Schema = { type: "number" };
    const runtime = new SchemaRuntime(validator, schema, "hello");
    expect(runtime.root.error).toBeDefined();
    expect(runtime.root.error?.valid).toBe(false);
    expect(runtime.root.error?.errors?.[0].error).toContain("must be number");
    expect(runtime.root.type).toBe("number"); // Fallback to schema type
  });

  it("rebuilds tree on setValue", () => {
    const schema: Schema = {
      if: { properties: { type: { const: "A" } } },
      then: { properties: { value: { type: "string" } } },
      else: { properties: { value: { type: "number" } } },
    };
    const runtime = new SchemaRuntime(validator, schema, {
      type: "A",
      value: "foo",
    });

    // Initial state: type A -> then branch -> value is string
    // Note: findNode uses jsonPointer. Root is empty string.
    // Properties are at /value
    let valueNode = runtime.findNode("/value");
    expect(valueNode?.schema.type).toBe("string");

    // Change type to B -> else branch -> value is number
    runtime.setValue("/type", "B");

    valueNode = runtime.findNode("/value");
    // With my fix, this should now be number
    expect(valueNode?.schema.type).toBe("number");
  });
});
