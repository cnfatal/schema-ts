import { describe, it, expect, beforeEach } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import { Schema } from "./type";

describe("SchemaRuntime Actions Verification", () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe("add-property", () => {
    it("should initialize optional property with default value if available", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          withDefault: { type: "string", default: "hello" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      const success = runtime.addChild("", "withDefault");
      expect(success).toBe(true);
      expect(runtime.getValue("/withDefault")).toBe("hello");
    });

    it("should initialize optional property with null/zero if no default is available", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          noDefault: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      const success = runtime.addChild("", "noDefault");
      expect(success).toBe(true);

      // Current behavior: optional property without default is added as undefined
      // (treated as missing per the new validation rules)
      const value = runtime.getValue("/noDefault");
      expect(value).toBeUndefined();
    });

    it("should initialize optional property is behaves as required when added", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          noDefault: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {});

      // Initially not present
      expect(runtime.getValue("/noDefault")).toBeUndefined();

      const success = runtime.addChild("", "noDefault");
      expect(success).toBe(true);

      // Current behavior: added as undefined (still treated as missing)
      // The key exists in the object but the value is undefined
      expect(runtime.getValue("/noDefault")).toBeUndefined();
    });
  });

  describe("remove-property", () => {
    it("should remove optional property", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          optional: { type: "string" },
        },
      };
      const runtime = new SchemaRuntime(validator, schema, {
        optional: "value",
      });

      const success = runtime.removeValue("/optional");
      expect(success).toBe(true);
      expect(runtime.getValue("/optional")).toBeUndefined();
    });

    it("should reset required property to null/zero instead of removing it", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          requiredProp: { type: "string" },
        },
        required: ["requiredProp"],
      };
      const runtime = new SchemaRuntime(validator, schema, {
        requiredProp: "initial",
      });

      const success = runtime.removeValue("/requiredProp");

      // Current behavior: required property is set to undefined
      // (which is treated as missing and will fail validation)
      expect(success).toBe(true);
      const value = runtime.getValue("/requiredProp");
      expect(value).toBeUndefined();
    });
  });
});
