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

      const node0 = runtime.findNode("/0");
      const node1 = runtime.findNode("/1");
      const node2 = runtime.findNode("/2");

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
      expect(runtime.findNode("/0")?.canRemove).toBe(false);
      expect(runtime.findNode("/1")?.canRemove).toBe(false);
      // items can be removed
      expect(runtime.findNode("/2")?.canRemove).toBe(true);
      expect(runtime.findNode("/3")?.canRemove).toBe(true);
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
      expect(runtime.findNode("/name")?.canRemove).toBe(false);
      // additionalProperties can be removed
      expect(runtime.findNode("/age")?.canRemove).toBe(true);
      expect(runtime.findNode("/score")?.canRemove).toBe(true);
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

      expect(runtime.findNode("/S_name")?.canRemove).toBe(true);
      expect(runtime.findNode("/S_city")?.canRemove).toBe(true);
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

      expect(runtime.findNode("/name")?.canRemove).toBe(false);
      expect(runtime.findNode("/age")?.canRemove).toBe(false);
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
      expect(runtime.findNode("/age")).toBeUndefined();
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

      const result = runtime.addValue("");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual(["a", "b", ""]);
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

      const result = runtime.addValue("");
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

      const result = runtime.addValue("", "age");
      expect(result).toBe(true);
      expect(runtime.getValue("")).toEqual({ name: "Alice", age: 0 });
      expect(runtime.findNode("/age")).toBeTruthy();
    });

    it("returns false when adding to object without key", () => {
      const schema: Schema = {
        type: "object",
        additionalProperties: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      const result = runtime.addValue("");
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
      const result = runtime.addValue("", "extra");
      expect(result).toBe(false);
    });

    it("returns false for non-existent path", () => {
      const schema: Schema = {
        type: "array",
        items: { type: "string" },
      };
      const runtime = new SchemaRuntime(validator, schema, []);

      const result = runtime.addValue("/nonexistent");
      expect(result).toBe(false);
    });
  });
});
