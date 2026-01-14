import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Nested Conditional Schema (if-then-else)", () => {
  const validator = new Validator();

  describe("Two-level nested if-then-else", () => {
    it("handles two-level nested if-then-else with else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          category: { type: "string" },
          subCategory: { type: "string" },
        },
        if: {
          properties: { category: { const: "electronics" } },
        },
        then: {
          if: {
            properties: { subCategory: { const: "phone" } },
          },
          then: {
            properties: { model: { type: "string" } },
          },
          else: {
            properties: { brand: { type: "string" } },
          },
        },
        else: {
          properties: { description: { type: "string" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        category: "electronics",
        subCategory: "phone",
        model: "iPhone 15",
      });

      // electronics + phone -> then -> then -> model
      expect(runtime.getNode("/model")).toBeTruthy();
      expect(runtime.getNode("/brand")).toBeUndefined();
      expect(runtime.getNode("/description")).toBeUndefined();

      // Change subCategory to laptop -> electronics + laptop -> then -> else -> brand
      runtime.setValue("/subCategory", "laptop");
      expect(runtime.getNode("/model")).toBeUndefined();
      expect(runtime.getNode("/brand")).toBeTruthy();
      expect(runtime.getNode("/description")).toBeUndefined();

      // Change category to furniture -> else -> description
      runtime.setValue("/category", "furniture");
      expect(runtime.getNode("/model")).toBeUndefined();
      expect(runtime.getNode("/brand")).toBeUndefined();
      expect(runtime.getNode("/description")).toBeTruthy();
    });

    it("handles nested if-then-else inside else branch", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          primary: { type: "string" },
          secondary: { type: "string" },
        },
        if: {
          properties: { primary: { const: "main" } },
        },
        then: {
          properties: { mainResult: { type: "string" } },
        },
        else: {
          if: {
            properties: { secondary: { const: "fallback" } },
          },
          then: {
            properties: { fallbackResult: { type: "string" } },
          },
          else: {
            properties: { defaultResult: { type: "string" } },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        primary: "main",
        secondary: "any",
      });

      // primary = main -> mainResult
      expect(runtime.getNode("/mainResult")).toBeTruthy();
      expect(runtime.getNode("/fallbackResult")).toBeUndefined();
      expect(runtime.getNode("/defaultResult")).toBeUndefined();

      // primary != main, secondary = fallback -> fallbackResult
      runtime.setValue("/primary", "other");
      runtime.setValue("/secondary", "fallback");
      expect(runtime.getNode("/mainResult")).toBeUndefined();
      expect(runtime.getNode("/fallbackResult")).toBeTruthy();
      expect(runtime.getNode("/defaultResult")).toBeUndefined();

      // primary != main, secondary != fallback -> defaultResult
      runtime.setValue("/secondary", "other");
      expect(runtime.getNode("/mainResult")).toBeUndefined();
      expect(runtime.getNode("/fallbackResult")).toBeUndefined();
      expect(runtime.getNode("/defaultResult")).toBeTruthy();
    });
  });

  describe("Three-level nested if-then-else", () => {
    it("handles multi-level (3 levels) nested if-then-else", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          level1: { type: "string" },
          level2: { type: "string" },
          level3: { type: "string" },
        },
        if: {
          properties: { level1: { const: "A" } },
        },
        then: {
          if: {
            properties: { level2: { const: "B" } },
          },
          then: {
            if: {
              properties: { level3: { const: "C" } },
            },
            then: {
              properties: { deepResult: { type: "string" } },
            },
            else: {
              properties: { level3Fallback: { type: "string" } },
            },
          },
          else: {
            properties: { level2Fallback: { type: "string" } },
          },
        },
        else: {
          properties: { level1Fallback: { type: "string" } },
        },
      };

      // Test all paths through the nested conditions
      const runtime = new SchemaRuntime(validator, schema, {
        level1: "A",
        level2: "B",
        level3: "C",
        deepResult: "success",
      });

      // A + B + C -> deepResult
      expect(runtime.getNode("/deepResult")).toBeTruthy();
      expect(runtime.root.dependencies?.has("/level1")).toBe(true);
      expect(runtime.root.dependencies?.has("/level2")).toBe(true);
      expect(runtime.root.dependencies?.has("/level3")).toBe(true);

      // Change level3 -> A + B + not C -> level3Fallback
      runtime.setValue("/level3", "X");
      expect(runtime.getNode("/deepResult")).toBeUndefined();
      expect(runtime.getNode("/level3Fallback")).toBeTruthy();

      // Change level2 -> A + not B -> level2Fallback
      runtime.setValue("/level2", "X");
      expect(runtime.getNode("/level3Fallback")).toBeUndefined();
      expect(runtime.getNode("/level2Fallback")).toBeTruthy();

      // Change level1 -> not A -> level1Fallback
      runtime.setValue("/level1", "X");
      expect(runtime.getNode("/level2Fallback")).toBeUndefined();
      expect(runtime.getNode("/level1Fallback")).toBeTruthy();
    });
  });

  describe("Nested if-then-else with enum conditions", () => {
    it("handles nested if-then-else with enum conditions at multiple levels", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["food", "electronics", "clothing"],
          },
          quality: {
            type: "string",
            enum: ["low", "medium", "high", "premium"],
          },
        },
        if: {
          properties: { category: { enum: ["electronics", "clothing"] } },
        },
        then: {
          if: {
            properties: { quality: { enum: ["high", "premium"] } },
          },
          then: {
            properties: { warranty: { type: "boolean" } },
          },
          else: {
            properties: { discount: { type: "number" } },
          },
        },
        else: {
          properties: { expiryDate: { type: "string", format: "date" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        category: "food",
        quality: "medium",
      });

      // food -> else -> expiryDate
      expect(runtime.getNode("/expiryDate")).toBeTruthy();
      expect(runtime.getNode("/warranty")).toBeUndefined();
      expect(runtime.getNode("/discount")).toBeUndefined();

      // electronics + medium -> then -> else -> discount
      runtime.setValue("/category", "electronics");
      expect(runtime.getNode("/expiryDate")).toBeUndefined();
      expect(runtime.getNode("/warranty")).toBeUndefined();
      expect(runtime.getNode("/discount")).toBeTruthy();

      // electronics + premium -> then -> then -> warranty
      runtime.setValue("/quality", "premium");
      expect(runtime.getNode("/expiryDate")).toBeUndefined();
      expect(runtime.getNode("/warranty")).toBeTruthy();
      expect(runtime.getNode("/discount")).toBeUndefined();

      // clothing + high -> then -> then -> warranty
      runtime.setValue("/category", "clothing");
      expect(runtime.getNode("/warranty")).toBeTruthy();

      // clothing + low -> then -> else -> discount
      runtime.setValue("/quality", "low");
      expect(runtime.getNode("/warranty")).toBeUndefined();
      expect(runtime.getNode("/discount")).toBeTruthy();
    });
  });

  describe("Nested if-then-else with different schema types", () => {
    it("handles nested if-then-else with different schema types", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          type: { type: "string" },
          subtype: { type: "string" },
        },
        if: {
          properties: { type: { const: "payment" } },
        },
        then: {
          properties: {
            amount: { type: "number" },
          },
          if: {
            properties: { subtype: { const: "credit" } },
          },
          then: {
            properties: {
              cardNumber: { type: "string", minLength: 10 },
            },
          },
          else: {
            properties: {
              accountNumber: { type: "string", maxLength: 20 },
            },
          },
        },
        else: {
          properties: {
            notes: { type: "string" },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        type: "payment",
        subtype: "credit",
        cardNumber: "1234567890",
      });

      // payment + credit -> cardNumber with minLength
      expect(runtime.getNode("/cardNumber")?.schema.minLength).toBe(10);
      expect(runtime.getNode("/accountNumber")).toBeUndefined();
      expect(runtime.getNode("/notes")).toBeUndefined();

      // Change to debit -> accountNumber with maxLength
      runtime.setValue("/subtype", "debit");
      expect(runtime.getNode("/cardNumber")).toBeUndefined();
      expect(runtime.getNode("/accountNumber")?.schema.maxLength).toBe(20);

      // Change to non-payment -> notes
      runtime.setValue("/type", "other");
      expect(runtime.getNode("/cardNumber")).toBeUndefined();
      expect(runtime.getNode("/accountNumber")).toBeUndefined();
      expect(runtime.getNode("/notes")).toBeTruthy();
    });
  });
});
