import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("SchemaRuntime - const", () => {
  const validator = new Validator();

  it("identifies error when value doesn't match const", () => {
    const schema: Schema = { const: "fixed" };
    const runtime = new SchemaRuntime(validator, schema, "wrong");
    runtime.validate("");
    expect(runtime.root.error?.valid).toBe(false);
    expect(runtime.root.error?.errors?.[0].keywordLocation).toContain("const");
    expect(runtime.root.error?.errors?.[0].error).toContain(
      "must be equal to fixed",
    );
  });

  it("is valid when value matches const", () => {
    const schema: Schema = { const: "fixed" };
    const runtime = new SchemaRuntime(validator, schema, "fixed");
    expect(runtime.root.error).toBeUndefined();
  });

  it("handles object constant", () => {
    const schema: Schema = { const: { a: 1 } };
    const runtime1 = new SchemaRuntime(validator, schema, { a: 1 });
    expect(runtime1.root.error).toBeUndefined();

    const runtime2 = new SchemaRuntime(validator, schema, { a: 2 });
    runtime2.validate("");
    expect(runtime2.root.error?.valid).toBe(false);
    expect(runtime2.root.error?.errors?.[0].error).toContain(
      'must be equal to {"a":1}',
    );
  });
});
