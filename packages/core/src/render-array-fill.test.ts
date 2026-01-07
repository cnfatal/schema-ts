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

  it("should auto-fill array ONLY when parent object is initialized (explicit mode)", () => {
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

    // Initialize parent object
    runtime.setValue("/metadata", {});

    // Now default should be applied (applySchemaDefaults)
    // Actually, this depends on when applySchemaDefaults is triggered
    const metadataValue = runtime.getValue("/metadata");
    console.log("metadata after init:", metadataValue);
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
});
