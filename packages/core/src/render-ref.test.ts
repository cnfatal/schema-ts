import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("$ref Support", () => {
  const validator = new Validator();

  it("resolves $ref in properties", () => {
    const schema: Schema = {
      $defs: {
        Name: { type: "string", minLength: 1 },
      },
      type: "object",
      properties: {
        name: { $ref: "#/$defs/Name" },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      name: "Alice",
    });

    const nameNode = runtime.findNode("/name");
    expect(nameNode).toBeTruthy();
    expect(nameNode?.schema.type).toBe("string");
    expect(nameNode?.schema.minLength).toBe(1);
    // $ref should be resolved (not present in effective schema)
    expect(nameNode?.schema.$ref).toBeUndefined();
  });

  it("resolves nested $refs", () => {
    const schema: Schema = {
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { $ref: "#/$defs/City" },
          },
        },
        City: { type: "string", minLength: 2 },
      },
      type: "object",
      properties: {
        homeAddress: { $ref: "#/$defs/Address" },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      homeAddress: {
        street: "123 Main St",
        city: "NYC",
      },
    });

    const addressNode = runtime.findNode("/homeAddress");
    expect(addressNode?.schema.type).toBe("object");

    const cityNode = runtime.findNode("/homeAddress/city");
    expect(cityNode?.schema.type).toBe("string");
    expect(cityNode?.schema.minLength).toBe(2);
  });

  it("resolves $ref in array items", () => {
    const schema: Schema = {
      $defs: {
        Item: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      },
      type: "array",
      items: { $ref: "#/$defs/Item" },
    };

    const runtime = new SchemaRuntime(validator, schema, [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ]);

    const item0 = runtime.findNode("/0");
    expect(item0?.schema.type).toBe("object");
    expect(item0?.schema.properties?.id).toEqual({ type: "number" });

    const item0Id = runtime.findNode("/0/id");
    expect(item0Id?.schema.type).toBe("number");
  });

  it("resolves $ref in conditional schemas", () => {
    const schema: Schema = {
      $defs: {
        StringValue: { type: "string" },
        NumberValue: { type: "number" },
      },
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      if: { properties: { mode: { const: "text" } } },
      then: { properties: { value: { $ref: "#/$defs/StringValue" } } },
      else: { properties: { value: { $ref: "#/$defs/NumberValue" } } },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      mode: "text",
      value: "hello",
    });

    // mode = text -> then branch -> value is string
    let valueNode = runtime.findNode("/value");
    expect(valueNode?.schema.type).toBe("string");

    // Change to mode = number -> else branch -> value is number
    runtime.setValue("/mode", "number");
    valueNode = runtime.findNode("/value");
    expect(valueNode?.schema.type).toBe("number");
  });

  it("resolves $ref in oneOf schemas", () => {
    const schema: Schema = {
      $defs: {
        Circle: {
          type: "object",
          properties: {
            shape: { const: "circle" },
            radius: { type: "number" },
          },
        },
        Rectangle: {
          type: "object",
          properties: {
            shape: { const: "rectangle" },
            width: { type: "number" },
            height: { type: "number" },
          },
        },
      },
      oneOf: [{ $ref: "#/$defs/Circle" }, { $ref: "#/$defs/Rectangle" }],
    };

    const runtime = new SchemaRuntime(validator, schema, {
      shape: "circle",
      radius: 10,
    });

    // Should match Circle schema
    expect(runtime.root.schema.properties?.radius).toBeDefined();
    expect(runtime.findNode("/radius")?.schema.type).toBe("number");
  });

  it("merges $ref with sibling properties", () => {
    const schema: Schema = {
      $defs: {
        Base: {
          type: "string",
          minLength: 1,
        },
      },
      type: "object",
      properties: {
        name: {
          $ref: "#/$defs/Base",
          description: "The user's name",
          maxLength: 100,
        },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      name: "Alice",
    });

    const nameNode = runtime.findNode("/name");
    expect(nameNode?.schema.type).toBe("string");
    expect(nameNode?.schema.minLength).toBe(1);
    expect(nameNode?.schema.maxLength).toBe(100);
    expect(nameNode?.schema.description).toBe("The user's name");
  });

  it("handles $ref in allOf", () => {
    const schema: Schema = {
      $defs: {
        Base: {
          type: "object",
          properties: { id: { type: "number" } },
        },
        Extended: {
          properties: { name: { type: "string" } },
        },
      },
      allOf: [{ $ref: "#/$defs/Base" }, { $ref: "#/$defs/Extended" }],
    };

    const runtime = new SchemaRuntime(validator, schema, {
      id: 1,
      name: "Test",
    });

    expect(runtime.root.schema.properties?.id).toBeDefined();
    expect(runtime.root.schema.properties?.name).toBeDefined();
    expect(runtime.findNode("/id")?.schema.type).toBe("number");
    expect(runtime.findNode("/name")?.schema.type).toBe("string");
  });
});
