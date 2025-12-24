import { describe, it, expect } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Advanced Array Features", () => {
  const validator = new Validator();

  it("supports prefixItems", () => {
    const schema: Schema = {
      type: "array",
      prefixItems: [{ type: "string" }, { type: "number" }],
      items: { type: "boolean" }, // for the rest
    };
    const value = ["foo", 123, true, false];
    const runtime = new SchemaRuntime(validator, schema, value);

    const node0 = runtime.findNode("/0");
    expect(node0?.schema.type).toBe("string");

    const node1 = runtime.findNode("/1");
    expect(node1?.schema.type).toBe("number");

    const node2 = runtime.findNode("/2");
    expect(node2?.schema.type).toBe("boolean");

    const node3 = runtime.findNode("/3");
    expect(node3?.schema.type).toBe("boolean");
  });
});
