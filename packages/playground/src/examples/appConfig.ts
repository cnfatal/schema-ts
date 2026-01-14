import type { Schema } from "@schema-ts/core";
import { Example } from ".";

export const appConfigSchema: Schema = {
  type: "object",
  title: "Enterprise Application Deployment",
  properties: {
    metadata: {
      type: "object",
      title: "Metadata",
      properties: {
        appName: {
          type: "string",
          title: "Application Name",
          minLength: 3,
          default: "enterprise-service",
        },
        environment: {
          type: "string",
          title: "Environment",
          enum: ["production", "staging", "development"],
          default: "development",
        },
        clusterId: {
          type: "string",
          title: "Target Cluster",
          const: "k8s-main-cluster",
          default: "k8s-main-cluster",
        },
      },
      required: ["appName", "environment"],
    },
    resources: {
      type: "object",
      title: "Resource Configuration",
      properties: {
        cpuLimit: {
          type: "number",
          title: "CPU Limit (Cores)",
          minimum: 0.1,
          maximum: 32,
          default: 1,
        },
        memoryLimit: {
          type: "number",
          title: "Memory Limit (MB)",
          minimum: 128,
          maximum: 65536,
          multipleOf: 128,
          default: 1024,
        },
      },
    },
    networking: {
      type: "object",
      title: "Network Configuration",
      oneOf: [
        {
          title: "Public Ingress",
          properties: {
            accessType: { const: "public", title: "Access Type" },
            domain: {
              type: "string",
              format: "hostname",
              title: "Domain Name",
            },
            protocol: {
              type: "string",
              enum: ["http", "https"],
              default: "https",
            },
          },
          required: ["accessType", "domain"],
        },
        {
          title: "Internal Cluster-IP",
          properties: {
            accessType: { const: "internal", title: "Access Type" },
            port: {
              type: "integer",
              minimum: 1,
              maximum: 65535,
              default: 8080,
              title: "Internal Port",
            },
          },
          required: ["accessType"],
        },
      ],
    },
    storage: {
      type: "array",
      title: "Storage Volumes",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["s3", "ebs"],
            title: "Storage Type",
          },
        },
        anyOf: [
          {
            title: "Object Storage (S3)",
            properties: {
              type: { const: "s3", title: "Storage Type" },
              bucket: { type: "string", title: "Bucket Name" },
              region: {
                type: "string",
                enum: ["us-east-1", "eu-west-1", "ap-northeast-1"],
                default: "us-east-1",
              },
            },
            required: ["type", "bucket"],
          },
          {
            title: "Block Storage (EBS)",
            properties: {
              type: { const: "ebs", title: "Storage Type" },
              size: {
                type: "integer",
                minimum: 10,
                maximum: 5000,
                default: 100,
                title: "Size (GB)",
              },
              encrypted: {
                type: "boolean",
                title: "Encryption",
                default: true,
              },
            },
            required: ["type"],
          },
        ],
      },
    },
    appConfigs: {
      type: "object",
      title: "Application Runtime settings",
      properties: {
        runtime: {
          type: "string",
          enum: ["nodejs", "python", "go"],
          default: "nodejs",
          title: "Execution Runtime",
        },
        commandOverride: {
          type: "object",
          title: "Command & Lifecycle",
          description: "Demonstrates distinguishing between [] and undefined",
          properties: {
            enabled: {
              type: "boolean",
              title: "Enable Custom Command",
              default: false,
            },
          },
          if: { properties: { enabled: { const: true } } },
          then: {
            properties: {
              command: {
                type: "array",
                title: "Command",
                items: { type: "string" },
                default: [], // Forces [] in data when enabled
                description: "Even if empty, this will exist as [] in the data",
              },
              args: {
                type: "array",
                title: "Arguments",
                items: { type: "string" },
              },
              workingDir: {
                type: "string",
                title: "Working Directory",
                format: "path",
                default: "/app",
              },
            },
          },
        },
      },
      required: ["runtime"],
      allOf: [
        {
          if: { properties: { runtime: { const: "nodejs" } } },
          then: {
            properties: {
              nodeVersion: {
                type: "string",
                enum: ["18-lts", "20-lts", "22-latest"],
                default: "20-lts",
                title: "Node.js Version",
              },
              packageRegistry: {
                type: "string",
                format: "uri",
                title: "NPM Registry",
                default: "https://registry.npmjs.org",
              },
            },
          },
        },
        {
          if: { properties: { runtime: { const: "python" } } },
          then: {
            properties: {
              pythonVersion: {
                type: "string",
                enum: ["3.9", "3.10", "3.11"],
                default: "3.11",
                title: "Python Version",
              },
              pipRegistry: {
                type: "string",
                format: "uri",
                title: "PyPI Index",
                default: "https://pypi.org/simple",
              },
            },
          },
        },
      ],
    },
  },
  // Global condition: metadata.environment affects resource defaults
  if: {
    properties: {
      metadata: {
        properties: { environment: { const: "production" } },
      },
    },
  },
  then: {
    properties: {
      resources: {
        properties: {
          cpuLimit: { minimum: 2, default: 4 },
          memoryLimit: { minimum: 2048, default: 4096 },
        },
      },
      scaling: {
        type: "object",
        title: "Production Scaling",
        properties: {
          minReplicas: { type: "integer", minimum: 3, default: 3 },
          maxReplicas: { type: "integer", maximum: 50, default: 10 },
          targetCPU: {
            type: "integer",
            title: "Target CPU Usage (%)",
            minimum: 10,
            maximum: 95,
            default: 70,
          },
        },
        required: ["minReplicas", "maxReplicas"],
      },
    },
  },
};

export const appConfigValue = {};

export const appConfigExample: Example = {
  name: "Ultimate App Deployment (Complex)",
  schema: appConfigSchema,
  value: appConfigValue,
};
