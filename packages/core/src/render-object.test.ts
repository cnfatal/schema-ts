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

    const nodeS = runtime.findNode("/S_foo");
    expect(nodeS).toBeTruthy();
    expect(nodeS?.schema.type).toBe("string");

    const nodeI = runtime.findNode("/I_bar");
    expect(nodeI).toBeTruthy();
    expect(nodeI?.schema.type).toBe("integer");

    const nodeOther = runtime.findNode("/other");
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

    const nodeExisting = runtime.findNode("/existing");
    expect(nodeExisting?.schema.type).toBe("string");

    const nodeExtra1 = runtime.findNode("/extra1");
    expect(nodeExtra1?.schema.type).toBe("number");

    const nodeExtra2 = runtime.findNode("/extra2");
    expect(nodeExtra2?.schema.type).toBe("number");
  });
});
