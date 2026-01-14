import type { Schema } from "@schema-ts/core";
import { Example } from ".";

export const cloudResourceSchema: Schema = {
  type: "object",
  title: "Cloud Resource Configuration",
  properties: {
    resourceType: {
      type: "string",
      title: "Resource Type",
      enum: ["Compute", "Storage"],
    },
  },
  required: ["resourceType"],
  if: {
    properties: { resourceType: { const: "Compute" } },
    required: ["resourceType"],
  },
  then: {
    properties: {
      instanceFamily: {
        type: "string",
        title: "Instance Family",
        enum: ["General Purpose", "Memory Optimized"],
      },
    },
    required: ["instanceFamily"],
    if: {
      properties: { instanceFamily: { const: "General Purpose" } },
      required: ["instanceFamily"],
    },
    then: {
      properties: {
        size: {
          type: "string",
          title: "Size",
          enum: ["small", "medium", "large"],
        },
      },
      required: ["size"],
    },
    else: {
      if: {
        properties: { instanceFamily: { const: "Memory Optimized" } },
        required: ["instanceFamily"],
      },
      then: {
        properties: {
          size: {
            type: "string",
            title: "Size",
            enum: ["xlarge", "2xlarge", "4xlarge"],
          },
        },
        required: ["size"],
      },
    },
  },
  else: {
    if: {
      properties: { resourceType: { const: "Storage" } },
      required: ["resourceType"],
    },
    then: {
      properties: {
        storageType: {
          type: "string",
          title: "Storage Type",
          enum: ["SSD", "HDD"],
        },
      },
      required: ["storageType"],
      if: {
        properties: { storageType: { const: "SSD" } },
        required: ["storageType"],
      },
      then: {
        properties: {
          iops: {
            type: "integer",
            title: "IOPS",
            minimum: 100,
            maximum: 10000,
            default: 3000,
          },
        },
        required: ["iops"],
      },
      else: {
        properties: {
          throughput: {
            type: "integer",
            title: "Throughput (MB/s)",
            minimum: 10,
            maximum: 1000,
            default: 125,
          },
        },
        required: ["throughput"],
      },
    },
  },
};

export const cloudResourceValue = {
  resourceType: "Compute",
  instanceFamily: "General Purpose",
  size: "medium",
};

export const cloudResourceExample: Example = {
  name: "Cloud Resource",
  schema: cloudResourceSchema,
  value: cloudResourceValue,
};
