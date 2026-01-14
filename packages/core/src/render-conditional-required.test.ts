import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Conditional Required Fields (if-then-else)", () => {
  const validator = new Validator();

  describe("Basic required from then/else branches", () => {
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
  });

  describe("Nested if-then-else required", () => {
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
  });

  describe("Required field restoration on condition change", () => {
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
});
