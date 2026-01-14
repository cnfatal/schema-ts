import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Conditional Schema Validation Error Clearing", () => {
  const validator = new Validator();

  describe("Validation error clearing on condition change", () => {
    it("clears type mismatch error when condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          mode: { type: "string" },
        },
        if: {
          properties: { mode: { const: "text" } },
        },
        then: {
          properties: {
            value: { type: "string" },
          },
        },
        else: {
          properties: {
            value: { type: "number" },
          },
        },
      };

      // Start with mode=text, but value is a number (type mismatch)
      const runtime = new SchemaRuntime(validator, schema, {
        mode: "text",
        value: 123, // Should be string for mode=text
      });

      // Should have error: value should be string
      runtime.validate("/value");
      let valueNode = runtime.getNode("/value");
      expect(valueNode?.error).toBeDefined();
      expect(valueNode?.error?.valid).toBe(false);

      // Change mode to "number" -> value: number is now valid
      runtime.setValue("/mode", "number");
      valueNode = runtime.getNode("/value");
      expect(valueNode?.error).toBeUndefined();
    });

    it("clears enum mismatch error when condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          tier: { type: "string" },
        },
        if: {
          properties: { tier: { const: "premium" } },
        },
        then: {
          properties: {
            plan: { type: "string", enum: ["gold", "platinum"] },
          },
        },
        else: {
          properties: {
            plan: { type: "string", enum: ["free", "basic"] },
          },
        },
      };

      // Start with tier=premium, but plan="free" (not in premium enum)
      const runtime = new SchemaRuntime(validator, schema, {
        tier: "premium",
        plan: "free", // Invalid for premium tier
      });

      // Should have error: plan not in ["gold", "platinum"]
      runtime.validate("/plan");
      let planNode = runtime.getNode("/plan");
      expect(planNode?.error).toBeDefined();
      expect(planNode?.error?.valid).toBe(false);

      // Change tier to "basic" -> plan="free" is now valid
      runtime.setValue("/tier", "basic");
      planNode = runtime.getNode("/plan");
      expect(planNode?.error).toBeUndefined();
    });

    it("clears pattern mismatch error when condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          idFormat: { type: "string" },
        },
        if: {
          properties: { idFormat: { const: "numeric" } },
        },
        then: {
          properties: {
            id: { type: "string", pattern: "^[0-9]+$" },
          },
        },
        else: {
          properties: {
            id: { type: "string", pattern: "^[A-Z]+$" },
          },
        },
      };

      // Start with idFormat=numeric, but id="ABC" (doesn't match numeric pattern)
      const runtime = new SchemaRuntime(validator, schema, {
        idFormat: "numeric",
        id: "ABC", // Invalid for numeric format
      });

      // Should have error: id doesn't match ^[0-9]+$
      runtime.validate("/id");
      let idNode = runtime.getNode("/id");
      expect(idNode?.error).toBeDefined();
      expect(idNode?.error?.valid).toBe(false);

      // Change idFormat to "alpha" -> id="ABC" now matches ^[A-Z]+$
      runtime.setValue("/idFormat", "alpha");
      idNode = runtime.getNode("/id");
      expect(idNode?.error).toBeUndefined();
    });

    it("clears minimum/maximum error when condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          ageGroup: { type: "string" },
        },
        if: {
          properties: { ageGroup: { const: "child" } },
        },
        then: {
          properties: {
            age: { type: "number", minimum: 0, maximum: 17 },
          },
        },
        else: {
          properties: {
            age: { type: "number", minimum: 18, maximum: 120 },
          },
        },
      };

      // Start with ageGroup=child, but age=25 (exceeds maximum 17)
      const runtime = new SchemaRuntime(validator, schema, {
        ageGroup: "child",
        age: 25, // Invalid for child group
      });

      // Should have error: age exceeds maximum 17
      runtime.validate("/age");
      let ageNode = runtime.getNode("/age");
      expect(ageNode?.error).toBeDefined();
      expect(ageNode?.error?.valid).toBe(false);

      // Change ageGroup to "adult" -> age=25 is now valid (18-120)
      runtime.setValue("/ageGroup", "adult");
      ageNode = runtime.getNode("/age");
      expect(ageNode?.error).toBeUndefined();
    });

    it("clears minLength error when condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          stringType: { type: "string" },
        },
        if: {
          properties: { stringType: { const: "long" } },
        },
        then: {
          properties: {
            text: { type: "string", minLength: 20 },
          },
        },
        else: {
          properties: {
            text: { type: "string", minLength: 1 },
          },
        },
      };

      // Start with stringType=long, but text is too short
      const runtime = new SchemaRuntime(validator, schema, {
        stringType: "long",
        text: "short", // Only 5 chars, requires 20
      });

      // Should have error: text too short
      runtime.validate("/text");
      let textNode = runtime.getNode("/text");
      expect(textNode?.error).toBeDefined();
      expect(textNode?.error?.valid).toBe(false);

      // Change stringType to "short" -> text="short" is now valid (minLength: 1)
      runtime.setValue("/stringType", "short");
      textNode = runtime.getNode("/text");
      expect(textNode?.error).toBeUndefined();
    });

    it("clears nested if-then-else validation error on outer condition change", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          mode: { type: "string" },
        },
        if: {
          properties: { enabled: { const: true } },
        },
        then: {
          if: {
            properties: { mode: { const: "strict" } },
          },
          then: {
            properties: {
              value: { type: "number", minimum: 100 },
            },
          },
          else: {
            properties: {
              value: { type: "number", minimum: 0 },
            },
          },
        },
        else: {
          properties: {
            value: { type: "string" },
          },
        },
      };

      // Start with enabled=true, mode=strict, but value=50 (below minimum 100)
      const runtime = new SchemaRuntime(validator, schema, {
        enabled: true,
        mode: "strict",
        value: 50, // Invalid for strict mode (minimum: 100)
      });

      // Should have error: value below minimum 100
      runtime.validate("/value");
      let valueNode = runtime.getNode("/value");
      expect(valueNode?.error).toBeDefined();
      expect(valueNode?.error?.valid).toBe(false);

      // Change enabled to false -> value becomes string type, 50 is invalid
      runtime.setValue("/enabled", false);
      runtime.validate("/value");
      valueNode = runtime.getNode("/value");
      // Now value=50 is invalid because it should be string
      expect(valueNode?.error).toBeDefined();

      // Set value to string -> now valid
      runtime.setValue("/value", "some text");
      valueNode = runtime.getNode("/value");
      expect(valueNode?.error).toBeUndefined();
    });

    it("clears error when changing inner condition of nested if-then-else", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          level: { type: "string" },
        },
        if: {
          properties: { enabled: { const: true } },
        },
        then: {
          if: {
            properties: { level: { const: "high" } },
          },
          then: {
            properties: {
              count: { type: "number", minimum: 100 },
            },
          },
          else: {
            properties: {
              count: { type: "number", minimum: 1 },
            },
          },
        },
      };

      // Start with enabled=true, level=high, but count=10 (below minimum 100)
      const runtime = new SchemaRuntime(validator, schema, {
        enabled: true,
        level: "high",
        count: 10, // Invalid for level=high (minimum: 100)
      });

      // Should have error: count below minimum 100
      runtime.validate("/count");
      let countNode = runtime.getNode("/count");
      expect(countNode?.error).toBeDefined();
      expect(countNode?.error?.valid).toBe(false);

      // Change level to "low" -> count=10 is now valid (minimum: 1)
      runtime.setValue("/level", "low");
      countNode = runtime.getNode("/count");
      expect(countNode?.error).toBeUndefined();
    });
  });
});
