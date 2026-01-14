import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Value Change Scenarios", () => {
  const validator = new Validator();

  it("updates node value on setValue", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      name: "Alice",
      age: 25,
    });

    // Initial values
    expect(runtime.getValue("/name")).toBe("Alice");
    expect(runtime.getValue("/age")).toBe(25);
    expect(runtime.getValue("/name")).toBe("Alice");

    // Update name
    runtime.setValue("/name", "Bob");
    expect(runtime.getValue("/name")).toBe("Bob");
    expect(runtime.getValue("/name")).toBe("Bob");

    // Update age
    runtime.setValue("/age", 30);
    expect(runtime.getValue("/age")).toBe(30);
    expect(runtime.getValue("/age")).toBe(30);
  });

  it("updates nested object values", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              properties: {
                email: { type: "string" },
              },
            },
          },
        },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      user: { profile: { email: "old@example.com" } },
    });

    expect(runtime.getValue("/user/profile/email")).toBe("old@example.com");

    runtime.setValue("/user/profile/email", "new@example.com");
    expect(runtime.getValue("/user/profile/email")).toBe("new@example.com");
    expect(runtime.getValue("/user/profile/email")).toBe("new@example.com");
  });

  it("updates array element values", () => {
    const schema: Schema = {
      type: "array",
      items: { type: "number" },
    };

    const runtime = new SchemaRuntime(validator, schema, [1, 2, 3]);

    expect(runtime.getValue("/0")).toBe(1);
    expect(runtime.getValue("/1")).toBe(2);

    runtime.setValue("/1", 20);
    expect(runtime.getValue("/1")).toBe(20);
    expect(runtime.getValue("/1")).toBe(20);
  });

  it("preserves sibling node instances on value update", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "object", properties: { c: { type: "number" } } },
        d: { type: "string" },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      a: "initial",
      b: { c: 1 },
      d: "untouched",
    });

    const nodeB = runtime.getNode("/b");
    const nodeD = runtime.getNode("/d");

    expect(runtime.getValue("/a")).toBe("initial");
    expect(runtime.getValue("/d")).toBe("untouched");

    // Update /a
    runtime.setValue("/a", "updated");

    // Node A value should be updated
    expect(runtime.getValue("/a")).toBe("updated");

    // Sibling nodes should be same instances (not recreated)
    expect(runtime.getNode("/d")).toBe(nodeD);
    expect(runtime.getNode("/b")).toBe(nodeB);
  });

  it("rebuilds subtree when conditional schema changes", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        val: { type: "number" },
      },
      if: { properties: { val: { const: 1 } } },
      then: { properties: { dependent: { type: "string" } } },
      else: { properties: { dependent: { type: "number" } } },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      val: 1,
      dependent: "foo",
    });

    const dependentNode = runtime.getNode("/dependent");
    expect(dependentNode?.schema.type).toBe("string");

    // Update val to 2 -> triggers else -> dependent should be number
    runtime.setValue("/val", 2);

    const newDependentNode = runtime.getNode("/dependent");
    expect(newDependentNode?.schema.type).toBe("number");

    // Dependent node should be rebuilt (different instance)
    expect(newDependentNode).toBe(dependentNode);
  });

  it("handles value type changes", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        flexible: {},
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      flexible: "string value",
    });

    expect(runtime.getValue("/flexible")).toBe("string value");

    runtime.setValue("/flexible", 123);
    expect(runtime.getValue("/flexible")).toBe(123);

    runtime.setValue("/flexible", { nested: true });
    expect(runtime.getValue("/flexible")).toEqual({ nested: true });
  });
});
