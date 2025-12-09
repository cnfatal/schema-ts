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
    expect(nodeOther).toBeNull();
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

    const node0 = runtime.findNode("/0");
    expect(node0?.schema.type).toBe("string");

    const node1 = runtime.findNode("/1");
    expect(node1?.schema.type).toBe("number");

    const node2 = runtime.findNode("/2");
    expect(node2?.schema.type).toBe("boolean");

    const node3 = runtime.findNode("/3");
    expect(node3?.schema.type).toBe("boolean");
  });
});

describe("Dependency Collection System", () => {
  const validator = new Validator();

  describe("Basic if-then-else dependencies", () => {
    it("tracks dependencies from if condition", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          mode: { type: "string" },
          value: { type: "string" },
        },
        if: {
          properties: { mode: { const: "advanced" } },
        },
        then: {
          properties: { extra: { type: "string" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        mode: "simple",
        value: "test",
      });

      // Root should have dependency on /mode
      expect(runtime.root.dependencies.has("/mode")).toBe(true);

      // Initially no extra field
      expect(runtime.findNode("/extra")).toBeNull();

      // Change mode to "advanced" - should trigger schema update
      runtime.setValue("/mode", "advanced");

      // Now extra field should exist
      const extraNode = runtime.findNode("/extra");
      expect(extraNode).toBeTruthy();
    });

    it("updates schema when dependency value changes", () => {
      const schema: Schema = {
        type: "object",
        if: { properties: { type: { const: "A" } } },
        then: { properties: { value: { type: "string" } } },
        else: { properties: { value: { type: "number" } } },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        type: "A",
        value: "hello",
      });

      // type A -> then branch -> value is string
      let valueNode = runtime.findNode("/value");
      expect(valueNode?.schema.type).toBe("string");

      // Change to type B -> else branch -> value is number
      runtime.setValue("/type", "B");
      valueNode = runtime.findNode("/value");
      expect(valueNode?.schema.type).toBe("number");

      // Change back to type A
      runtime.setValue("/type", "A");
      valueNode = runtime.findNode("/value");
      expect(valueNode?.schema.type).toBe("string");
    });
  });

  describe("Nested if-then-else dependencies", () => {
    it("handles nested conditional schemas", () => {
      // Simpler nested if-then-else that tests dependency collection
      const schema: Schema = {
        type: "object",
        properties: {
          mode: { type: "string" },
          level: { type: "number" },
        },
        if: {
          properties: { mode: { const: "advanced" } },
        },
        then: {
          if: {
            properties: { level: { const: 10 } },
          },
          then: {
            properties: { extra: { type: "string" } },
          },
        },
      };

      // Test that dependencies are collected from nested conditions
      const runtime = new SchemaRuntime(validator, schema, {
        mode: "simple",
        level: 5,
      });

      // Root should have dependencies on both /mode and /level (from nested if)
      expect(runtime.root.dependencies.has("/mode")).toBe(true);
      expect(runtime.root.dependencies.has("/level")).toBe(true);

      // Test that changing /level triggers update even when mode doesn't match
      runtime.setValue("/level", 10);
      // This should complete without error (dependency tracking works)
      expect(runtime.getValue("/level")).toBe(10);
    });
  });

  describe("oneOf dependencies", () => {
    it("tracks dependencies from oneOf conditions", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          kind: { type: "string" },
        },
        oneOf: [
          {
            properties: { kind: { const: "circle" } },
            then: { properties: { radius: { type: "number" } } },
          },
          {
            properties: { kind: { const: "rectangle" } },
            then: {
              properties: {
                width: { type: "number" },
                height: { type: "number" },
              },
            },
          },
        ],
      };

      const runtime = new SchemaRuntime(validator, schema, {
        kind: "circle",
        radius: 10,
      });

      // Should have dependency on /kind
      expect(runtime.root.dependencies.has("/kind")).toBe(true);
    });
  });

  describe("anyOf dependencies", () => {
    it("tracks dependencies from anyOf conditions", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [
          {
            properties: { format: { const: "json" } },
            then: { properties: { data: { type: "object" } } },
          },
          {
            properties: { format: { const: "text" } },
            then: { properties: { data: { type: "string" } } },
          },
        ],
      };

      const runtime = new SchemaRuntime(validator, schema, {
        format: "json",
        data: {},
      });

      // Should have dependency on /format
      expect(runtime.root.dependencies.has("/format")).toBe(true);
    });
  });

  describe("allOf with nested conditions", () => {
    it("collects dependencies from allOf sub-schemas", () => {
      const schema: Schema = {
        type: "object",
        allOf: [
          {
            if: { properties: { enabled: { const: true } } },
            then: { properties: { config: { type: "object" } } },
          },
          {
            if: { properties: { debug: { const: true } } },
            then: { properties: { logLevel: { type: "string" } } },
          },
        ],
      };

      const runtime = new SchemaRuntime(validator, schema, {
        enabled: false,
        debug: false,
      });

      // Should have dependencies on both /enabled and /debug
      expect(runtime.root.dependencies.has("/enabled")).toBe(true);
      expect(runtime.root.dependencies.has("/debug")).toBe(true);
    });
  });

  describe("Multiple value constraints", () => {
    it("tracks dependencies from if conditions with value constraints", () => {
      // Test that dependencies are tracked for value constraint conditions
      const schema: Schema = {
        type: "object",
        properties: {
          count: { type: "number" },
        },
        if: {
          properties: { count: { const: 100 } },
        },
        then: {
          properties: { special: { type: "string" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        count: 50,
      });

      // Should have dependency on /count
      expect(runtime.root.dependencies.has("/count")).toBe(true);

      // count = 50 -> if fails, no special property
      expect(runtime.findNode("/special")).toBeNull();

      // count = 100 -> if passes, special property appears
      runtime.setValue("/count", 100);
      // Need to provide value for special to create node
      (runtime.root.value as Record<string, unknown>)["special"] = "test";
      runtime.setValue("/count", 100); // Trigger reconcile again
      const specialNode = runtime.findNode("/special");
      expect(specialNode).toBeTruthy();
    });
  });

  describe("Circular update protection", () => {
    it("prevents infinite loops in circular dependencies", () => {
      // This is a synthetic test - in practice circular dependencies
      // in schema conditions should be avoided
      const schema: Schema = {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "string" },
        },
        if: { properties: { a: { const: "trigger" } } },
        then: { properties: { result: { type: "string" } } },
      };

      const runtime = new SchemaRuntime(validator, schema, { a: "x", b: "y" });

      // Should complete without infinite loop
      runtime.setValue("/a", "trigger");
      expect(runtime.findNode("/result")).toBeTruthy();

      runtime.setValue("/a", "other");
      expect(runtime.findNode("/result")).toBeNull();
    });
  });

  describe("Child node dependencies", () => {
    it("child nodes have their own dependencies", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          parent: {
            type: "object",
            properties: {
              toggle: { type: "boolean" },
            },
            if: { properties: { toggle: { const: true } } },
            then: { properties: { extra: { type: "string" } } },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        parent: { toggle: false },
      });

      const parentNode = runtime.findNode("/parent");
      expect(parentNode).toBeTruthy();
      // Parent node should have dependency on /parent/toggle
      expect(parentNode?.dependencies.has("/parent/toggle")).toBe(true);

      // Initially no extra
      expect(runtime.findNode("/parent/extra")).toBeNull();

      // Toggle on
      runtime.setValue("/parent/toggle", true);
      expect(runtime.findNode("/parent/extra")).toBeTruthy();
    });
  });

  describe("Dependency cleanup on schema change", () => {
    it("cleans up old dependencies when schema changes", () => {
      const schema: Schema = {
        type: "object",
        if: { properties: { mode: { const: "A" } } },
        then: {
          properties: {
            config: {
              type: "object",
              if: { properties: { nested: { const: true } } },
              then: { properties: { detail: { type: "string" } } },
            },
          },
        },
        else: {
          properties: {
            simple: { type: "string" },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        mode: "A",
        config: { nested: true },
      });

      // In mode A, config with nested condition exists
      expect(runtime.findNode("/config")).toBeTruthy();
      expect(runtime.findNode("/config/detail")).toBeTruthy();

      // Switch to mode B - config subtree should be replaced by simple
      runtime.setValue("/mode", "B");
      expect(runtime.findNode("/config")).toBeNull();
      expect(runtime.findNode("/simple")).toBeTruthy();

      // Switch back to mode A
      runtime.setValue("/mode", "A");
      expect(runtime.findNode("/config")).toBeTruthy();
    });
  });
});

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
    expect(runtime.findNode("/name")?.value).toBe("Alice");

    // Update name
    runtime.setValue("/name", "Bob");
    expect(runtime.getValue("/name")).toBe("Bob");
    expect(runtime.findNode("/name")?.value).toBe("Bob");

    // Update age
    runtime.setValue("/age", 30);
    expect(runtime.getValue("/age")).toBe(30);
    expect(runtime.findNode("/age")?.value).toBe(30);
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
    expect(runtime.findNode("/user/profile/email")?.value).toBe(
      "new@example.com",
    );
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
    expect(runtime.findNode("/1")?.value).toBe(20);
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

    const nodeA = runtime.findNode("/a");
    const nodeB = runtime.findNode("/b");
    const nodeD = runtime.findNode("/d");

    expect(nodeA?.value).toBe("initial");
    expect(nodeD?.value).toBe("untouched");

    // Update /a
    runtime.setValue("/a", "updated");

    // Node A value should be updated
    expect(runtime.findNode("/a")?.value).toBe("updated");

    // Sibling nodes should be same instances (not recreated)
    expect(runtime.findNode("/d")).toBe(nodeD);
    expect(runtime.findNode("/b")).toBe(nodeB);
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

    const dependentNode = runtime.findNode("/dependent");
    expect(dependentNode?.schema.type).toBe("string");

    // Update val to 2 -> triggers else -> dependent should be number
    runtime.setValue("/val", 2);

    const newDependentNode = runtime.findNode("/dependent");
    expect(newDependentNode?.schema.type).toBe("number");

    // Dependent node should be rebuilt (different instance)
    expect(newDependentNode).not.toBe(dependentNode);
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

    expect(runtime.findNode("/flexible")?.value).toBe("string value");

    runtime.setValue("/flexible", 123);
    expect(runtime.findNode("/flexible")?.value).toBe(123);

    runtime.setValue("/flexible", { nested: true });
    expect(runtime.findNode("/flexible")?.value).toEqual({ nested: true });
  });
});

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
    expect(node?.value).toBe("value");
    expect(node?.error).toBeDefined();
    expect(node?.error?.valid).toBe(false);
    expect(node?.error?.errors?.[0].error).toContain("must be number");
  });

  it("notifies listeners on schema update", () => {
    const schema: Schema = { type: "string" };
    const runtime = new SchemaRuntime(validator, schema, "test");

    let called = false;
    runtime.subscribe("#", (e) => {
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
    expect(runtime.root.dependencies.has("/a")).toBe(true);

    // Update schema to remove dependency
    const schema2: Schema = {
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
    };

    runtime.updateSchema(schema2);

    expect(runtime.findNode("/b")).toBeTruthy();
    // In schema2, no condition, so no dependency on /a
    expect(runtime.root.dependencies.size).toBe(0);
  });
});
