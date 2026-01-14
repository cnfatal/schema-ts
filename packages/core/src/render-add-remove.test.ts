import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Node Add/Remove Functionality", () => {
  const validator = new Validator();

  describe("canRemove flag", () => {
    it("sets canRemove to true for array items (not prefixItems)", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, ["a", "b", "c"]);

      const node0 = runtime.getNode("/0");
      const node1 = runtime.getNode("/1");
      const node2 = runtime.getNode("/2");

      expect(node0?.canRemove).toBe(true);
      expect(node1?.canRemove).toBe(true);
      expect(node2?.canRemove).toBe(true);
    });

    it("sets canRemove to false for prefixItems", () => {
      const schema: Schema = {
        type: "array",
        prefixItems: [{ type: "string" }, { type: "number" }],
        items: { type: "boolean" },
      };
      const runtime = new SchemaRuntime(validator, schema, [
        "foo",
        123,
        true,
        false,
      ]);

      // prefixItems cannot be removed
      expect(runtime.getNode("/0")?.canRemove).toBe(false);
      expect(runtime.getNode("/1")?.canRemove).toBe(false);
      // items can be removed
      expect(runtime.getNode("/2")?.canRemove).toBe(true);
      expect(runtime.getNode("/3")?.canRemove).toBe(true);
    });

    it("sets canRemove to true for additionalProperties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "Alice",
        age: 25,
        score: 100,
      });

      // Regular property cannot be removed
      expect(runtime.getNode("/name")?.canRemove).toBe(false);
      // additionalProperties can be removed
      expect(runtime.getNode("/age")?.canRemove).toBe(true);
      expect(runtime.getNode("/score")?.canRemove).toBe(true);
    });

    it("sets canRemove to true for patternProperties", () => {
      const schema: Schema = {
        type: "object",
        patternProperties: {
          "^S_": { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        S_name: "Alice",
        S_city: "NYC",
      });

      expect(runtime.getNode("/S_name")?.canRemove).toBe(true);
      expect(runtime.getNode("/S_city")?.canRemove).toBe(true);
    });

    it("sets canRemove to false for regular object properties", () => {
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

      expect(runtime.getNode("/name")?.canRemove).toBe(false);
      expect(runtime.getNode("/age")?.canRemove).toBe(false);
    });
  });

  describe("canAdd flag", () => {
    it("sets canAdd to true for arrays with items schema", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, ["a", "b"]);

      expect(runtime.root.canAdd).toBe(true);
    });

    it("sets canAdd to false for arrays without items schema", () => {
      const schema: Schema = {
        type: "array",
        prefixItems: [{ type: "string" }],
      };
      const runtime = new SchemaRuntime(validator, schema, ["a"]);

      expect(runtime.root.canAdd).toBe(false);
    });

    it("sets canAdd to true for objects with additionalProperties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      expect(runtime.root.canAdd).toBe(true);
    });

    it("sets canAdd to false for objects without additionalProperties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      expect(runtime.root.canAdd).toBe(false);
    });
  });

  describe("remove() method", () => {
    it("removes array items", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, [1, 2, 3]);

      expect(runtime.getValue("")).toEqual([1, 2, 3]);
      expect(runtime.root.children?.length).toBe(3);

      const result = runtime.removeValue("/1");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual([1, 3]);
      expect(runtime.root.children?.length).toBe(2);
    });

    it("removes object additionalProperties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "Alice",
        age: 25,
      });

      const result = runtime.removeValue("/age");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual({ name: "Alice" });
      expect(runtime.getNode("/age")).toBeUndefined();
    });

    it("returns false when trying to remove regular properties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      const result = runtime.removeValue("/name");
      expect(result).toBe(false);
      expect(runtime.getValue("/name")).toBe("Alice");
    });

    it("returns false when trying to remove root", () => {
      const schema: Schema = { type: "string" };
      const runtime = new SchemaRuntime(validator, schema, "hello");

      const result = runtime.removeValue("");
      expect(result).toBe(false);
    });

    it("returns false for non-existent path", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, [1, 2, 3]);

      const result = runtime.removeValue("/10");
      expect(result).toBe(false);
    });
  });

  describe("add() method", () => {
    it("adds new item to array with default value", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, ["a", "b"]);

      const result = runtime.addChild("");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual(["a", "b", ""]);
      expect(runtime.root.children?.length).toBe(3);
    });

    it("adds new item to array with null when schema has no type", () => {
      const schema: Schema = {
        type: "array",
        items: {}, // No type specified
      };
      const runtime = new SchemaRuntime(validator, schema, ["a", "b"]);

      const result = runtime.addChild("");
      expect(result).toBe(true);
      // Should add null instead of undefined since undefined is not a valid JSON value
      expect(runtime.getValue("")).toEqual(["a", "b", null]);
      expect(runtime.root.children?.length).toBe(3);
    });

    it("adds new item to array with complex default value", () => {
      const schema: Schema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name", "age"],
        },
      };
      const runtime = new SchemaRuntime(validator, schema, []);

      const result = runtime.addChild("");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual([{ name: "", age: 0 }]);
    });

    it("adds new property to object with additionalProperties", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      const result = runtime.addChild("", "age");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual({ name: "Alice", age: 0 });
      expect(runtime.getNode("/age")).toBeTruthy();
    });

    it("returns false when adding to object without key", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      const result = runtime.addChild("");
      expect(result).toBe(false);
    });

    it("returns false when canAdd is false", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, { name: "Alice" });

      expect(runtime.root.canAdd).toBe(false);
      const result = runtime.addChild("", "extra");
      expect(result).toBe(false);
    });

    it("returns false for non-existent path", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, []);

      const result = runtime.addChild("/nonexistent");
      expect(result).toBe(false);
    });

    it("auto-initializes array container when value is undefined", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, undefined);

      expect(runtime.getValue("")).toBeUndefined();

      const result = runtime.addChild("");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual([""]);
      expect(runtime.root.children?.length).toBe(1);
    });

    it("auto-initializes object container when value is undefined", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: { type: "number" },
      };
      const runtime = new SchemaRuntime(validator, schema, undefined);

      expect(runtime.getValue("")).toBeUndefined();

      const result = runtime.addChild("", "count");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual({ count: 0 });
      expect(runtime.getNode("/count")).toBeTruthy();
    });

    it("auto-initializes nested array container when value is undefined", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: {
          type: "array",
          items: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      // Add first additional property which is an array
      const result1 = runtime.addChild("", "items");
      expect(result1).toBe(true);
      // The value should be an empty array (default for array type)
      expect(runtime.getValue("/items")).toEqual([]);

      // Now add to the nested array
      const result2 = runtime.addChild("/items");
      expect(result2).toBe(true);
      expect(runtime.getValue("/items")).toEqual([""]);
    });

    it("auto-initializes nested object container when value is undefined", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      // Add first additional property which is an object
      const result1 = runtime.addChild("", "config");
      expect(result1).toBe(true);
      // The value should be an empty object (default for object type)
      expect(runtime.getValue("/config")).toEqual({});

      // Now add to the nested object
      const result2 = runtime.addChild("/config", "key1");
      expect(result2).toBe(true);
      expect(runtime.getValue("/config")).toEqual({ key1: "" });
    });

    it("returns false when value exists but type mismatches (array expected, got string)", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      // Value is a string but schema expects array
      const runtime = new SchemaRuntime(validator, schema, "not an array");

      const result = runtime.addChild("");
      expect(result).toBe(false);
      // Original value should be preserved
      expect(runtime.getValue("")).toBe("not an array");
    });

    it("returns false when value exists but type mismatches (object expected, got number)", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: { type: "string" },
      };
      // Value is a number but schema expects object
      const runtime = new SchemaRuntime(validator, schema, 42);

      const result = runtime.addChild("", "key");
      expect(result).toBe(false);
      // Original value should be preserved
      expect(runtime.getValue("")).toBe(42);
    });

    it("auto-initializes when value is null", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, null);

      const result = runtime.addChild("");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual([""]);
    });
  });

  describe("removeEmptyContainers option", () => {
    it("removes empty optional container with default 'auto' strategy", () => {
      // Simulates container.command[] scenario
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: {
          type: "array",
          items: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        command: ["echo"],
      });

      // command field exists and has one item
      expect(runtime.getValue("/command")).toEqual(["echo"]);

      // Remove the only item in command array
      const result = runtime.removeValue("/command/0");
      expect(result).toBe(true);

      // With 'auto' (default), empty optional container should be removed
      expect(runtime.getValue("/command")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({ name: "test" });
    });

    it("keeps empty required container with 'auto' strategy", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["tags"],
      };
      // tags is defined in properties and is required, so canRemove: false
      const runtime = new SchemaRuntime(validator, schema, {
        tags: ["a", "b"],
      });

      // Remove all items - but tags itself is required
      runtime.removeValue("/tags/1");
      runtime.removeValue("/tags/0");

      // Since tags is required (canRemove: false), the empty array should remain
      expect(runtime.getValue("/tags")).toEqual([]);
    });

    it("keeps empty container with 'never' strategy", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: {
          type: "array",
          items: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(
        validator,
        schema,
        {
          name: "test",
          command: ["echo"],
        },
        { removeEmptyContainers: "never" },
      );

      // Remove the only item
      runtime.removeValue("/command/0");

      // With 'never', empty container should remain
      expect(runtime.getValue("/command")).toEqual([]);
      expect(runtime.getValue("")).toEqual({ name: "test", command: [] });
    });

    it("removes empty required container with 'always' strategy", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["tags"],
      };
      const runtime = new SchemaRuntime(
        validator,
        schema,
        { tags: ["a"] },
        { removeEmptyContainers: "always" },
      );

      // Remove the only item
      runtime.removeValue("/tags/0");

      // With 'always', even required container is removed (may cause validation error)
      expect(runtime.getValue("/tags")).toBeUndefined();
    });

    it("recursively removes nested empty optional containers", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: {
          type: "object",
          additionalProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        config: {
          commands: ["echo"],
        },
      });

      // Remove the only item in nested array
      runtime.removeValue("/config/commands/0");

      // Both commands array and config object should be removed
      expect(runtime.getValue("/config/commands")).toBeUndefined();
      expect(runtime.getValue("/config")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({ name: "test" });
    });

    it("stops recursion at required container", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          config: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        required: ["config"],
      };
      const runtime = new SchemaRuntime(validator, schema, {
        config: {
          commands: ["echo"],
        },
      });

      // Remove the only item
      runtime.removeValue("/config/commands/0");

      // commands should be removed, but config (required) should remain
      expect(runtime.getValue("/config/commands")).toBeUndefined();
      expect(runtime.getValue("/config")).toEqual({});
    });

    it("removes empty object container with 'auto' strategy", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        metadata: { key: "value" },
      });

      // Remove the only property in metadata object
      runtime.removeValue("/metadata/key");

      // Empty object should be removed
      expect(runtime.getValue("/metadata")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({ name: "test" });
    });

    it("removes empty patternProperties container with 'auto' strategy", () => {
      const schema: Schema = {
        type: "object",
        patternProperties: {
          "^env_": {
            type: "array",
            items: { type: "string" },
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        env_vars: ["PATH=/usr/bin"],
      });

      // Remove the only item in env_vars array
      runtime.removeValue("/env_vars/0");

      // Empty array should be removed
      expect(runtime.getValue("/env_vars")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({});
    });

    it("does not remove container when other elements exist", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        additionalProperties: {
          type: "array",
          items: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        commands: ["echo", "ls"],
      });

      // Remove one item but another remains
      runtime.removeValue("/commands/0");

      // Container should remain with the other element
      expect(runtime.getValue("/commands")).toEqual(["ls"]);
      expect(runtime.getValue("")).toEqual({ name: "test", commands: ["ls"] });
    });

    it("stops recursion when middle layer has other elements", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        config: {
          commands: ["echo"],
          args: ["--help"],
        },
      });

      // Remove the only item in commands array
      runtime.removeValue("/config/commands/0");

      // commands should be removed, but config should remain (has other property)
      expect(runtime.getValue("/config/commands")).toBeUndefined();
      expect(runtime.getValue("/config")).toEqual({ args: ["--help"] });
    });

    it("removes empty object with 'always' strategy even if required", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["metadata"],
      };
      const runtime = new SchemaRuntime(
        validator,
        schema,
        { metadata: { key: "value" } },
        { removeEmptyContainers: "always" },
      );

      // Remove the only property
      runtime.removeValue("/metadata/key");

      // With 'always', even required container is removed
      expect(runtime.getValue("/metadata")).toBeUndefined();
    });

    it("keeps empty object with 'never' strategy", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(
        validator,
        schema,
        { config: { key: "value" } },
        { removeEmptyContainers: "never" },
      );

      // Remove the only property
      runtime.removeValue("/config/key");

      // With 'never', empty container should remain
      expect(runtime.getValue("/config")).toEqual({});
    });

    it("handles deeply nested optional containers", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        level1: {
          level2: {
            level3: ["value"],
          },
        },
      });

      // Remove the only item at the deepest level
      runtime.removeValue("/level1/level2/level3/0");

      // All empty containers should be removed
      expect(runtime.getValue("/level1/level2/level3")).toBeUndefined();
      expect(runtime.getValue("/level1/level2")).toBeUndefined();
      expect(runtime.getValue("/level1")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({});
    });

    it("removes empty array in optional properties with 'auto' strategy", () => {
      // Properties without required are optional and should be removable
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          container: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                items: { type: "string" },
              },
            },
            // commands is NOT in required, so it's optional
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        container: {
          commands: ["echo"],
        },
      });

      // Remove the only item in commands array
      runtime.removeValue("/container/commands/0");

      // Empty array should be removed since commands is optional
      expect(runtime.getValue("/container/commands")).toBeUndefined();
      // container is also optional, so it should be removed too
      expect(runtime.getValue("/container")).toBeUndefined();
      expect(runtime.getValue("")).toEqual({ name: "test" });
    });

    it("keeps empty array in required properties with 'auto' strategy", () => {
      // Properties listed in required should NOT be removed
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          container: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["commands"], // commands is required
          },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        container: {
          commands: ["echo"],
        },
      });

      // Remove the only item in commands array
      runtime.removeValue("/container/commands/0");

      // Empty array should remain since commands is required
      expect(runtime.getValue("/container/commands")).toEqual([]);
      // container should also remain since it has content
      expect(runtime.getValue("/container")).toEqual({ commands: [] });
      expect(runtime.getValue("")).toEqual({
        name: "test",
        container: { commands: [] },
      });
    });

    it("removes empty array in properties but stops at required parent", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          container: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                items: { type: "string" },
              },
            },
            // commands is optional
          },
        },
        required: ["container"], // container is required
      };
      const runtime = new SchemaRuntime(validator, schema, {
        container: {
          commands: ["echo"],
        },
      });

      // Remove the only item in commands array
      runtime.removeValue("/container/commands/0");

      // Empty commands should be removed (optional)
      expect(runtime.getValue("/container/commands")).toBeUndefined();
      // But container should remain empty since it's required
      expect(runtime.getValue("/container")).toEqual({});
      expect(runtime.getValue("")).toEqual({ container: {} });
    });
  });
});
