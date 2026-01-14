import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Advanced Object Features", () => {
  const validator = new Validator();

  it("supports patternProperties", () => {
    const schema: Schema = {
      type: "object",
      patternProperties: {
        "^S_": { type: "string" },
        "^I_": { type: "integer" },
      },
    };
    const value = {
      S_foo: "bar",
      I_bar: 123,
      other: true,
    };
    const runtime = new SchemaRuntime(validator, schema, value);

    const nodeS = runtime.getNode("/S_foo");
    expect(nodeS).toBeTruthy();
    expect(nodeS?.schema.type).toBe("string");

    const nodeI = runtime.getNode("/I_bar");
    expect(nodeI).toBeTruthy();
    expect(nodeI?.schema.type).toBe("integer");

    const nodeOther = runtime.getNode("/other");
    // Should not match any patternProperties, so it won't be in children unless additionalProperties is handled (which defaults to true but we only generate nodes if schema is present or explicit additionalProperties schema)
    // In our implementation we only generate children for properties, patternProperties, and additionalProperties if schema is provided.
    // If no schema provided for 'other', it won't appear in the tree as a vetted child?
    // Wait, the current implementation iterates over keys.
    expect(nodeOther).toBeUndefined();
  });

  it("supports additionalProperties as schema", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        existing: { type: "string" },
      },
      additionalProperties: { type: "number" },
    };
    const value = {
      existing: "foo",
      extra1: 123,
      extra2: 456,
    };
    const runtime = new SchemaRuntime(validator, schema, value);

    const nodeExisting = runtime.getNode("/existing");
    expect(nodeExisting?.schema.type).toBe("string");

    const nodeExtra1 = runtime.getNode("/extra1");
    expect(nodeExtra1?.schema.type).toBe("number");

    const nodeExtra2 = runtime.getNode("/extra2");
    expect(nodeExtra2?.schema.type).toBe("number");
  });

  it("supports additionalProperties as true", () => {
    const schema: Schema = {
      type: "object",
      additionalProperties: true,
    };
    const value = {
      foo: "bar",
    };
    const runtime = new SchemaRuntime(validator, schema, value);

    const nodeFoo = runtime.getNode("/foo");
    expect(nodeFoo).toBeTruthy();
    expect(nodeFoo?.schema).toEqual({});
  });

  it("reconciles correctly when keys are added or removed", () => {
    const schema: Schema = {
      type: "object",
      additionalProperties: { type: "string" },
    };
    const runtime = new SchemaRuntime(validator, schema, {});

    expect(runtime.root.children?.length).toBe(0);

    // Add key via setValue on child path
    runtime.setValue("/newKey", "hello");
    expect(runtime.root.children?.length).toBe(1);
    expect(runtime.getNode("/newKey")?.schema.type).toBe("string");

    // Remove key via setValue on parent path
    runtime.setValue("", {});
    expect(runtime.root.children?.length).toBe(0);
    expect(runtime.getNode("/newKey")).toBeUndefined();
  });
});
