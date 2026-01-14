import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("SchemaRuntime Basic", () => {
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
    runtime.validate("");
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
    let valueNode = runtime.getNode("/value");
    expect(valueNode?.schema.type).toBe("string");

    // Change type to B -> else branch -> value is number
    runtime.setValue("/type", "B");

    valueNode = runtime.getNode("/value");
    // Should now be number
    expect(valueNode?.schema.type).toBe("number");
  });
});

describe("Advanced Array Features", () => {
  const validator = new Validator();

  it("supports prefixItems", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: "boolean" }, // for the rest
    };
    const value = ["foo", 123, true, false];
    const runtime = new SchemaRuntime(validator, schema, value);

    const node0 = runtime.getNode("/0");
    expect(node0?.schema.type).toBe("string");

    const node1 = runtime.getNode("/1");
    expect(node1?.schema.type).toBe("number");

    const node2 = runtime.getNode("/2");
    expect(node2?.schema.type).toBe("boolean");

    const node3 = runtime.getNode("/3");
    expect(node3?.schema.type).toBe("boolean");
  });
});
