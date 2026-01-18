import type { Schema } from "@schema-ts/core";
import { Example } from ".";

export const appConfigSchema: Schema = {
  type: "object",
  properties: {
    basic: {
      type: "object",
      title: "Basic Settings",
      properties: {
        image: {
          type: "string",
          title: "Image",
          default: "nginx:latest",
        },
        imageAuth: {
          type: "object",
          title: "Image Authentication",
          properties: {
            enabled: {
              type: "boolean",
              title: "Enable Authentication",
              default: false,
            },
          },
          if: {
            properties: {
              enabled: {
                const: true,
              },
            },
          },
          then: {
            properties: {
              username: {
                type: "string",
                title: "Username",
              },
              password: {
                type: "string",
                title: "Password",
                format: "password",
              },
            },
          },
        },
        flavor: {
          type: "object",
          title: "Flavor",
          "x-resource-enum": {
            resource: "flavors",
            type: "cpu,gpu",
          },
          properties: {
            resources: {
              type: "object",
            },
            nodeSelector: {
              type: "object",
            },
            nodeAffinity: {
              type: "object",
            },
          },
        },
        mode: {
          type: "string",
          title: "Workload Type",
          enum: ["deployment", "statefulset"],
          default: "deployment",
        },
        replicas: {
          type: "integer",
          title: "Replicas",
          default: 1,
          minimum: 1,
        },
        autoScaling: {
          type: "object",
          title: "Auto Scaling",
          properties: {
            enabled: {
              type: "boolean",
              title: "Enable Auto Scaling",
              default: false,
            },
          },
          if: {
            properties: {
              enabled: {
                const: true,
              },
            },
          },
          then: {
            properties: {
              minReplicas: {
                type: "integer",
                title: "Min Replicas",
                default: 1,
                minimum: 1,
              },
              maxReplicas: {
                type: "integer",
                title: "Max Replicas",
                default: 5,
                minimum: 1,
              },
              cpu: {
                type: "integer",
                title: "Target CPU Utilization (%)",
                default: 80,
                minimum: 1,
                maximum: 100,
              },
              memory: {
                type: "integer",
                title: "Target Memory Utilization (%)",
                default: 80,
                minimum: 1,
                maximum: 100,
              },
            },
          },
        },
      },
    },
    network: {
      type: "array",
      title: "Network Configuration",
      items: {
        type: "object",
        required: ["port", "protocol"],
        properties: {
          protocol: {
            type: "string",
            title: "Protocol",
            enum: ["http", "https", "grpc", "grpcs", "ws", "wss", "tcp", "udp"],
            default: "http",
          },
          port: {
            type: "integer",
            title: "Port",
            default: 80,
            minimum: 1,
            maximum: 65535,
          },
          exposed: {
            type: "boolean",
            title: "Enable External Access",
            default: false,
          },
        },
        if: {
          properties: {
            exposed: {
              const: true,
            },
            protocol: {
              enum: ["http", "https", "grpc", "grpcs", "ws", "wss"],
            },
          },
        },
        then: {
          properties: {
            ingressHost: {
              type: "string",
              title: "Domain Name",
              "x-generate": {
                type: "ingress-hostname",
              },
            },
          },
        },
      },
    },
    advanced: {
      type: "object",
      title: "Advanced Settings",
      "x-collapse": true,
      properties: {
        command: {
          title: "Start Command",
          description: "Container start command, e.g. 'sh -c'",
          type: "string",
        },
        args: {
          title: "Start Arguments",
          description:
            "Container start arguments, e.g. 'echo starting && ./start-server'",
          type: "string",
        },
        envfile: {
          type: "string",
          title: "Environment Variables",
          description: "KEY=VALUE format, one per line",
          maxLength: 1000,
        },
        configs: {
          type: "array",
          title: "Config Files",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                title: "Mount Path",
              },
              data: {
                type: "string",
                title: "File Content",
                maxLength: 10000,
              },
            },
          },
        },
        mounts: {
          type: "array",
          title: "Storage Volumes",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                title: "Mount Path",
              },
              size: {
                type: "string",
                title: "Capacity",
                format: "quantity",
                default: "1Gi",
                "x-quantity": {
                  min: "1Gi",
                  max: "100Gi",
                },
              },
              storageClassName: {
                type: "string",
                title: "Storage Class",
                description: "Leave empty to use default storage class",
              },
            },
          },
        },
      },
    },
  },
};

export const appConfigValue = {};

export const appConfigExample: Example = {
  name: "Application Configuration",
  schema: appConfigSchema,
  value: appConfigValue,
};
