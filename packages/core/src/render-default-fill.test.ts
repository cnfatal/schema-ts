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
    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "explicit" },
    );

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
    const runtime = new SchemaRuntime(
      validator,
      schema,
      { type: "simple" },
      { autoFillDefaults: "explicit" },
    );

    expect(runtime.getValue("")).toEqual({ type: "simple" });
    expect(runtime.findNode("/tags")).toBeUndefined();

    // Switch to advanced mode
    runtime.setValue("/type", "advanced");

    // tags field should appear in schema but NOT be filled in value
    expect(runtime.findNode("/tags")).toBeTruthy();
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

    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "explicit" },
    );

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

    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "explicit" },
    );

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

    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "always" },
    );

    // In 'always' mode, type-based defaults should be filled
    expect(runtime.getValue("")).toEqual({
      name: "",
      tags: [],
      count: 0,
    });
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
      { autoFillDefaults: "never" },
    );

    // In 'never' mode, even explicit defaults should not be filled
    expect(runtime.getValue("")).toEqual({});
  });

  it("should only fill explicit defaults in 'explicit' mode (default)", () => {
    const schema: Schema = {
      type: "object",
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
    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "explicit" },
    );

    // Value should be empty
    expect(runtime.getValue("")).toEqual({});
    expect(runtime.getValue("/foo")).toBeUndefined();

    // Check validation on root node - should pass since 'foo' is optional
    const rootNode = runtime.findNode("");
    expect(rootNode).toBeTruthy();
    expect(rootNode?.error).toBeUndefined(); // No required validation error on parent

    // Check foo node - since it's optional and undefined, no validation error
    const fooNode = runtime.findNode("/foo");
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
    const runtime = new SchemaRuntime(
      validator,
      schema,
      {},
      { autoFillDefaults: "explicit" },
    );

    // Required array should be initialized to empty array
    expect(runtime.getValue("")).toEqual({ foo: [] });
    expect(runtime.getValue("/foo")).toEqual([]);

    // Check that foo node exists and is valid (empty array satisfies the schema)
    const fooNode = runtime.findNode("/foo");
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
      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // Root container should be initialized with all root-level defaults
      expect(runtime.getValue("")).toEqual({
        status: "pending",
        tags: ["default-tag"],
        priority: 0,
      });

      // Fields with defaults are filled
      expect(runtime.getValue("/status")).toBe("pending");
      expect(runtime.getValue("/tags")).toEqual(["default-tag"]);
      expect(runtime.getValue("/priority")).toBe(0);

      // Fields without defaults remain undefined
      expect(runtime.getValue("/title")).toBeUndefined();

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

      const runtime = new SchemaRuntime(validator, schema, null, {
        autoFillDefaults: "explicit",
      });

      expect(runtime.getValue("")).toEqual({ enabled: false });
    });

    it("should NOT initialize root container when no defaults exist", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
        },
      };

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // Root should remain undefined when no properties have defaults
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
      const runtime = new SchemaRuntime(
        validator,
        schema,
        { name: "test", status: "inactive" },
        { autoFillDefaults: "explicit" },
      );

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
      const runtime = new SchemaRuntime(
        validator,
        schema,
        {},
        {
          autoFillDefaults: "explicit",
        },
      );

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // Only root-level default should be filled
      expect(runtime.getValue("")).toEqual({ version: "v1" });

      // Nested config is NOT created
      expect(runtime.getValue("/config")).toBeUndefined();
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

      const runtime = new SchemaRuntime(
        validator,
        schema,
        {},
        {
          autoFillDefaults: "explicit",
        },
      );

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // Only root-level property with default is filled
      expect(runtime.getValue("")).toEqual({ rootProp: "root-default" });

      // Nested containers are not created
      expect(runtime.getValue("/level1")).toBeUndefined();
      expect(runtime.getValue("/level1/level2")).toBeUndefined();
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
      const runtime = new SchemaRuntime(
        validator,
        schema,
        { outer: { inner: {} } },
        { autoFillDefaults: "explicit" },
      );

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // config is required, so it should be initialized
      // and its defaults should be filled
      expect(runtime.getValue("")).toEqual({
        config: { enabled: true },
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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // level1 is optional, so nothing is created
      expect(runtime.getValue("")).toBeUndefined();
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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

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

      const runtime = new SchemaRuntime(validator, schema, undefined, {
        autoFillDefaults: "explicit",
      });

      // Only requiredConfig is created and filled
      expect(runtime.getValue("")).toEqual({
        requiredConfig: { value: "required-default" },
      });
      expect(runtime.getValue("/optionalConfig")).toBeUndefined();
    });
  });
});
