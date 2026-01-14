import { describe, it, expect, beforeEach } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("SchemaRuntime Validation", () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  it("should validate node on initialization (buildNode)", () => {
    const schema: Schema = {
      type: "string",
      minLength: 5,
    };
    const value = "abc"; // Invalid: too short

    const runtime = new SchemaRuntime(validator, schema, value);

    // Explicitly validate to trigger error generation (lazy validation)
    runtime.validate("");
    const node = runtime.root;

    expect(node.error).toBeDefined();
    expect(node.error?.valid).toBe(false);
    expect(node.error?.errors?.[0].error).toContain("must be longer than");
  });

  it("should validate node on value update (reconcileNode)", () => {
    const schema: Schema = {
      type: "number",
      minimum: 10,
    };
    const value = 15; // Valid

    const runtime = new SchemaRuntime(validator, schema, value);
    let node = runtime.root;

    // Valid value => no error
    expect(node.error).toBeUndefined();

    runtime.setValue("#", 5); // Invalid

    // Explicitly validate
    runtime.validate("");
    node = runtime.root;

    expect(node.error).toBeDefined();
    expect(node.error?.valid).toBe(false);
    expect(node.error?.errors?.[0].error).toContain("must be >=");
  });

  it("should perform shallow validation (parent pass, child fail)", () => {
    // Schema: object with property 'foo' being string
    const schema: Schema = {
      type: "object",
      properties: {
        foo: { type: "string" },
      },
      required: ["foo"],
    };

    // Value: { foo: 123 } (foo is invalid type)
    const value = { foo: 123 };

    const runtime = new SchemaRuntime(validator, schema, value);

    // Validate root (shallow checks on parent)
    runtime.validate("");
    const rootNode = runtime.root;

    // Parent node validation should be SHALLOW.
    // Use shallow: true means it DOES NOT recurse into 'foo'.
    // It only checks if 'foo' exists (required).
    // So parent validation should be VALID (no error).
    expect(rootNode.error).toBeUndefined();

    // Child node 'foo' should be invalid
    // Validate child specifically
    runtime.validate("/foo");
    const fooNode = runtime.getNode("/foo");
    expect(fooNode).not.toBeNull();
    expect(fooNode?.error?.valid).toBe(false);
    expect(fooNode?.error?.errors?.[0].error).toContain("must be string");
  });

  it("should fail shallow validation if root constraint is violated", () => {
    const schema: Schema = {
      type: "object",
      required: ["bar"], // 'bar' is missing
    };
    const value = { foo: 123 };

    const runtime = new SchemaRuntime(validator, schema, value);

    // Validate root
    runtime.validate("");
    const rootNode = runtime.root;

    // Shallow validation checks 'required', so it should fail
    expect(rootNode.error?.valid).toBe(false);
    expect(rootNode.error?.errors?.[0].error).toContain(
      "must have required property 'bar'",
    );
  });
});
