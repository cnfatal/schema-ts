import { describe, expect, it } from "vitest";
import type { Schema } from "./type";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";

// Mirrors charts/default/llamafactory/values.schema.json: `runMode` has a
// default of "quick" and gates expert-only `allOf` branches through
// `not anyOf` conditions that `require` runMode. Before the fix, the absent
// runMode made those conditions vacuously true, rendering expert fields.
const schema: Schema = {
  type: "object",
  required: ["flavor"],
  allOf: [
    {
      properties: {
        flavor: { type: "object", minProperties: 1 },
        runMode: {
          type: "string",
          default: "quick",
          enum: ["quick", "expert", "webui"],
        },
      },
      if: {
        not: {
          properties: { runMode: { const: "webui" } },
          required: ["runMode"],
        },
      },
      then: {
        properties: {
          basic: {
            type: "object",
            properties: {
              finetuningType: {
                type: "string",
                default: "lora",
                enum: ["lora", "qlora", "full", "freeze"],
              },
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
              properties: { runMode: { const: "webui" } },
              required: ["runMode"],
            },
            {
              properties: { runMode: { const: "quick" } },
              required: ["runMode"],
            },
          ],
        },
      },
      then: {
        properties: { advanced: { type: "string", title: "Advanced" } },
      },
    },
  ],
};

function build(value: unknown) {
  const runtime = new SchemaRuntime(new Validator(), schema, value);
  const keys = (runtime.root.children ?? []).map((child) =>
    child.instanceLocation.replace(/^\//, ""),
  );
  return { runtime, keys };
}

describe("allOf conditional defaults", () => {
  it("selects the default branch before evaluating nested conditions", () => {
    const { runtime, keys } = build({});
    expect(runtime.getValue("/runMode")).toBe("quick");
    expect(keys).not.toContain("advanced");
  });

  it("still selects the expert branch when runMode is expert", () => {
    const { keys } = build({ runMode: "expert" });
    expect(keys).toContain("advanced");
  });

  it("applies defaults from later allOf entries before earlier conditions", () => {
    // allOf is unordered, so a default declared in a later entry must still be
    // visible to an earlier branch's condition.
    const ordered: Schema = {
      type: "object",
      allOf: [
        {
          if: {
            not: {
              anyOf: [
                { properties: { mode: { const: "a" } }, required: ["mode"] },
                { properties: { mode: { const: "b" } }, required: ["mode"] },
              ],
            },
          },
          then: { properties: { expert: { type: "string" } } },
        },
        { properties: { mode: { type: "string", default: "a" } } },
      ],
    };
    const runtime = new SchemaRuntime(new Validator(), ordered, {});
    const keys = (runtime.root.children ?? []).map(
      (child) => child.instanceLocation,
    );
    expect(runtime.getValue("/mode")).toBe("a");
    expect(keys).not.toContain("/expert");
  });
});
