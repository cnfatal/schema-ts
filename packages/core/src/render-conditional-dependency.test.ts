import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Conditional Dependency Tracking", () => {
  const validator = new Validator();

  describe("Basic dependency tracking from if condition", () => {
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
      expect(runtime.root.dependencies?.has("/mode")).toBe(true);

      // Initially no extra field
      expect(runtime.getNode("/extra")).toBeUndefined();

      // Change mode to "advanced" - should trigger schema update
      runtime.setValue("/mode", "advanced");

      // Now extra field should exist
      const extraNode = runtime.getNode("/extra");
      expect(extraNode).toBeTruthy();
    });

    it("tracks dependencies from if conditions with enum arrays", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          role: { type: "string", enum: ["user", "admin", "superadmin"] },
        },
        if: {
          properties: { role: { enum: ["admin", "superadmin"] } },
        },
        then: {
          properties: {
            permissions: { type: "array", items: { type: "string" } },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        role: "user",
      });

      // Should have dependency on /role
      expect(runtime.root.dependencies?.has("/role")).toBe(true);

      // user -> no permissions
      expect(runtime.getNode("/permissions")).toBeUndefined();

      // admin -> permissions
      runtime.setValue("/role", "admin");
      expect(runtime.getNode("/permissions")).toBeTruthy();

      // superadmin -> permissions
      runtime.setValue("/role", "superadmin");
      expect(runtime.getNode("/permissions")).toBeTruthy();

      // user -> no permissions
      runtime.setValue("/role", "user");
      expect(runtime.getNode("/permissions")).toBeUndefined();
    });
  });

  describe("Multi-field dependency tracking in nested conditions", () => {
    it("handles nested conditional schemas with multiple dependencies", () => {
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
      expect(runtime.root.dependencies?.has("/mode")).toBe(true);
      expect(runtime.root.dependencies?.has("/level")).toBe(true);

      // Test that changing /level triggers update even when mode doesn't match
      runtime.setValue("/level", 10);
      // This should complete without error (dependency tracking works)
      expect(runtime.getValue("/level")).toBe(10);
    });

    it("handles complex multi-field dependencies (country/state/city)", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          country: { type: "string" },
          state: { type: "string" },
          city: { type: "string" },
        },
        if: {
          properties: { country: { const: "USA" } },
        },
        then: {
          if: {
            properties: { state: { const: "CA" } },
          },
          then: {
            if: {
              properties: { city: { const: "LA" } },
            },
            then: {
              properties: { region: { const: "Los Angeles Metro" } },
            },
            else: {
              properties: { region: { const: "Other California" } },
            },
          },
          else: {
            properties: { region: { const: "Other US State" } },
          },
        },
        else: {
          properties: { region: { const: "International" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        country: "USA",
        state: "CA",
        city: "LA",
      });

      // Verify all dependencies are tracked
      expect(runtime.root.dependencies?.has("/country")).toBe(true);
      expect(runtime.root.dependencies?.has("/state")).toBe(true);
      expect(runtime.root.dependencies?.has("/city")).toBe(true);

      // USA + CA + LA -> Los Angeles Metro
      let regionNode = runtime.getNode("/region");
      expect(regionNode?.schema.const).toBe("Los Angeles Metro");

      // USA + CA + SF -> Other California
      runtime.setValue("/city", "SF");
      regionNode = runtime.getNode("/region");
      expect(regionNode?.schema.const).toBe("Other California");

      // USA + NY -> Other US State
      runtime.setValue("/state", "NY");
      regionNode = runtime.getNode("/region");
      expect(regionNode?.schema.const).toBe("Other US State");

      // Canada -> International
      runtime.setValue("/country", "Canada");
      regionNode = runtime.getNode("/region");
      expect(regionNode?.schema.const).toBe("International");
    });
  });

  describe("Sibling if-then-else dependency tracking", () => {
    it("handles sibling if-then-else blocks with nested conditions", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          enableA: { type: "boolean" },
          typeA: { type: "string" },
          enableB: { type: "boolean" },
          typeB: { type: "string" },
        },
        allOf: [
          {
            if: { properties: { enableA: { const: true } } },
            then: {
              if: { properties: { typeA: { const: "premium" } } },
              then: { properties: { premiumFeatureA: { type: "string" } } },
              else: { properties: { basicFeatureA: { type: "string" } } },
            },
          },
          {
            if: { properties: { enableB: { const: true } } },
            then: {
              if: { properties: { typeB: { const: "premium" } } },
              then: { properties: { premiumFeatureB: { type: "string" } } },
              else: { properties: { basicFeatureB: { type: "string" } } },
            },
          },
        ],
      };

      const runtime = new SchemaRuntime(validator, schema, {
        enableA: true,
        typeA: "premium",
        enableB: false,
        typeB: "basic",
      });

      // enableA=true, typeA=premium -> premiumFeatureA
      expect(runtime.getNode("/premiumFeatureA")).toBeTruthy();
      expect(runtime.getNode("/basicFeatureA")).toBeUndefined();
      // enableB=false -> no B features
      expect(runtime.getNode("/premiumFeatureB")).toBeUndefined();
      expect(runtime.getNode("/basicFeatureB")).toBeUndefined();

      // Enable B with basic type
      runtime.setValue("/enableB", true);
      expect(runtime.getNode("/basicFeatureB")).toBeTruthy();
      expect(runtime.getNode("/premiumFeatureB")).toBeUndefined();

      // Change A to basic
      runtime.setValue("/typeA", "basic");
      expect(runtime.getNode("/premiumFeatureA")).toBeUndefined();
      expect(runtime.getNode("/basicFeatureA")).toBeTruthy();
    });
  });
});
