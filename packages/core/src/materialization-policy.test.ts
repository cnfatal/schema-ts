import { describe, expect, it } from "vitest";
import { hasNestedDefault } from "./default";
import { BetterNormalizer } from "./normalize";
import { SchemaRuntime } from "./render";
import type { Schema } from "./type";
import { Validator } from "./validate";

// Mirrors the LLaMA-Factory gating: `finetuningType` defaults to "lora" inside
// the optional `basic` container, while a root-level condition references it.
const schema: Schema = {
  type: "object",
  allOf: [
    {
      properties: {
        basic: {
          type: "object",
          properties: {
            finetuningType: {
              type: "string",
              default: "lora",
              enum: ["lora", "qlora"],
            },
          },
        },
      },
    },
    {
      if: {
        not: {
          anyOf: [
            {
              properties: {
                basic: {
                  properties: { finetuningType: { const: "lora" } },
                  required: ["finetuningType"],
                },
              },
              required: ["basic"],
            },
          ],
        },
      },
      then: {
        properties: {
          quantization: { type: "string", title: "Quantization" },
        },
      },
    },
  ],
};

function topKeys(value: unknown, options = {}): string[] {
  const runtime = new SchemaRuntime(new Validator(), schema, value, options);
  return (runtime.root.children ?? []).map((child) =>
    child.instanceLocation.replace(/^\//, ""),
  );
}

describe("materialization policy", () => {
  it("strict leaves an optional container absent (vacuous condition)", () => {
    expect(topKeys({})).toContain("quantization");
  });

  it("display materializes the container so nested defaults gate the branch", () => {
    const keys = topKeys(
      {},
      {
        schemaNormalizer: new BetterNormalizer({
          nonEmptyRequiredStrings: true,
        }),
      },
    );
    expect(keys).not.toContain("quantization");
    expect(keys).toContain("basic");
  });
});

describe("hasNestedDefault", () => {
  it("finds defaults in unconditional properties, allOf and items", () => {
    expect(hasNestedDefault({ properties: { a: { default: 1 } } })).toBe(true);
    expect(
      hasNestedDefault({ allOf: [{ properties: { a: { default: 1 } } }] }),
    ).toBe(true);
    expect(hasNestedDefault({ items: { default: 1 } })).toBe(true);
  });

  it("ignores defaults that only exist under conditional branches", () => {
    expect(
      hasNestedDefault({ then: { properties: { a: { default: 1 } } } }),
    ).toBe(false);
    expect(
      hasNestedDefault({ if: { properties: {} }, else: { default: 1 } }),
    ).toBe(false);
  });
});
