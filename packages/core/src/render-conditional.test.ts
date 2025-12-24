import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Conditional Dependencies", () => {
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
      expect(runtime.root.dependencies?.has("/mode")).toBe(true);

      // Initially no extra field
      expect(runtime.findNode("/extra")).toBeUndefined();

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

    it("applies enum constraints from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          userType: { type: "string" },
        },
        if: {
          properties: { userType: { const: "premium" } },
        },
        then: {
          properties: {
            plan: { type: "string", enum: ["gold", "platinum", "diamond"] },
          },
        },
        else: {
          properties: {
            plan: { type: "string", enum: ["free", "basic"] },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        userType: "regular",
        plan: "free",
      });

      // regular -> else branch -> plan enum is ["free", "basic"]
      let planNode = runtime.findNode("/plan");
      expect(planNode?.schema.enum).toEqual(["free", "basic"]);

      // Change to premium -> then branch -> plan enum is ["gold", "platinum", "diamond"]
      runtime.setValue("/userType", "premium");
      planNode = runtime.findNode("/plan");
      expect(planNode?.schema.enum).toEqual(["gold", "platinum", "diamond"]);
    });

    it("applies format constraints from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          contactType: { type: "string" },
        },
        if: {
          properties: { contactType: { const: "email" } },
        },
        then: {
          properties: {
            contact: { type: "string", format: "email" },
          },
        },
        else: {
          properties: {
            contact: { type: "string", format: "uri" },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        contactType: "email",
        contact: "test@example.com",
      });

      // email -> then branch -> format is "email"
      let contactNode = runtime.findNode("/contact");
      expect(contactNode?.schema.format).toBe("email");

      // Change to website -> else branch -> format is "uri"
      runtime.setValue("/contactType", "website");
      contactNode = runtime.findNode("/contact");
      expect(contactNode?.schema.format).toBe("uri");
    });

    it("applies minLength/maxLength constraints from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          fieldType: { type: "string" },
        },
        if: {
          properties: { fieldType: { const: "short" } },
        },
        then: {
          properties: {
            value: { type: "string", minLength: 1, maxLength: 10 },
          },
        },
        else: {
          properties: {
            value: { type: "string", minLength: 10, maxLength: 100 },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        fieldType: "short",
        value: "hello",
      });

      // short -> then branch -> minLength 1, maxLength 10
      let valueNode = runtime.findNode("/value");
      expect(valueNode?.schema.minLength).toBe(1);
      expect(valueNode?.schema.maxLength).toBe(10);

      // Change to long -> else branch -> minLength 10, maxLength 100
      runtime.setValue("/fieldType", "long");
      valueNode = runtime.findNode("/value");
      expect(valueNode?.schema.minLength).toBe(10);
      expect(valueNode?.schema.maxLength).toBe(100);
    });

    it("applies pattern constraints from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          idType: { type: "string" },
        },
        if: {
          properties: { idType: { const: "numeric" } },
        },
        then: {
          properties: {
            id: { type: "string", pattern: "^[0-9]+$" },
          },
        },
        else: {
          properties: {
            id: { type: "string", pattern: "^[A-Z]{2}-[0-9]+$" },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        idType: "numeric",
        id: "12345",
      });

      // numeric -> then branch -> numeric pattern
      let idNode = runtime.findNode("/id");
      expect(idNode?.schema.pattern).toBe("^[0-9]+$");

      // Change to alphanumeric -> else branch -> alphanumeric pattern
      runtime.setValue("/idType", "alphanumeric");
      idNode = runtime.findNode("/id");
      expect(idNode?.schema.pattern).toBe("^[A-Z]{2}-[0-9]+$");
    });

    it("applies minimum/maximum constraints from then/else branches", () => {
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

      const runtime = new SchemaRuntime(validator, schema, {
        ageGroup: "child",
        age: 10,
      });

      // child -> then branch -> minimum 0, maximum 17
      let ageNode = runtime.findNode("/age");
      expect(ageNode?.schema.minimum).toBe(0);
      expect(ageNode?.schema.maximum).toBe(17);

      // Change to adult -> else branch -> minimum 18, maximum 120
      runtime.setValue("/ageGroup", "adult");
      ageNode = runtime.findNode("/age");
      expect(ageNode?.schema.minimum).toBe(18);
      expect(ageNode?.schema.maximum).toBe(120);
    });

    it("applies title/description from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          mode: { type: "string" },
        },
        if: {
          properties: { mode: { const: "simple" } },
        },
        then: {
          properties: {
            config: {
              type: "string",
              title: "Simple Config",
              description: "Enter a simple configuration value",
            },
          },
        },
        else: {
          properties: {
            config: {
              type: "object",
              title: "Advanced Config",
              description: "Configure advanced options",
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        mode: "simple",
        config: "value",
      });

      // simple -> then branch -> string with simple title
      let configNode = runtime.findNode("/config");
      expect(configNode?.schema.type).toBe("string");
      expect(configNode?.schema.title).toBe("Simple Config");
      expect(configNode?.schema.description).toBe(
        "Enter a simple configuration value",
      );

      // Change to advanced -> else branch -> object with advanced title
      runtime.setValue("/mode", "advanced");
      configNode = runtime.findNode("/config");
      expect(configNode?.schema.type).toBe("object");
      expect(configNode?.schema.title).toBe("Advanced Config");
      expect(configNode?.schema.description).toBe("Configure advanced options");
    });

    it("applies default values from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          environment: { type: "string" },
        },
        if: {
          properties: { environment: { const: "production" } },
        },
        then: {
          properties: {
            logLevel: { type: "string", default: "error" },
          },
        },
        else: {
          properties: {
            logLevel: { type: "string", default: "debug" },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        environment: "development",
      });

      // development -> else branch -> default is "debug"
      let logLevelNode = runtime.findNode("/logLevel");
      expect(logLevelNode?.schema.default).toBe("debug");

      // Change to production -> then branch -> default is "error"
      runtime.setValue("/environment", "production");
      logLevelNode = runtime.findNode("/logLevel");
      expect(logLevelNode?.schema.default).toBe("error");
    });

    it("applies readOnly/writeOnly from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          accessMode: { type: "string" },
        },
        if: {
          properties: { accessMode: { const: "readonly" } },
        },
        then: {
          properties: {
            data: { type: "string", readOnly: true },
          },
        },
        else: {
          properties: {
            data: { type: "string", readOnly: false },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        accessMode: "readonly",
        data: "some value",
      });

      // readonly -> then branch -> readOnly true
      let dataNode = runtime.findNode("/data");
      expect(dataNode?.schema.readOnly).toBe(true);

      // Change to editable -> else branch -> readOnly false
      runtime.setValue("/accessMode", "editable");
      dataNode = runtime.findNode("/data");
      expect(dataNode?.schema.readOnly).toBe(false);
    });

    it("applies array items schema from then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          listType: { type: "string" },
        },
        if: {
          properties: { listType: { const: "numbers" } },
        },
        then: {
          properties: {
            items: {
              type: "array",
              items: { type: "number", minimum: 0 },
            },
          },
        },
        else: {
          properties: {
            items: {
              type: "array",
              items: { type: "string", minLength: 1 },
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        listType: "numbers",
        items: [1, 2, 3],
      });

      // numbers -> then branch -> items are numbers
      let itemsNode = runtime.findNode("/items");
      expect(itemsNode?.schema.items).toEqual({ type: "number", minimum: 0 });

      // Change to strings -> else branch -> items are strings
      runtime.setValue("/listType", "strings");
      itemsNode = runtime.findNode("/items");
      expect(itemsNode?.schema.items).toEqual({ type: "string", minLength: 1 });
    });

    it("applies required from then/else branches to effective schema", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          paymentMethod: { type: "string" },
          cardNumber: { type: "string" },
          bankAccount: { type: "string" },
        },
        if: {
          properties: { paymentMethod: { const: "card" } },
        },
        then: {
          required: ["cardNumber"],
        },
        else: {
          required: ["bankAccount"],
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        paymentMethod: "card",
        cardNumber: "1234-5678",
      });

      // card -> then branch -> required includes "cardNumber"
      expect(runtime.root.schema.required).toContain("cardNumber");
      expect(runtime.root.schema.required).not.toContain("bankAccount");

      // Change to bank -> else branch -> required includes "bankAccount"
      runtime.setValue("/paymentMethod", "bank");
      expect(runtime.root.schema.required).toContain("bankAccount");
      expect(runtime.root.schema.required).not.toContain("cardNumber");
    });

    it("merges required from base schema with then/else branches", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string" },
          license: { type: "string" },
          registration: { type: "string" },
        },
        required: ["name"], // Base required field
        if: {
          properties: { type: { const: "professional" } },
        },
        then: {
          required: ["license"],
        },
        else: {
          required: ["registration"],
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        name: "John",
        type: "professional",
        license: "ABC123",
      });

      // professional -> then branch -> required: ["name", "license"]
      expect(runtime.root.schema.required).toContain("name");
      expect(runtime.root.schema.required).toContain("license");
      expect(runtime.root.schema.required).not.toContain("registration");

      // Change to personal -> else branch -> required: ["name", "registration"]
      runtime.setValue("/type", "personal");
      expect(runtime.root.schema.required).toContain("name");
      expect(runtime.root.schema.required).toContain("registration");
      expect(runtime.root.schema.required).not.toContain("license");
    });

    it("applies required from nested if-then-else", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          category: { type: "string" },
          subCategory: { type: "string" },
          model: { type: "string" },
          size: { type: "string" },
          color: { type: "string" },
        },
        if: {
          properties: { category: { const: "electronics" } },
        },
        then: {
          if: {
            properties: { subCategory: { const: "phone" } },
          },
          then: {
            required: ["model"],
          },
          else: {
            required: ["size"],
          },
        },
        else: {
          required: ["color"],
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        category: "electronics",
        subCategory: "phone",
        model: "iPhone",
      });

      // electronics + phone -> nested then -> required: ["model"]
      expect(runtime.root.schema.required).toContain("model");
      expect(runtime.root.schema.required).not.toContain("size");
      expect(runtime.root.schema.required).not.toContain("color");

      // electronics + laptop -> nested else -> required: ["size"]
      runtime.setValue("/subCategory", "laptop");
      expect(runtime.root.schema.required).toContain("size");
      expect(runtime.root.schema.required).not.toContain("model");
      expect(runtime.root.schema.required).not.toContain("color");

      // clothing -> outer else -> required: ["color"]
      runtime.setValue("/category", "clothing");
      expect(runtime.root.schema.required).toContain("color");
      expect(runtime.root.schema.required).not.toContain("model");
      expect(runtime.root.schema.required).not.toContain("size");
    });

    it("restores required fields when if condition changes from success to failure", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          isAdvanced: { type: "boolean" },
          basicField: { type: "string" },
          advancedConfig: { type: "string" },
          simpleConfig: { type: "string" },
        },
        required: ["basicField"], // Always required
        if: {
          properties: { isAdvanced: { const: true } },
        },
        then: {
          required: ["advancedConfig"],
        },
        else: {
          required: ["simpleConfig"],
        },
      };

      // Start with isAdvanced=true -> then branch -> required: ["basicField", "advancedConfig"]
      const runtime = new SchemaRuntime(validator, schema, {
        isAdvanced: true,
        basicField: "base",
        advancedConfig: "advanced",
      });

      // Verify then branch required
      expect(runtime.root.schema.required).toContain("basicField");
      expect(runtime.root.schema.required).toContain("advancedConfig");
      expect(runtime.root.schema.required).not.toContain("simpleConfig");

      // Change isAdvanced to false -> if fails -> else branch -> required: ["basicField", "simpleConfig"]
      runtime.setValue("/isAdvanced", false);
      expect(runtime.root.schema.required).toContain("basicField");
      expect(runtime.root.schema.required).toContain("simpleConfig");
      expect(runtime.root.schema.required).not.toContain("advancedConfig");

      // Change back to true -> if succeeds -> then branch -> required: ["basicField", "advancedConfig"]
      runtime.setValue("/isAdvanced", true);
      expect(runtime.root.schema.required).toContain("basicField");
      expect(runtime.root.schema.required).toContain("advancedConfig");
      expect(runtime.root.schema.required).not.toContain("simpleConfig");
    });

    it("restores required fields in nested if-then-else when outer condition fails", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          mode: { type: "string" },
          strictField: { type: "string" },
          normalField: { type: "string" },
          disabledField: { type: "string" },
        },
        if: {
          properties: { enabled: { const: true } },
        },
        then: {
          if: {
            properties: { mode: { const: "strict" } },
          },
          then: {
            required: ["strictField"],
          },
          else: {
            required: ["normalField"],
          },
        },
        else: {
          required: ["disabledField"],
        },
      };

      // Start with enabled=true, mode=strict -> nested then -> required: ["strictField"]
      const runtime = new SchemaRuntime(validator, schema, {
        enabled: true,
        mode: "strict",
        strictField: "value",
      });

      expect(runtime.root.schema.required).toContain("strictField");
      expect(runtime.root.schema.required).not.toContain("normalField");
      expect(runtime.root.schema.required).not.toContain("disabledField");

      // Change mode to normal -> nested else -> required: ["normalField"]
      runtime.setValue("/mode", "normal");
      expect(runtime.root.schema.required).toContain("normalField");
      expect(runtime.root.schema.required).not.toContain("strictField");
      expect(runtime.root.schema.required).not.toContain("disabledField");

      // Change enabled to false -> outer else -> required: ["disabledField"]
      runtime.setValue("/enabled", false);
      expect(runtime.root.schema.required).toContain("disabledField");
      expect(runtime.root.schema.required).not.toContain("strictField");
      expect(runtime.root.schema.required).not.toContain("normalField");

      // Change enabled back to true -> should restore to nested else (mode is still "normal")
      runtime.setValue("/enabled", true);
      expect(runtime.root.schema.required).toContain("normalField");
      expect(runtime.root.schema.required).not.toContain("strictField");
      expect(runtime.root.schema.required).not.toContain("disabledField");
    });

    it("restores required fields when enum condition changes", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["draft", "pending", "approved", "rejected"],
          },
          draftNotes: { type: "string" },
          approvalDoc: { type: "string" },
          rejectionReason: { type: "string" },
        },
        if: {
          properties: { status: { enum: ["approved", "rejected"] } },
        },
        then: {
          if: {
            properties: { status: { const: "approved" } },
          },
          then: {
            required: ["approvalDoc"],
          },
          else: {
            required: ["rejectionReason"],
          },
        },
        else: {
          required: ["draftNotes"],
        },
      };

      // Start with status=draft -> else branch -> required: ["draftNotes"]
      const runtime = new SchemaRuntime(validator, schema, {
        status: "draft",
        draftNotes: "initial notes",
      });

      expect(runtime.root.schema.required).toContain("draftNotes");
      expect(runtime.root.schema.required).not.toContain("approvalDoc");
      expect(runtime.root.schema.required).not.toContain("rejectionReason");

      // Change to approved -> then -> then -> required: ["approvalDoc"]
      runtime.setValue("/status", "approved");
      expect(runtime.root.schema.required).toContain("approvalDoc");
      expect(runtime.root.schema.required).not.toContain("draftNotes");
      expect(runtime.root.schema.required).not.toContain("rejectionReason");

      // Change to rejected -> then -> else -> required: ["rejectionReason"]
      runtime.setValue("/status", "rejected");
      expect(runtime.root.schema.required).toContain("rejectionReason");
      expect(runtime.root.schema.required).not.toContain("approvalDoc");
      expect(runtime.root.schema.required).not.toContain("draftNotes");

      // Change back to pending -> else branch -> required: ["draftNotes"]
      runtime.setValue("/status", "pending");
      expect(runtime.root.schema.required).toContain("draftNotes");
      expect(runtime.root.schema.required).not.toContain("approvalDoc");
      expect(runtime.root.schema.required).not.toContain("rejectionReason");
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
      expect(runtime.root.dependencies?.has("/mode")).toBe(true);
      expect(runtime.root.dependencies?.has("/level")).toBe(true);

      // Test that changing /level triggers update even when mode doesn't match
      runtime.setValue("/level", 10);
      // This should complete without error (dependency tracking works)
      expect(runtime.getValue("/level")).toBe(10);
    });

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
      expect(runtime.findNode("/model")).toBeTruthy();
      expect(runtime.findNode("/brand")).toBeUndefined();
      expect(runtime.findNode("/description")).toBeUndefined();

      // Change subCategory to laptop -> electronics + laptop -> then -> else -> brand
      runtime.setValue("/subCategory", "laptop");
      expect(runtime.findNode("/model")).toBeUndefined();
      expect(runtime.findNode("/brand")).toBeTruthy();
      expect(runtime.findNode("/description")).toBeUndefined();

      // Change category to furniture -> else -> description
      runtime.setValue("/category", "furniture");
      expect(runtime.findNode("/model")).toBeUndefined();
      expect(runtime.findNode("/brand")).toBeUndefined();
      expect(runtime.findNode("/description")).toBeTruthy();
    });

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
      expect(runtime.findNode("/deepResult")).toBeTruthy();
      expect(runtime.root.dependencies?.has("/level1")).toBe(true);
      expect(runtime.root.dependencies?.has("/level2")).toBe(true);
      expect(runtime.root.dependencies?.has("/level3")).toBe(true);

      // Change level3 -> A + B + not C -> level3Fallback
      runtime.setValue("/level3", "X");
      expect(runtime.findNode("/deepResult")).toBeUndefined();
      expect(runtime.findNode("/level3Fallback")).toBeTruthy();

      // Change level2 -> A + not B -> level2Fallback
      runtime.setValue("/level2", "X");
      expect(runtime.findNode("/level3Fallback")).toBeUndefined();
      expect(runtime.findNode("/level2Fallback")).toBeTruthy();

      // Change level1 -> not A -> level1Fallback
      runtime.setValue("/level1", "X");
      expect(runtime.findNode("/level2Fallback")).toBeUndefined();
      expect(runtime.findNode("/level1Fallback")).toBeTruthy();
    });

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
      expect(runtime.findNode("/premiumFeatureA")).toBeTruthy();
      expect(runtime.findNode("/basicFeatureA")).toBeUndefined();
      // enableB=false -> no B features
      expect(runtime.findNode("/premiumFeatureB")).toBeUndefined();
      expect(runtime.findNode("/basicFeatureB")).toBeUndefined();

      // Enable B with basic type
      runtime.setValue("/enableB", true);
      expect(runtime.findNode("/basicFeatureB")).toBeTruthy();
      expect(runtime.findNode("/premiumFeatureB")).toBeUndefined();

      // Change A to basic
      runtime.setValue("/typeA", "basic");
      expect(runtime.findNode("/premiumFeatureA")).toBeUndefined();
      expect(runtime.findNode("/basicFeatureA")).toBeTruthy();
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
      expect(runtime.findNode("/mainResult")).toBeTruthy();
      expect(runtime.findNode("/fallbackResult")).toBeUndefined();
      expect(runtime.findNode("/defaultResult")).toBeUndefined();

      // primary != main, secondary = fallback -> fallbackResult
      runtime.setValue("/primary", "other");
      runtime.setValue("/secondary", "fallback");
      expect(runtime.findNode("/mainResult")).toBeUndefined();
      expect(runtime.findNode("/fallbackResult")).toBeTruthy();
      expect(runtime.findNode("/defaultResult")).toBeUndefined();

      // primary != main, secondary != fallback -> defaultResult
      runtime.setValue("/secondary", "other");
      expect(runtime.findNode("/mainResult")).toBeUndefined();
      expect(runtime.findNode("/fallbackResult")).toBeUndefined();
      expect(runtime.findNode("/defaultResult")).toBeTruthy();
    });

    it("handles nested conditions with complex multi-field dependencies", () => {
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
      let regionNode = runtime.findNode("/region");
      expect(regionNode?.schema.const).toBe("Los Angeles Metro");

      // USA + CA + SF -> Other California
      runtime.setValue("/city", "SF");
      regionNode = runtime.findNode("/region");
      expect(regionNode?.schema.const).toBe("Other California");

      // USA + NY -> Other US State
      runtime.setValue("/state", "NY");
      regionNode = runtime.findNode("/region");
      expect(regionNode?.schema.const).toBe("Other US State");

      // Canada -> International
      runtime.setValue("/country", "Canada");
      regionNode = runtime.findNode("/region");
      expect(regionNode?.schema.const).toBe("International");
    });

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
      expect(runtime.findNode("/cardNumber")?.schema.minLength).toBe(10);
      expect(runtime.findNode("/accountNumber")).toBeUndefined();
      expect(runtime.findNode("/notes")).toBeUndefined();

      // Change to debit -> accountNumber with maxLength
      runtime.setValue("/subtype", "debit");
      expect(runtime.findNode("/cardNumber")).toBeUndefined();
      expect(runtime.findNode("/accountNumber")?.schema.maxLength).toBe(20);

      // Change to non-payment -> notes
      runtime.setValue("/type", "other");
      expect(runtime.findNode("/cardNumber")).toBeUndefined();
      expect(runtime.findNode("/accountNumber")).toBeUndefined();
      expect(runtime.findNode("/notes")).toBeTruthy();
    });

    it("handles if-then-else with enum condition", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
        },
        if: {
          properties: { status: { enum: ["approved", "rejected"] } },
        },
        then: {
          properties: { reviewedBy: { type: "string" } },
        },
        else: {
          properties: { submittedBy: { type: "string" } },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {
        status: "pending",
        submittedBy: "user1",
      });

      // pending -> else branch -> submittedBy
      expect(runtime.findNode("/submittedBy")).toBeTruthy();
      expect(runtime.findNode("/reviewedBy")).toBeUndefined();

      // approved -> then branch -> reviewedBy
      runtime.setValue("/status", "approved");
      expect(runtime.findNode("/reviewedBy")).toBeTruthy();
      expect(runtime.findNode("/submittedBy")).toBeUndefined();

      // rejected -> then branch -> reviewedBy
      runtime.setValue("/status", "rejected");
      expect(runtime.findNode("/reviewedBy")).toBeTruthy();
      expect(runtime.findNode("/submittedBy")).toBeUndefined();

      // back to pending -> else branch -> submittedBy
      runtime.setValue("/status", "pending");
      expect(runtime.findNode("/submittedBy")).toBeTruthy();
      expect(runtime.findNode("/reviewedBy")).toBeUndefined();
    });

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
      expect(runtime.findNode("/expiryDate")).toBeTruthy();
      expect(runtime.findNode("/warranty")).toBeUndefined();
      expect(runtime.findNode("/discount")).toBeUndefined();

      // electronics + medium -> then -> else -> discount
      runtime.setValue("/category", "electronics");
      expect(runtime.findNode("/expiryDate")).toBeUndefined();
      expect(runtime.findNode("/warranty")).toBeUndefined();
      expect(runtime.findNode("/discount")).toBeTruthy();

      // electronics + premium -> then -> then -> warranty
      runtime.setValue("/quality", "premium");
      expect(runtime.findNode("/expiryDate")).toBeUndefined();
      expect(runtime.findNode("/warranty")).toBeTruthy();
      expect(runtime.findNode("/discount")).toBeUndefined();

      // clothing + high -> then -> then -> warranty
      runtime.setValue("/category", "clothing");
      expect(runtime.findNode("/warranty")).toBeTruthy();

      // clothing + low -> then -> else -> discount
      runtime.setValue("/quality", "low");
      expect(runtime.findNode("/warranty")).toBeUndefined();
      expect(runtime.findNode("/discount")).toBeTruthy();
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
      expect(runtime.findNode("/permissions")).toBeUndefined();

      // admin -> permissions
      runtime.setValue("/role", "admin");
      expect(runtime.findNode("/permissions")).toBeTruthy();

      // superadmin -> permissions
      runtime.setValue("/role", "superadmin");
      expect(runtime.findNode("/permissions")).toBeTruthy();

      // user -> no permissions
      runtime.setValue("/role", "user");
      expect(runtime.findNode("/permissions")).toBeUndefined();
    });
  });
});
