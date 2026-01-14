import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Conditional Schema Changes (if-then-else)", () => {
  const validator = new Validator();

  describe("Type changes from then/else branches", () => {
    it("updates schema type when dependency value changes", () => {
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
      let valueNode = runtime.getNode("/value");
      expect(valueNode?.schema.type).toBe("string");

      // Change to type B -> else branch -> value is number
      runtime.setValue("/type", "B");
      valueNode = runtime.getNode("/value");
      expect(valueNode?.schema.type).toBe("number");

      // Change back to type A
      runtime.setValue("/type", "A");
      valueNode = runtime.getNode("/value");
      expect(valueNode?.schema.type).toBe("string");
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
      let configNode = runtime.getNode("/config");
      expect(configNode?.schema.type).toBe("string");
      expect(configNode?.schema.title).toBe("Simple Config");
      expect(configNode?.schema.description).toBe(
        "Enter a simple configuration value",
      );

      // Change to advanced -> else branch -> object with advanced title
      runtime.setValue("/mode", "advanced");
      configNode = runtime.getNode("/config");
      expect(configNode?.schema.type).toBe("object");
      expect(configNode?.schema.title).toBe("Advanced Config");
      expect(configNode?.schema.description).toBe("Configure advanced options");
    });
  });

  describe("Enum constraints from then/else branches", () => {
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
      let planNode = runtime.getNode("/plan");
      expect(planNode?.schema.enum).toEqual(["free", "basic"]);

      // Change to premium -> then branch -> plan enum is ["gold", "platinum", "diamond"]
      runtime.setValue("/userType", "premium");
      planNode = runtime.getNode("/plan");
      expect(planNode?.schema.enum).toEqual(["gold", "platinum", "diamond"]);
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
      expect(runtime.getNode("/submittedBy")).toBeTruthy();
      expect(runtime.getNode("/reviewedBy")).toBeUndefined();

      // approved -> then branch -> reviewedBy
      runtime.setValue("/status", "approved");
      expect(runtime.getNode("/reviewedBy")).toBeTruthy();
      expect(runtime.getNode("/submittedBy")).toBeUndefined();

      // rejected -> then branch -> reviewedBy
      runtime.setValue("/status", "rejected");
      expect(runtime.getNode("/reviewedBy")).toBeTruthy();
      expect(runtime.getNode("/submittedBy")).toBeUndefined();

      // back to pending -> else branch -> submittedBy
      runtime.setValue("/status", "pending");
      expect(runtime.getNode("/submittedBy")).toBeTruthy();
      expect(runtime.getNode("/reviewedBy")).toBeUndefined();
    });
  });

  describe("Format constraints from then/else branches", () => {
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
      let contactNode = runtime.getNode("/contact");
      expect(contactNode?.schema.format).toBe("email");

      // Change to website -> else branch -> format is "uri"
      runtime.setValue("/contactType", "website");
      contactNode = runtime.getNode("/contact");
      expect(contactNode?.schema.format).toBe("uri");
    });
  });

  describe("String constraints from then/else branches", () => {
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
      let valueNode = runtime.getNode("/value");
      expect(valueNode?.schema.minLength).toBe(1);
      expect(valueNode?.schema.maxLength).toBe(10);

      // Change to long -> else branch -> minLength 10, maxLength 100
      runtime.setValue("/fieldType", "long");
      valueNode = runtime.getNode("/value");
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
      let idNode = runtime.getNode("/id");
      expect(idNode?.schema.pattern).toBe("^[0-9]+$");

      // Change to alphanumeric -> else branch -> alphanumeric pattern
      runtime.setValue("/idType", "alphanumeric");
      idNode = runtime.getNode("/id");
      expect(idNode?.schema.pattern).toBe("^[A-Z]{2}-[0-9]+$");
    });
  });

  describe("Numeric constraints from then/else branches", () => {
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
      let ageNode = runtime.getNode("/age");
      expect(ageNode?.schema.minimum).toBe(0);
      expect(ageNode?.schema.maximum).toBe(17);

      // Change to adult -> else branch -> minimum 18, maximum 120
      runtime.setValue("/ageGroup", "adult");
      ageNode = runtime.getNode("/age");
      expect(ageNode?.schema.minimum).toBe(18);
      expect(ageNode?.schema.maximum).toBe(120);
    });
  });

  describe("Other schema properties from then/else branches", () => {
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
      let logLevelNode = runtime.getNode("/logLevel");
      expect(logLevelNode?.schema.default).toBe("debug");

      // Change to production -> then branch -> default is "error"
      runtime.setValue("/environment", "production");
      logLevelNode = runtime.getNode("/logLevel");
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
      let dataNode = runtime.getNode("/data");
      expect(dataNode?.schema.readOnly).toBe(true);

      // Change to editable -> else branch -> readOnly false
      runtime.setValue("/accessMode", "editable");
      dataNode = runtime.getNode("/data");
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
      let itemsNode = runtime.getNode("/items");
      expect(itemsNode?.schema.items).toEqual({ type: "number", minimum: 0 });

      // Change to strings -> else branch -> items are strings
      runtime.setValue("/listType", "strings");
      itemsNode = runtime.getNode("/items");
      expect(itemsNode?.schema.items).toEqual({ type: "string", minLength: 1 });
    });
  });
});
