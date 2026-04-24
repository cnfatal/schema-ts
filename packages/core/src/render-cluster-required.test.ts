import { describe, it, expect, beforeEach } from "vitest";
import { SchemaRuntime } from "./render";
import { Validator } from "./validate";
import type { Schema } from "./type";

describe("Cluster mode required validation issue", () => {
  let validator: Validator;

  // Schema with minProperties constraint on nested objects
  const schema: Schema = {
    type: "object",
    properties: {
      victoriametrics: {
        type: "object",
        required: ["mode"],
        properties: {
          mode: {
            type: "string",
            enum: ["standalone", "cluster"],
            default: "standalone",
          },
        },
        allOf: [
          {
            if: {
              properties: { mode: { const: "standalone" } },
              required: ["mode"],
            },
            then: {
              properties: {
                single: {
                  type: "object",
                  properties: {
                    replicaCount: { type: "integer", default: 1 },
                  },
                },
              },
              required: ["single"],
            },
          },
          {
            if: {
              properties: { mode: { const: "cluster" } },
              required: ["mode"],
            },
            then: {
              properties: {
                cluster: {
                  type: "object",
                  required: ["vmstorage", "vmselect", "vminsert"],
                  properties: {
                    vmstorage: {
                      type: "object",
                      minProperties: 1,
                      properties: {
                        replicaCount: { type: "integer", default: 2 },
                      },
                    },
                    vmselect: {
                      type: "object",
                      minProperties: 1,
                      properties: {
                        replicaCount: { type: "integer", default: 2 },
                      },
                    },
                    vminsert: {
                      type: "object",
                      minProperties: 1,
                      properties: {
                        replicaCount: { type: "integer", default: 2 },
                      },
                    },
                  },
                },
              },
              required: ["cluster"],
            },
          },
        ],
      },
    },
  };

  beforeEach(() => {
    validator = new Validator();
  });

  it("should not have minProperties error when setting mode to cluster on initial load", () => {
    // Simulate initial load with cluster mode
    const runtime = new SchemaRuntime(validator, schema, {
      victoriametrics: {
        mode: "cluster",
      },
    });

    // Validate the victoriametrics node
    runtime.validate("/victoriametrics");

    // vmstorage, vmselect, vminsert should have default values filled
    const vmstorageNode = runtime.getNode("/victoriametrics/cluster/vmstorage");
    const vmselectNode = runtime.getNode("/victoriametrics/cluster/vmselect");
    const vminsertNode = runtime.getNode("/victoriametrics/cluster/vminsert");

    // Should not have minProperties error on child nodes
    expect(vmstorageNode?.error).toBeUndefined();
    expect(vmselectNode?.error).toBeUndefined();
    expect(vminsertNode?.error).toBeUndefined();
  });

  it("should clear errors after switching from standalone to cluster", () => {
    // Start with standalone mode
    const runtime = new SchemaRuntime(validator, schema, {
      victoriametrics: {
        mode: "standalone",
      },
    });

    runtime.validate("/victoriametrics");

    // Switch to cluster mode
    runtime.setValue("/victoriametrics/mode", "cluster");

    // Check the value immediately after switch - should have replicaCount filled
    const vmstorageValue = runtime.getValue(
      "/victoriametrics/cluster/vmstorage",
    );
    expect(vmstorageValue).toEqual({ replicaCount: 2 });

    // Should not have errors after switching (no manual validate needed)
    const vmstorageNode = runtime.getNode("/victoriametrics/cluster/vmstorage");
    expect(vmstorageNode?.error).toBeUndefined();
  });
});
