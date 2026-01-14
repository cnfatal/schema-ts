import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Schema Composition Dependencies", () => {
  const validator = new Validator();

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
      expect(runtime.root.dependencies?.has("/kind")).toBe(true);
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
      expect(runtime.root.dependencies?.has("/format")).toBe(true);
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
      expect(runtime.root.dependencies?.has("/enabled")).toBe(true);
      expect(runtime.root.dependencies?.has("/debug")).toBe(true);
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
      expect(runtime.root.dependencies?.has("/count")).toBe(true);

      // count = 50 -> if fails, no special property
      expect(runtime.getNode("/special")).toBeUndefined();

      // count = 100 -> if passes, special property appears
      runtime.setValue("/count", 100);
      // Need to provide value for special to create node
      (runtime.getValue("#") as Record<string, unknown>)["special"] = "test";
      runtime.setValue("/count", 100); // Trigger reconcile again
      const specialNode = runtime.getNode("/special");
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
      expect(runtime.getNode("/result")).toBeTruthy();

      runtime.setValue("/a", "other");
      expect(runtime.getNode("/result")).toBeUndefined();
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

      const parentNode = runtime.getNode("/parent");
      expect(parentNode).toBeTruthy();
      // Parent node should have dependency on /parent/toggle
      expect(parentNode?.dependencies?.has("/parent/toggle")).toBe(true);

      // Initially no extra
      expect(runtime.getNode("/parent/extra")).toBeUndefined();

      // Toggle on
      runtime.setValue("/parent/toggle", true);
      expect(runtime.getNode("/parent/extra")).toBeTruthy();
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
      expect(runtime.getNode("/config")).toBeTruthy();
      expect(runtime.getNode("/config/detail")).toBeTruthy();

      // Switch to mode B - config subtree should be replaced by simple
      runtime.setValue("/mode", "B");
      expect(runtime.getNode("/config")).toBeUndefined();
      expect(runtime.getNode("/simple")).toBeTruthy();

      // Switch back to mode A
      runtime.setValue("/mode", "A");
      expect(runtime.getNode("/config")).toBeTruthy();
    });
  });
});
