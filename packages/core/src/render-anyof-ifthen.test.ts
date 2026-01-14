import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("anyOf with Multiple if-then Branches", () => {
  const validator = new Validator();

  it("should merge multiple successful anyOf branches (if/then vacuously true behavior)", () => {
    // In JSON Schema, if the 'if' condition doesn't match, the whole 'if/then' is STILL valid.
    // This is why anyOf needs to merge all matching branches to catch the one that actually applied 'then'.
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
        value: { type: "string" },
      },
      anyOf: [
        {
          if: { properties: { type: { const: "A" } } },
          then: { properties: { value: { title: "Title A" } } },
        },
        {
          if: { properties: { type: { const: "B" } } },
          then: { properties: { value: { title: "Title B" } } },
        },
      ],
    };

    // Case 1: type is "A"
    const runtimeA = new SchemaRuntime(validator, schema, {
      type: "A",
      value: "test",
    });
    const nodeA = runtimeA.getNode("/value");
    // Branch 1 matches 'if' and applies 'then' (title: Title A)
    // Branch 2 doesn't match 'if', so it's valid but doesn't apply 'then'
    // Result should be Title A
    expect(nodeA?.schema.title).toBe("Title A");

    // Case 2: type is "B"
    const runtimeB = new SchemaRuntime(validator, schema, {
      type: "B",
      value: "test",
    });
    const nodeB = runtimeB.getNode("/value");
    // Branch 1 doesn't match 'if' -> valid
    // Branch 2 matches 'if' -> applies 'then' (title: Title B)
    // Result should be Title B
    expect(nodeB?.schema.title).toBe("Title B");
  });

  it("should merge overlapping anyOf branches", () => {
    const schema: Schema = {
      type: "object",
      anyOf: [
        {
          if: { properties: { x: { const: true } } },
          then: { properties: { result: { description: "Desc X" } } },
        },
        {
          if: { properties: { y: { const: true } } },
          then: { properties: { result: { title: "Title Y" } } },
        },
      ],
    };

    // If both x and y are true, both branches apply their 'then'
    const runtime = new SchemaRuntime(validator, schema, {
      x: true,
      y: true,
      result: "val",
    });
    const node = runtime.getNode("/result");

    expect(node?.schema.description).toBe("Desc X");
    expect(node?.schema.title).toBe("Title Y");
  });

  it("should handle nested conditions in anyOf", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        category: { type: "string" },
        subCategory: { type: "string" },
        value: { type: "string" },
      },
      anyOf: [
        {
          if: { properties: { category: { const: "A" } } },
          then: {
            anyOf: [
              {
                if: { properties: { subCategory: { const: "A1" } } },
                then: { properties: { value: { title: "Val A1" } } },
              },
              {
                if: { properties: { subCategory: { const: "A2" } } },
                then: { properties: { value: { description: "Desc A2" } } },
              },
            ],
          },
        },
      ],
    };

    // Case: Category A, Sub A1.
    // Outer anyOf Branch 1 is valid.
    // Inner anyOf Branch 1 matches A1.
    // Inner anyOf Branch 2 is vacuously valid.
    const runtime = new SchemaRuntime(validator, schema, {
      category: "A",
      subCategory: "A1",
    });
    const node = runtime.getNode("/value");
    expect(node?.schema.title).toBe("Val A1");

    // Case: Category A, Sub A2.
    const runtime2 = new SchemaRuntime(validator, schema, {
      category: "A",
      subCategory: "A2",
    });
    const node2 = runtime2.getNode("/value");
    expect(node2?.schema.description).toBe("Desc A2");
  });
});

describe("if-then-else with const vs required+const", () => {
  const validator = new Validator();

  describe("const-only behavior (vacuously true when property missing)", () => {
    it("if condition passes when checked property is missing (const-only)", () => {
      // This demonstrates the JSON Schema behavior where:
      // - properties only validates keys that EXIST in the value
      // - if a property doesn't exist, the const check is SKIPPED
      // - this causes the if condition to pass unexpectedly
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
        },
        if: {
          properties: { enabled: { const: true } },
        },
        then: {
          properties: {
            config: { type: "string", title: "Config (then branch)" },
          },
        },
        else: {
          properties: {
            config: { type: "string", title: "Config (else branch)" },
          },
        },
      };

      // Case 1: enabled is missing -> const check is SKIPPED -> if passes -> then branch
      // This is often unexpected behavior!
      const runtime1 = new SchemaRuntime(validator, schema, {});
      const node1 = runtime1.getNode("/config");
      // Without required, missing property causes if to pass (vacuously true)
      expect(node1?.schema.title).toBe("Config (then branch)");

      // Case 2: enabled is explicitly undefined -> key EXISTS so const check runs
      // undefined !== true -> const check fails -> else branch
      // Note: This is different from Case 1 where the key doesn't exist at all!
      const runtime2 = new SchemaRuntime(validator, schema, {
        enabled: undefined,
      });
      const node2 = runtime2.getNode("/config");
      // In JavaScript: "enabled" in { enabled: undefined } === true
      // So const check runs: undefined !== true -> fails -> else branch
      expect(node2?.schema.title).toBe("Config (else branch)");

      // Case 3: enabled is false -> const check fails -> else branch
      const runtime3 = new SchemaRuntime(validator, schema, { enabled: false });
      const node3 = runtime3.getNode("/config");
      expect(node3?.schema.title).toBe("Config (else branch)");

      // Case 4: enabled is true -> const check passes -> then branch
      const runtime4 = new SchemaRuntime(validator, schema, { enabled: true });
      const node4 = runtime4.getNode("/config");
      expect(node4?.schema.title).toBe("Config (then branch)");
    });

    it("anyOf branches all pass when checked properties are missing (const-only)", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [
          {
            if: { properties: { x: { const: true } } },
            then: { properties: { result: { description: "X is true" } } },
          },
          {
            if: { properties: { y: { const: true } } },
            then: { properties: { result: { title: "Y is true" } } },
          },
        ],
      };

      // When both x and y are missing, both if conditions pass (vacuously)
      // Both then branches are applied
      const runtime = new SchemaRuntime(validator, schema, { result: "test" });
      const node = runtime.getNode("/result");

      // Both then branches are merged because both if conditions passed
      expect(node?.schema.description).toBe("X is true");
      expect(node?.schema.title).toBe("Y is true");
    });
  });

  describe("required+const behavior (correctly fails when property missing)", () => {
    it("if condition fails when checked property is missing (required+const)", () => {
      // Adding required ensures the if condition fails when property is missing
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
        },
        if: {
          required: ["enabled"],
          properties: { enabled: { const: true } },
        },
        then: {
          properties: {
            config: { type: "string", title: "Config (then branch)" },
          },
        },
        else: {
          properties: {
            config: { type: "string", title: "Config (else branch)" },
          },
        },
      };

      // Case 1: enabled is missing -> required fails -> if fails -> else branch
      const runtime1 = new SchemaRuntime(validator, schema, {});
      const node1 = runtime1.getNode("/config");
      expect(node1?.schema.title).toBe("Config (else branch)");

      // Case 2: enabled is false -> const check fails -> else branch
      const runtime2 = new SchemaRuntime(validator, schema, { enabled: false });
      const node2 = runtime2.getNode("/config");
      expect(node2?.schema.title).toBe("Config (else branch)");

      // Case 3: enabled is true -> both required and const pass -> then branch
      const runtime3 = new SchemaRuntime(validator, schema, { enabled: true });
      const node3 = runtime3.getNode("/config");
      expect(node3?.schema.title).toBe("Config (then branch)");
    });

    it("anyOf branches correctly selected when using required+const", () => {
      const schema: Schema = {
        type: "object",
        anyOf: [
          {
            if: {
              required: ["x"],
              properties: { x: { const: true } },
            },
            then: { properties: { result: { description: "X is true" } } },
          },
          {
            if: {
              required: ["y"],
              properties: { y: { const: true } },
            },
            then: { properties: { result: { title: "Y is true" } } },
          },
        ],
      };

      // When both x and y are missing, both if conditions FAIL
      // Neither then branch is applied
      const runtime1 = new SchemaRuntime(validator, schema, { result: "test" });
      const node1 = runtime1.getNode("/result");
      expect(node1?.schema.description).toBeUndefined();
      expect(node1?.schema.title).toBeUndefined();

      // When only x is true, only first then branch is applied
      const runtime2 = new SchemaRuntime(validator, schema, {
        x: true,
        result: "test",
      });
      const node2 = runtime2.getNode("/result");
      expect(node2?.schema.description).toBe("X is true");
      expect(node2?.schema.title).toBeUndefined();

      // When both x and y are true, both then branches are applied
      const runtime3 = new SchemaRuntime(validator, schema, {
        x: true,
        y: true,
        result: "test",
      });
      const node3 = runtime3.getNode("/result");
      expect(node3?.schema.description).toBe("X is true");
      expect(node3?.schema.title).toBe("Y is true");
    });
  });

  describe("toggle switch pattern (common UI scenario)", () => {
    it("toggle switch without required - unexpected initial behavior", () => {
      // Common pattern: show/hide fields based on a boolean switch
      // Problem: if enabled is not set, users expect else branch, but get then branch
      const schema: Schema = {
        type: "object",
        properties: {
          imageAuth: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: false },
            },
            if: {
              properties: { enabled: { const: true } },
            },
            then: {
              properties: {
                username: { type: "string", title: "Username" },
                password: { type: "string", title: "Password" },
              },
            },
          },
        },
      };

      // Initial load with empty object - enabled is missing
      // Without required, if passes -> then branch (shows username/password)
      // This is usually NOT what users expect!
      const runtime = new SchemaRuntime(validator, schema, {
        imageAuth: {},
      });
      const usernameNode = runtime.getNode("/imageAuth/username");
      expect(usernameNode).toBeDefined();
      expect(usernameNode?.schema.title).toBe("Username");
    });

    it("toggle switch with required - correct initial behavior", () => {
      // Fixed pattern: use required+const to ensure correct behavior
      const schema: Schema = {
        type: "object",
        properties: {
          imageAuth: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: false },
            },
            if: {
              required: ["enabled"],
              properties: { enabled: { const: true } },
            },
            then: {
              properties: {
                username: { type: "string", title: "Username" },
                password: { type: "string", title: "Password" },
              },
            },
          },
        },
      };

      // Initial load with empty object - enabled is missing
      // With required, if fails -> else branch (no username/password shown)
      const runtime1 = new SchemaRuntime(validator, schema, {
        imageAuth: {},
      });
      const usernameNode1 = runtime1.getNode("/imageAuth/username");
      expect(usernameNode1).toBeUndefined();

      // When enabled is explicitly set to true, then branch activates
      const runtime2 = new SchemaRuntime(validator, schema, {
        imageAuth: { enabled: true },
      });
      const usernameNode2 = runtime2.getNode("/imageAuth/username");
      expect(usernameNode2).toBeDefined();
      expect(usernameNode2?.schema.title).toBe("Username");
    });

    it("nested toggle switches with required+const", () => {
      // Complex scenario: network config with nested toggles
      const schema: Schema = {
        type: "object",
        properties: {
          network: {
            type: "object",
            properties: {
              externalAccess: {
                type: "object",
                properties: {
                  enabled: { type: "boolean", default: false },
                },
                if: {
                  required: ["enabled"],
                  properties: { enabled: { const: true } },
                },
                then: {
                  properties: {
                    port: { type: "number", title: "External Port" },
                    ssl: {
                      type: "object",
                      properties: {
                        enabled: { type: "boolean", default: false },
                      },
                      if: {
                        required: ["enabled"],
                        properties: { enabled: { const: true } },
                      },
                      then: {
                        properties: {
                          certificate: { type: "string", title: "Certificate" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // Initial: all switches off
      const runtime1 = new SchemaRuntime(validator, schema, {
        network: { externalAccess: {} },
      });
      expect(runtime1.getNode("/network/externalAccess/port")).toBeUndefined();

      // Enable external access only (ssl object doesn't exist in value)
      const runtime2 = new SchemaRuntime(validator, schema, {
        network: { externalAccess: { enabled: true } },
      });
      expect(runtime2.getNode("/network/externalAccess/port")).toBeDefined();
      // Note: ssl is defined in 'then' schema, but the ssl VALUE doesn't exist
      // So when ssl schema is processed, its 'if' condition (required: ["enabled"])
      // fails because ssl value is undefined -> else branch (no certificate)
      // However, the node for ssl/certificate may still exist in the tree if
      // the ssl object was auto-created as empty {}
      // This is a subtle edge case!

      // Enable external access with explicit ssl: {} (ssl object exists but enabled missing)
      const runtime2b = new SchemaRuntime(validator, schema, {
        network: { externalAccess: { enabled: true, ssl: {} } },
      });
      expect(runtime2b.getNode("/network/externalAccess/port")).toBeDefined();
      // ssl object exists, enabled is missing, required: ["enabled"] fails -> else branch
      expect(
        runtime2b.getNode("/network/externalAccess/ssl/certificate"),
      ).toBeUndefined();

      // Enable both external access and SSL
      const runtime3 = new SchemaRuntime(validator, schema, {
        network: { externalAccess: { enabled: true, ssl: { enabled: true } } },
      });
      expect(runtime3.getNode("/network/externalAccess/port")).toBeDefined();
      expect(
        runtime3.getNode("/network/externalAccess/ssl/certificate"),
      ).toBeDefined();
    });
  });
});
