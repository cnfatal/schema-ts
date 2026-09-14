import type { Schema } from "@schema-ts/core";
import type { Example } from ".";

/**
 * Application configuration - a realistic example that covers several
 * scenarios at once: required fields, defaults, descriptions, enum/number
 * constraints, nested objects, boolean gates (if/then/else), collapsible
 * sections, repeatable arrays, dynamic keys, cross-field rules (x-validate),
 * resource pickers (x-resource-enum) and the x-enum extension.
 */
export const appConfigSchema: Schema = {
  type: "object",
  title: "Application Configuration",
  description: "Deploy a containerized workload.",
  required: ["name", "basic"],
  properties: {
    name: {
      type: "string",
      title: "Application Name",
      description: "Lowercase name; at least 2 characters.",
      minLength: 2,
      default: "web-api",
      "x-order": 1,
    },
    basic: {
      type: "object",
      title: "Basic Settings",
      description: "Image, workload type, replicas and autoscaling.",
      "x-order": 2,
      required: ["mode"],
      properties: {
        image: {
          type: "string",
          title: "Image",
          description: "Pick from the registry or type any reference.",
          default: "nginx:latest",
          "x-resource-enum": { resource: "image" },
        },
        flavor: {
          type: "string",
          title: "Flavor",
          description: "CPU/GPU flavor; filtered by type=cpu,gpu.",
          default: "cpu-2c4g",
          "x-resource-enum": { resource: "flavor", type: "cpu,gpu" },
        },
        imageAuth: {
          type: "object",
          title: "Image Authentication",
          description: "Only needed for private registries.",
          properties: {
            enabled: {
              type: "boolean",
              title: "Enable Authentication",
              description: "Show credentials when on.",
              default: false,
            },
          },
          if: {
            properties: { enabled: { const: true } },
            required: ["enabled"],
          },
          then: {
            properties: {
              username: {
                type: "string",
                title: "Username",
                description: "Registry user name (non-empty).",
                minLength: 1,
              },
              password: {
                type: "string",
                title: "Password",
                description: "Stored as a secret; use the eye to reveal.",
                format: "password",
                minLength: 1,
              },
            },
            required: ["username", "password"],
          },
        },
        mode: {
          type: "string",
          title: "Workload Type",
          description: "Deployment or StatefulSet.",
          enum: ["deployment", "statefulset"],
          default: "deployment",
        },
        replicas: {
          type: "integer",
          title: "Replicas",
          description: "1-10; bounded range renders as a slider.",
          default: 1,
          minimum: 1,
          maximum: 10,
        },
        autoScaling: {
          type: "object",
          title: "Auto Scaling",
          description: "Scale automatically based on utilization.",
          "x-collapse": true,
          properties: {
            enabled: {
              type: "boolean",
              title: "Enable Auto Scaling",
              description: "Show scaling thresholds when on.",
              default: false,
            },
          },
          if: {
            properties: { enabled: { const: true } },
            required: ["enabled"],
          },
          then: {
            properties: {
              minReplicas: {
                type: "integer",
                title: "Min Replicas",
                description: "Must not exceed Max Replicas (x-validate).",
                default: 1,
                minimum: 1,
                "x-validate": {
                  expr: "self <= parent.maxReplicas",
                  message: "Min Replicas must not exceed Max Replicas",
                },
              },
              maxReplicas: {
                type: "integer",
                title: "Max Replicas",
                description: "Must be at least Min Replicas (x-validate).",
                default: 5,
                minimum: 1,
                "x-validate": {
                  expr: "self >= parent.minReplicas",
                  message: "Max Replicas must be at least Min Replicas",
                },
              },
              targetCPU: {
                type: "integer",
                title: "Target CPU (%)",
                description: "Target average CPU utilization.",
                default: 80,
                minimum: 1,
                maximum: 100,
              },
            },
            required: ["minReplicas", "maxReplicas"],
          },
        },
      },
    },
    network: {
      type: "array",
      title: "Network Ports",
      description: "Expose container ports.",
      "x-order": 3,
      items: {
        type: "object",
        required: ["port", "protocol"],
        properties: {
          protocol: {
            type: "string",
            title: "Protocol",
            description: "Service protocol.",
            enum: ["http", "https", "grpc", "tcp", "udp"],
            default: "http",
          },
          port: {
            type: "integer",
            title: "Port",
            description: "Container port (1-65535).",
            default: 80,
            minimum: 1,
            maximum: 65535,
          },
          exposed: {
            type: "boolean",
            title: "External Access",
            description: "Create an ingress when on.",
            default: false,
          },
        },
        if: {
          properties: { exposed: { const: true } },
          required: ["exposed"],
        },
        then: {
          properties: {
            host: {
              type: "string",
              title: "Domain Name",
              description: "Public hostname, e.g. api.example.com.",
            },
          },
          required: ["host"],
        },
      },
    },
    resources: {
      type: "object",
      title: "Resources",
      description: "Requests and limits for the workload.",
      "x-order": 4,
      properties: {
        cpu: {
          type: "number",
          title: "CPU Cores",
          description: "0.1-32, in 0.1 steps.",
          default: 0.5,
          minimum: 0.1,
          maximum: 32,
          multipleOf: 0.1,
        },
        memory: {
          type: "string",
          title: "Memory",
          description: "Kubernetes quantity, e.g. 512Mi.",
          default: "512Mi",
          format: "quantity",
        },
        runAsUser: {
          type: ["integer", "null"],
          title: "Run As User",
          description: "UID to run as; null uses the image default.",
          default: null,
        },
      },
    },
    labels: {
      type: "object",
      title: "Labels",
      description: "Free-form key/value labels (additionalProperties).",
      "x-order": 5,
      additionalProperties: { type: "string" },
    },
    annotations: {
      type: "object",
      title: "Annotations",
      description: "Keys matching example.com/* (patternProperties).",
      "x-order": 6,
      patternProperties: {
        "^example\\.com/": {
          type: "string",
          title: "Annotation",
          description: "Annotation value.",
        },
      },
      additionalProperties: false,
    },
    audit: {
      type: "object",
      title: "Audit",
      description: "Request auditing configuration.",
      "x-order": 7,
      properties: {
        level: {
          type: "string",
          title: "Audit Level",
          description: "Labeled enum rendered by the x-enum extension.",
          "x-enum": [
            { name: "Disabled", value: "off" },
            { name: "Metadata only", value: "metadata" },
            { name: "Request + response", value: "all" },
          ],
        },
      },
    },
  },
};

export const appConfigValue = {
  name: "web-api",
  basic: {
    image: "nginx:latest",
    flavor: "cpu-2c4g",
    imageAuth: { enabled: true, username: "admin", password: "s3cret" },
    mode: "deployment",
    replicas: 3,
    autoScaling: {
      enabled: true,
      minReplicas: 2,
      maxReplicas: 8,
      targetCPU: 75,
    },
  },
  network: [
    { protocol: "http", port: 80, exposed: true, host: "api.example.com" },
  ],
  resources: { cpu: 1, memory: "1Gi", runAsUser: 1000 },
  labels: { team: "platform", env: "prod" },
  annotations: { "example.com/owner": "platform-team" },
  audit: { level: "metadata" },
};

export const appConfigExample: Example = {
  name: "Application Configuration",
  schema: appConfigSchema,
  value: appConfigValue,
};
