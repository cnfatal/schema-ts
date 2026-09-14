import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

const validator = new Validator();

describe("Conditional evaluation against materialized defaults", () => {
  describe("falsy default selects the correct branch on first build", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "cfg" },
        enabled: { type: "boolean", default: false },
      },
      if: { properties: { enabled: { const: true } } },
      then: { properties: { url: { type: "string" } } },
      else: {},
    };

    it("hides then fields when the toggle defaults to false", () => {
      const rt = new SchemaRuntime(validator, schema, {});
      expect(rt.getValue("/enabled")).toBe(false);
      expect(rt.getNode("/url")).toBeUndefined();
    });

    it("shows then fields when the toggle is enabled", () => {
      const rt = new SchemaRuntime(validator, schema, { enabled: true });
      expect(rt.getNode("/url")).toBeDefined();
    });

    it("reacts to toggling on and off", () => {
      const rt = new SchemaRuntime(validator, schema, {});
      expect(rt.getNode("/url")).toBeUndefined();
      rt.setValue("/enabled", true);
      expect(rt.getNode("/url")).toBeDefined();
      rt.setValue("/enabled", false);
      expect(rt.getNode("/url")).toBeUndefined();
    });
  });

  describe("defaulted discriminator selects then on first build", () => {
    const schema: Schema = {
      type: "object",
      properties: { mode: { type: "string", default: "advanced" } },
      if: { properties: { mode: { const: "advanced" } }, required: ["mode"] },
      then: { properties: { advancedOpt: { type: "string" } } },
      else: { properties: { basicOpt: { type: "string" } } },
    };

    it("uses the default value of the discriminator", () => {
      const rt = new SchemaRuntime(validator, schema, {});
      expect(rt.getValue("/mode")).toBe("advanced");
      expect(rt.getNode("/advancedOpt")).toBeDefined();
      expect(rt.getNode("/basicOpt")).toBeUndefined();
    });
  });

  describe("JSON Schema vacuous semantics are preserved", () => {
    const schema: Schema = {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      if: { properties: { enabled: { const: true } } },
      then: { properties: { url: { type: "string" } } },
      else: {},
    };

    it("still applies then when the discriminator is absent with no default/required", () => {
      const rt = new SchemaRuntime(validator, schema, {});
      // No default and no required: properties does not validate absent keys.
      expect(rt.getNode("/url")).toBeDefined();
    });

    it("hides then when BetterNormalizer is opted in", () => {
      const rt = new SchemaRuntime(
        validator,
        schema,
        {},
        { normalizer: "better" },
      );
      expect(rt.getNode("/url")).toBeUndefined();
    });
  });

  describe("nested objects", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        imageAuth: {
          type: "object",
          properties: { enabled: { type: "boolean", default: false } },
          if: { properties: { enabled: { const: true } } },
          then: {
            properties: {
              username: { type: "string" },
              password: { type: "string" },
            },
          },
        },
      },
    };

    it("materializes nested defaults and hides gated fields", () => {
      const rt = new SchemaRuntime(validator, schema, { imageAuth: {} });
      expect(rt.getValue("/imageAuth/enabled")).toBe(false);
      expect(rt.getNode("/imageAuth/username")).toBeUndefined();
    });

    it("preserves the vacuous result when the object itself is absent", () => {
      // imageAuth has no default, so it is not materialized; enabled stays
      // absent and the vacuous if matches. This is the JSON Schema contract
      // and is why schema authors should add required or opt into
      // BetterNormalizer.
      const rt = new SchemaRuntime(validator, schema, {});
      expect(rt.getNode("/imageAuth/username")).toBeDefined();
    });

    it("hides gated fields for an absent object with BetterNormalizer", () => {
      const rt = new SchemaRuntime(
        validator,
        schema,
        {},
        { normalizer: "better" },
      );
      expect(rt.getNode("/imageAuth/username")).toBeUndefined();
    });
  });

  describe("defaults for required children of optional objects", () => {
    it("applies the zero value of a required child", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              name: { type: "string" },
              flag: { type: "boolean" },
              count: { type: "integer" },
            },
            required: ["name", "flag", "count"],
          },
        },
      };
      const rt = new SchemaRuntime(validator, schema, { config: {} });
      expect(rt.getValue("/config")).toEqual({
        name: "",
        flag: false,
        count: 0,
      });
    });
  });
});
