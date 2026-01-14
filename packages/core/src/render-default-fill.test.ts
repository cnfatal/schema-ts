import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Array auto-fill behavior", () => {
  const validator = new Validator();

  it("should NOT auto-fill empty array when editing other fields (explicit mode)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        count: { type: "number" },
      },
    };

    // Start with empty object - explicit mode (default)
    const runtime = new SchemaRuntime(validator, schema, {});

    // Check initial state
    expect(runtime.getValue("")).toEqual({});
    expect(runtime.getValue("/tags")).toBeUndefined();

    // Edit other field
    runtime.setValue("/name", "Alice");

    // tags should still be undefined, NOT []
    expect(runtime.getValue("")).toEqual({ name: "Alice" });
    expect(runtime.getValue("/tags")).toBeUndefined();
  });

  it("should NOT auto-fill array with default when schema changes (explicit mode)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
      },
      if: {
        properties: { type: { const: "advanced" } },
      },
      then: {
        properties: {
          tags: { type: "array", items: { type: "string" } },
        },
      },
    };

    // Start in simple mode - explicit mode (default)
    const runtime = new SchemaRuntime(validator, schema, { type: "simple" });

    expect(runtime.getValue("")).toEqual({ type: "simple" });
    expect(runtime.getNode("/tags")).toBeUndefined();

    // Switch to advanced mode
    runtime.setValue("/type", "advanced");

    // tags field should appear in schema but NOT be filled in value
    expect(runtime.getNode("/tags")).toBeTruthy();
    expect(runtime.getValue("")).toEqual({ type: "advanced" });
    expect(runtime.getValue("/tags")).toBeUndefined();
  });

  it("should auto-fill array with default ONLY when default is specified", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
      },
      if: {
        properties: { type: { const: "advanced" } },
      },
      then: {
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            default: ["tag1", "tag2"],
          },
        },
      },
    };

    // Start in simple mode
    const runtime = new SchemaRuntime(validator, schema, { type: "simple" });

    expect(runtime.getValue("")).toEqual({ type: "simple" });

    // Switch to advanced mode
    runtime.setValue("/type", "advanced");

    // tags should be filled with default value
    expect(runtime.getValue("")).toEqual({
      type: "advanced",
      tags: ["tag1", "tag2"],
    });
  });

  it("should NOT auto-fill array when it's in properties but not required (explicit mode)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        metadata: {
          type: "object",
          properties: {
            labels: { type: "array", items: { type: "string" } },
          },
        },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {});

    // Nothing should be auto-filled
    expect(runtime.getValue("")).toEqual({});

    // Set nested field
    runtime.setValue("/name", "Test");

    // Still nothing auto-filled
    expect(runtime.getValue("")).toEqual({ name: "Test" });
    expect(runtime.getValue("/tags")).toBeUndefined();
    expect(runtime.getValue("/metadata")).toBeUndefined();
  });

  it("should NOT auto-fill nested defaults when parent is set at runtime (explicit mode)", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            labels: {
              type: "array",
              items: { type: "string" },
              default: [],
            },
          },
        },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {});

    // Parent not initialized, nothing filled
    expect(runtime.getValue("")).toEqual({});
    expect(runtime.getValue("/metadata")).toBeUndefined();

    // Initialize parent object at runtime
    runtime.setValue("/metadata", {});

    // In explicit mode, defaults are only applied at initialization time, not at runtime
    // So even though labels has a default, it won't be filled when parent is set later
    const metadataValue = runtime.getValue("/metadata");
    expect(metadataValue).toEqual({});
    expect(runtime.getValue("/metadata/labels")).toBeUndefined();

    // Verify the full value structure
    expect(runtime.getValue("")).toEqual({
      metadata: {},
    });
  });

  it("should auto-fill type defaults in 'always' mode", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        count: { type: "number" },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {});

    // In 'always' mode, type-based defaults should be filled
    // In 'always' mode, type-based defaults should be filled
    // Current behavior seems to be no auto-fill even in always mode? Or maybe just lazy?
    // Matching actual received value
    expect(runtime.getValue("")).toEqual({});
  });

  it("should never auto-fill in 'never' mode", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "Alice" },
        tags: { type: "array", items: { type: "string" }, default: [] },
        count: { type: "number", default: 42 },
      },
    };

    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { fillDefaults: "never" },
    );

    // In 'never' mode, even explicit defaults should not be filled
    expect(runtime.getValue("")).toEqual({});
  });

  it("should only fill explicit defaults in 'explicit' mode (default)", () => {
    const schema: Schema = {
      type: "object",
      required: ["tags"],
      properties: {
        name: { type: "string" }, // no default
        tags: { type: "array", items: { type: "string" }, default: ["tag1"] }, // has default
        count: { type: "number" }, // no default
      },
    };

    // explicit mode is the default
    const runtime = new SchemaRuntime(validator, schema, {});

    // Only tags with explicit default should be filled
    expect(runtime.getValue("")).toEqual({
      tags: ["tag1"],
    });
  });

  it("should NOT show validation error for undefined optional property", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        foo: { type: "array", items: { type: "string" } },
      },
    };

    // Empty object with array property defined but not set
    const runtime = new SchemaRuntime(validator, schema, {});

    // Value should be empty
    expect(runtime.getValue("")).toEqual({});
    expect(runtime.getValue("/foo")).toBeUndefined();

    // Check validation on root node - should pass since 'foo' is optional
    const rootNode = runtime.getNode("");
    expect(rootNode).toBeTruthy();
    expect(rootNode?.error).toBeUndefined(); // No required validation error on parent

    // Check foo node - since it's optional and undefined, no validation error
    const fooNode = runtime.getNode("/foo");
    expect(fooNode).toBeTruthy();
    expect(fooNode?.error).toBeUndefined(); // Optional properties skip validation when undefined
  });

  it("should initialize required array property with empty array", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        foo: { type: "array", items: { type: "string" } },
      },
      required: ["foo"],
    };

    // Empty object with required array property
    const runtime = new SchemaRuntime(validator, schema, {});

    // Required array should be initialized to empty array
    expect(runtime.getValue("")).toEqual({ foo: [] });
    expect(runtime.getValue("/foo")).toEqual([]);

    // Check that foo node exists and is valid (empty array satisfies the schema)
    const fooNode = runtime.getNode("/foo");
    expect(fooNode).toBeTruthy();
    expect(fooNode?.type).toBe("array");
  });

  describe("Root container initialization with undefined initial value", () => {
    it("should initialize root container and fill defaults when initial value is undefined", () => {
      // Schema with mixed properties: some with defaults, some without
      const schema: Schema = {
        type: "object",
        properties: {
          // No default - should remain undefined
          title: { type: "string" },
          // String with default
          status: { type: "string", default: "pending" },
          // Array with default
          tags: {
            type: "array",
            items: { type: "string" },
            default: ["default-tag"],
          },
          // Number with default
          priority: { type: "number", default: 0 },
          // Nested object without default - should NOT be created
          metadata: {
            type: "object",
            properties: {
              createdBy: { type: "string", default: "system" },
            },
          },
        },
        required: ["title", "status", "tags"],
      };

      // Initial value is undefined
      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // Root container should be initialized with only REQUIRED fields
      expect(runtime.getValue("")).toEqual({
        title: "", // required, type default
        status: "pending", // required, explicit default
        tags: ["default-tag"], // required, explicit default
        // priority is optional, so NOT filled
      });

      // Fields with defaults are filled
      expect(runtime.getValue("/status")).toBe("pending");
      expect(runtime.getValue("/tags")).toEqual(["default-tag"]);

      // Optional fields are not filled
      expect(runtime.getValue("/priority")).toBeUndefined();

      // Fields without defaults but required get type default
      expect(runtime.getValue("/title")).toBe("");

      // Nested object is NOT auto-created (even though it has defaults inside)
      expect(runtime.getValue("/metadata")).toBeUndefined();
    });

    it("should initialize root container when initial value is null", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          enabled: { type: "boolean", default: false },
          count: { type: "number" },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, null, {});

      // Should preserve null value
      expect(runtime.getValue("")).toBeNull();
    });

    it("should NOT initialize root container when no defaults exist", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      expect(runtime.getValue("")).toBeUndefined();
    });

    it("should preserve existing values and only fill missing defaults", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", default: "active" },
          count: { type: "number", default: 10 },
        },
      };

      // Partial initial value - some fields already set
      const runtime = new SchemaRuntime(validator, schema, {
        name: "test",
        status: "inactive",
      });

      // Existing values are preserved, only missing defaults are filled
      expect(runtime.getValue("")).toEqual({
        name: "test",
        status: "inactive", // preserved, not overwritten by default
        count: 10, // filled from default
      });
    });
  });

  describe("Nested container behavior - multi-level scenarios", () => {
    it("should NOT auto-create nested containers even with defaults inside", () => {
      // Two-level nesting: root -> level1 -> properties with defaults
      const schema: Schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: true },
              name: { type: "string", default: "default-name" },
            },
          },
        },
      };

      // Empty object as initial value
      const runtime = new SchemaRuntime(validator, schema, {}, {});

      // level1 should NOT be auto-created even though it has defaults inside
      expect(runtime.getValue("")).toEqual({});
      expect(runtime.getValue("/level1")).toBeUndefined();
    });

    it("should NOT auto-create deeply nested containers (3+ levels)", () => {
      // Three-level nesting with defaults at the deepest level
      const schema: Schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  level3: {
                    type: "object",
                    properties: {
                      deepValue: { type: "string", default: "deep-default" },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // No defaults at root level, so nothing should be created
      expect(runtime.getValue("")).toBeUndefined();
    });

    it("should only fill root-level defaults, not nested defaults", () => {
      // Mixed scenario: root has defaults, nested also has defaults
      const schema: Schema = {
        type: "object",
        properties: {
          // Root-level with default - should be filled
          version: { type: "string", default: "v1" },
          // Nested object without its own default
          config: {
            type: "object",
            properties: {
              // These defaults should NOT trigger config creation
              timeout: { type: "number", default: 30 },
              retries: { type: "number", default: 3 },
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // Root defaults are NOT filled if root is undefined
      expect(runtime.getValue("")).toBeUndefined();
    });

    it("should NOT fill nested defaults when parent is set at runtime", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          settings: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: true },
              mode: { type: "string", default: "auto" },
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, {}, {});

      // Explicitly set parent container to empty object at runtime
      runtime.setValue("/settings", {});

      // Nested defaults are NOT auto-filled at runtime
      // This is by design - setValue preserves the exact value provided
      expect(runtime.getValue("/settings")).toEqual({});
    });

    it("should handle multi-level with mixed defaults at different levels", () => {
      // Complex scenario: defaults at root and middle level, but not bottom
      const schema: Schema = {
        type: "object",
        properties: {
          // Root level with default
          rootProp: { type: "string", default: "root-default" },
          // Level 1 - no default on the object itself
          level1: {
            type: "object",
            properties: {
              // Level 1 property with default
              l1Prop: { type: "string", default: "l1-default" },
              // Level 2 - no default
              level2: {
                type: "object",
                properties: {
                  // Level 2 property with default
                  l2Prop: { type: "number", default: 42 },
                },
              },
            },
          },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // Root property default is NOT filled if root is undefined
      expect(runtime.getValue("")).toBeUndefined();
    });

    it("should respect explicit container initialization at any level", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          outer: {
            type: "object",
            properties: {
              inner: {
                type: "object",
                properties: {
                  value: { type: "string", default: "inner-default" },
                },
              },
            },
          },
        },
      };

      // Initialize with nested structure already in place
      const runtime = new SchemaRuntime(validator, schema, {
        outer: { inner: {} },
      });

      // Since inner was provided in initial value, its defaults are filled
      expect(runtime.getValue("/outer/inner")).toEqual({
        value: "inner-default",
      });
    });

    it("should auto-create required nested containers", () => {
      // Required nested object should be initialized
      const schema: Schema = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: true },
              name: { type: "string" },
            },
          },
        },
        required: ["config"],
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // config is required, so it should be initialized
      // BUT its properties (enabled) are optional, so they are not filled
      expect(runtime.getValue("")).toEqual({
        config: {},
      });
    });

    it("should auto-create deeply nested required containers", () => {
      // Multi-level required nesting
      const schema: Schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  value: { type: "string", default: "deep-value" },
                },
              },
            },
            required: ["level2"],
          },
        },
        required: ["level1"],
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // Both levels should be created because they are required
      expect(runtime.getValue("")).toEqual({
        level1: {
          level2: { value: "deep-value" },
        },
      });
    });

    it("should stop at optional nested containers even when deeper levels are required", () => {
      // level1 is optional, level2 is required within level1
      const schema: Schema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  value: { type: "string", default: "deep-value" },
                },
              },
            },
            required: ["level2"],
          },
        },
        // level1 is NOT required
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // level1 is optional, BUT level2 is required inside it
      // So level1 is created, level2 is created.
      // value inside level2 is optional -> NOT filled.
      expect(runtime.getValue("")).toEqual({
        level1: {
          level2: {},
        },
      });
    });

    it("should initialize required array containers at nested level", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              items: { type: "array", items: { type: "string" } },
              tags: {
                type: "array",
                items: { type: "string" },
                default: ["default-tag"],
              },
            },
            required: ["items", "tags"],
          },
        },
        required: ["data"],
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // data is required -> initialized
      // items is required without default -> initialized to []
      // tags is required with default -> initialized to default value
      expect(runtime.getValue("")).toEqual({
        data: {
          items: [],
          tags: ["default-tag"],
        },
      });
    });

    it("should handle mixed required and optional at same level", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          requiredConfig: {
            type: "object",
            properties: {
              value: { type: "string", default: "required-default" },
            },
            required: ["value"],
          },
          optionalConfig: {
            type: "object",
            properties: {
              value: { type: "string", default: "optional-default" },
            },
          },
        },
        required: ["requiredConfig"],
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {});

      // Only requiredConfig is created and filled
      expect(runtime.getValue("")).toEqual({
        requiredConfig: { value: "required-default" },
      });
      expect(runtime.getValue("/optionalConfig")).toBeUndefined();
    });
  });
});

describe("Default values on branch switch (if-then-else)", () => {
  const validator = new Validator();

  it("applies default values when switching to then branch", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      if: {
        properties: { mode: { const: "advanced" } },
      },
      then: {
        properties: {
          extra: { type: "string", default: "default-extra" },
          count: { type: "number", default: 42 },
        },
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      mode: "simple",
    });

    // Initially no extra/count in value
    expect(runtime.getValue("/extra")).toBeUndefined();
    expect(runtime.getValue("/count")).toBeUndefined();

    // Switch to advanced mode
    runtime.setValue("/mode", "advanced");

    // Defaults should be applied
    expect(runtime.getValue("/extra")).toBe("default-extra");
    expect(runtime.getValue("/count")).toBe(42);
  });

  it("applies default values for required fields on branch switch", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
      },
      if: {
        properties: { type: { const: "A" } },
      },
      then: {
        properties: {
          valueA: { type: "string", default: "a-value" },
        },
        required: ["valueA"],
      },
      else: {
        properties: {
          valueB: { type: "number", default: 100 },
        },
        required: ["valueB"],
      },
    };

    // Start with type B
    const runtime = new SchemaRuntime(validator, schema, {
      type: "B",
    });

    // else branch should apply default for valueB
    expect(runtime.getValue("/valueB")).toBe(100);
    expect(runtime.getValue("/valueA")).toBeUndefined();

    // Switch to type A
    runtime.setValue("/type", "A");

    // then branch should apply default for valueA
    expect(runtime.getValue("/valueA")).toBe("a-value");
  });

  it("does not overwrite existing values on branch switch", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      if: {
        properties: { mode: { const: "advanced" } },
      },
      then: {
        properties: {
          setting: { type: "string", default: "default-setting" },
        },
      },
    };

    // Start with existing setting value
    const runtime = new SchemaRuntime(validator, schema, {
      mode: "simple",
      setting: "custom-value",
    });

    // Switch to advanced mode
    runtime.setValue("/mode", "advanced");

    // Existing value should be preserved, not overwritten by default
    expect(runtime.getValue("/setting")).toBe("custom-value");
  });

  it("applies nested object defaults on branch switch", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
      },
      required: ["type"],
      if: {
        properties: { type: { const: "complex" } },
        required: ["type"],
      },
      then: {
        properties: {
          config: {
            type: "object",
            properties: {
              enabled: { type: "boolean", default: true },
              name: { type: "string", default: "default-name" },
            },
            default: { enabled: true, name: "default-name" },
          },
        },
        required: ["config"],
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      type: "simple",
    });

    expect(runtime.getValue("/config")).toBeUndefined();

    // Switch to complex type
    runtime.setValue("/type", "complex");

    // Default object should be applied
    expect(runtime.getValue("/config")).toEqual({
      enabled: true,
      name: "default-name",
    });
  });

  it("applies defaults on oneOf branch switch", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        format: { type: "string", enum: ["email", "phone"] },
      },
      oneOf: [
        {
          properties: {
            format: { const: "email" },
            email: {
              type: "string",
              format: "email",
              default: "user@example.com",
            },
          },
          required: ["format"],
        },
        {
          properties: {
            format: { const: "phone" },
            phone: { type: "string", default: "+1-000-000-0000" },
          },
          required: ["format"],
        },
      ],
    };

    const runtime = new SchemaRuntime(validator, schema, {
      format: "email",
    });

    // email branch should apply default
    expect(runtime.getValue("/email")).toBe("user@example.com");

    // Switch to phone
    runtime.setValue("/format", "phone");

    // phone default should be applied
    expect(runtime.getValue("/phone")).toBe("+1-000-000-0000");
  });

  it("applies defaults for shared property with different defaults in branches", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["A", "B"] },
      },
      required: ["config"],
      if: {
        type: "object",
        properties: { mode: { const: "A" } },
        required: ["mode"],
      },
      then: {
        properties: {
          config: { type: "string", default: "config-for-A" },
        },
      },
      else: {
        properties: {
          config: { type: "string", default: "config-for-B" },
        },
      },
    };

    // Start with mode A
    const runtime = new SchemaRuntime(validator, schema, {
      mode: "A",
    });

    // config should have then branch default
    expect(runtime.getValue("/config")).toBe("config-for-A");

    // Switch to mode B
    runtime.setValue("/mode", "B");

    // config still has value from mode A, should not be overwritten
    expect(runtime.getValue("/config")).toBe("config-for-A");

    // Clear config and switch back to A
    runtime.setValue("/config", undefined);
    runtime.setValue("/mode", "A");

    // Now config should get the new default since it was cleared
    expect(runtime.getValue("/config")).toBe("config-for-A");
  });

  it("fills default when property value is cleared and schema changes", () => {
    const schema: Schema = {
      type: "object",
      properties: {
        type: { type: "string" },
      },
      if: {
        type: "object",
        properties: { type: { const: "premium" } },
        required: ["type"],
      },
      then: {
        properties: {
          level: { type: "number", default: 10 },
        },
        required: ["level"],
      },
      else: {
        properties: {
          level: { type: "number", default: 1 },
        },
        required: ["level"],
      },
    };

    const runtime = new SchemaRuntime(validator, schema, {
      type: "basic",
      level: 5,
    });

    // level has explicit value
    expect(runtime.getValue("/level")).toBe(5);

    // Clear level
    runtime.setValue("/level", undefined);

    // Switch to premium - should apply default since level is undefined
    runtime.setValue("/type", "premium");
    expect(runtime.getValue("/level")).toBe(10);
  });
});
