import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("anyOf with Multiple if-then Branches", () => {
  const validator = new Validator();

  it("should merge multiple successful anyOf branches (if/then vacuously true behavior)", () => {
    // In JSON Schema, if the 'if' condition doesn't match, the whole 'if/then' is STILL valid.
    // This is why anyOf needs to merge all matching branches to catch the one that actually applied 'then'.
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
        value: { type: "string" },
      },
      anyOf: [
        {
          if: { properties: { type: { const: "A" } } },
          then: { properties: { value: { title: "Title A" } } },
        },
        {
          if: { properties: { type: { const: "B" } } },
          then: { properties: { value: { title: "Title B" } } },
        },
      ],
    };

    // Case 1: type is "A"
    const runtimeA = new SchemaRuntime(validator, schema, {
      type: "A",
      value: "test",
    });
    const nodeA = runtimeA.findNode("/value");
    // Branch 1 matches 'if' and applies 'then' (title: Title A)
    // Branch 2 doesn't match 'if', so it's valid but doesn't apply 'then'
    // Result should be Title A
    expect(nodeA?.schema.title).toBe("Title A");

    // Case 2: type is "B"
    const runtimeB = new SchemaRuntime(validator, schema, {
      type: "B",
      value: "test",
    });
    const nodeB = runtimeB.findNode("/value");
    // Branch 1 doesn't match 'if' -> valid
    // Branch 2 matches 'if' -> applies 'then' (title: Title B)
    // Result should be Title B
    expect(nodeB?.schema.title).toBe("Title B");
  });

  it("should merge overlapping anyOf branches", () => {
    const schema: Schema = {
      type: "object",
      anyOf: [
        {
          if: { properties: { x: { const: true } } },
          then: { properties: { result: { description: "Desc X" } } },
        },
        {
          if: { properties: { y: { const: true } } },
          then: { properties: { result: { title: "Title Y" } } },
        },
      ],
    };

    // If both x and y are true, both branches apply their 'then'
    const runtime = new SchemaRuntime(validator, schema, {
      x: true,
      y: true,
      result: "val",
    });
    const node = runtime.findNode("/result");

    expect(node?.schema.description).toBe("Desc X");
    expect(node?.schema.title).toBe("Title Y");
  });

  it("should handle nested conditions in anyOf", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        category: { type: "string" },
        subCategory: { type: "string" },
        value: { type: "string" },
      },
      anyOf: [
        {
          if: { properties: { category: { const: "A" } } },
          then: {
            anyOf: [
              {
                if: { properties: { subCategory: { const: "A1" } } },
                then: { properties: { value: { title: "Val A1" } } },
              },
              {
                if: { properties: { subCategory: { const: "A2" } } },
                then: { properties: { value: { description: "Desc A2" } } },
              },
            ],
          },
        },
      ],
    };

    // Case: Category A, Sub A1.
    // Outer anyOf Branch 1 is valid.
    // Inner anyOf Branch 1 matches A1.
    // Inner anyOf Branch 2 is vacuously valid.
    const runtime = new SchemaRuntime(validator, schema, {
      category: "A",
      subCategory: "A1",
    });
    const node = runtime.findNode("/value");
    expect(node?.schema.title).toBe("Val A1");

    // Case: Category A, Sub A2.
    const runtime2 = new SchemaRuntime(validator, schema, {
      category: "A",
      subCategory: "A2",
    });
    const node2 = runtime2.findNode("/value");
    expect(node2?.schema.description).toBe("Desc A2");
  });
});
