import type { Schema } from "@schema-ts/core";
import type { Example } from ".";

/**
 * A single form that exercises every scenario the renderer supports: all
 * primitive types and formats, constraints, enums, readable consts, nullable
 * values, conditional if/then/else (including nesting), arrays (items,
 * objects, prefixItems), dynamic keys, composition (allOf/anyOf/oneOf) and
 * $ref/$defs.
 */
export const gallerySchema: Schema = {
  type: "object",
  title: "Schema Feature Gallery",
  description: "One form covering every supported scenario.",
  required: ["summary", "choice"],
  properties: {
    image: {
      type: "string",
      title: "Container Image",
      description: "Dialog select (x-resource-enum)",
      default: "nginx:latest",
      "x-resource-enum": { resource: "image" },
      "x-order": 0,
    },
    flavor: {
      type: "string",
      title: "Flavor",
      description: "Filtered dialog select (resource: flavor, type: cpu,gpu)",
      default: "cpu-2c4g",
      "x-resource-enum": { resource: "flavor", type: "cpu,gpu" },
      "x-order": 1,
    },
    summary: {
      type: "string",
      title: "Summary",
      description: "Required; 3-60 characters.",
      minLength: 3,
      maxLength: 60,
      default: "Gallery overview",
      "x-order": 1,
    },
    text: {
      type: "object",
      title: "Text & Formats",
      "x-collapse": true,
      "x-order": 2,
      properties: {
        email: {
          type: "string",
          title: "Email",
          format: "email",
          default: "user@example.com",
        },
        website: {
          type: "string",
          title: "Website",
          format: "uri",
          default: "https://example.com",
        },
        hostname: {
          type: "string",
          title: "Hostname",
          format: "hostname",
          default: "api.example.com",
        },
        ipv4: {
          type: "string",
          title: "IPv4",
          format: "ipv4",
          default: "10.0.0.1",
        },
        uuid: {
          type: "string",
          title: "UUID",
          format: "uuid",
          default: "550e8400-e29b-41d4-a716-446655440000",
        },
        date: {
          type: "string",
          title: "Date",
          format: "date",
          default: "2025-01-31",
        },
        duration: {
          type: "string",
          title: "Duration",
          format: "duration",
          default: "PT30S",
        },
        password: { type: "string", title: "Password", format: "password" },
        code: {
          type: "string",
          title: "Code",
          pattern: "^[A-Z]{3}-[0-9]{3}$",
          description: "Pattern: ABC-123",
        },
        nullable: {
          type: ["string", "null"],
          title: "Nullable Text",
          default: null,
          description: 'type: ["string","null"]',
        },
        locked: {
          type: "string",
          title: "Constant",
          const: "read-only",
          description: "const value; the field is read-only.",
        },
      },
    },
    numbers: {
      type: "object",
      title: "Numbers",
      "x-collapse": true,
      "x-order": 3,
      properties: {
        count: {
          type: "integer",
          title: "Count",
          description: "0-100",
          minimum: 0,
          maximum: 100,
          default: 10,
        },
        ratio: {
          type: "number",
          title: "Ratio",
          description: "multipleOf 0.05",
          minimum: 0,
          maximum: 1,
          multipleOf: 0.05,
          default: 0.5,
        },
        exclusive: {
          type: "number",
          title: "Exclusive",
          description: "exclusiveMinimum 0, exclusiveMaximum 1",
          exclusiveMinimum: 0,
          exclusiveMaximum: 1,
          default: 0.5,
        },
        port: {
          type: "integer",
          title: "Port",
          minimum: 1,
          maximum: 65535,
          default: 8080,
        },
        minValue: {
          type: "number",
          title: "Min Value",
          description: "must be less than Max Value",
          default: 1,
          "x-validate": {
            expr: "self < parent.maxValue",
            message: "Min Value must be less than Max Value",
          },
        },
        maxValue: {
          type: "number",
          title: "Max Value",
          description: "must be greater than Min Value",
          default: 10,
          "x-validate": {
            expr: "self > parent.minValue",
            message: "Max Value must be greater than Min Value",
          },
        },
      },
    },
    choice: {
      type: "object",
      title: "Choices",
      "x-collapse": true,
      "x-order": 4,
      required: ["single"],
      properties: {
        single: {
          type: "string",
          title: "Single Select",
          enum: ["alpha", "beta", "gamma"],
        },
        numeric: {
          type: "integer",
          title: "Numeric Enum",
          enum: [1, 2, 3],
          default: 2,
        },
        labeled: {
          type: "string",
          title: "Labeled Enum",
          "x-enum": [
            { name: "Low", value: "low" },
            { name: "Medium", value: "medium" },
            { name: "High", value: "high" },
          ],
          default: "medium",
        },
      },
    },
    toggle: {
      type: "object",
      title: "Conditional (if / then / else)",
      "x-order": 5,
      properties: {
        enabled: { type: "boolean", title: "Enable Feature", default: true },
      },
      if: { properties: { enabled: { const: true } }, required: ["enabled"] },
      then: {
        properties: {
          endpoint: {
            type: "string",
            title: "Endpoint",
            format: "uri",
            default: "https://api.example.com",
          },
          retries: {
            type: "integer",
            title: "Retries",
            minimum: 0,
            maximum: 10,
            default: 3,
          },
        },
        required: ["endpoint"],
      },
      else: {
        properties: { reason: { type: "string", title: "Disabled Reason" } },
      },
    },
    nestedCondition: {
      type: "object",
      title: "Nested Condition",
      "x-order": 6,
      properties: {
        kind: {
          type: "string",
          title: "Kind",
          enum: ["compute", "storage"],
          default: "compute",
        },
      },
      if: { properties: { kind: { const: "compute" } }, required: ["kind"] },
      then: {
        properties: {
          family: {
            type: "string",
            title: "Family",
            enum: ["general", "memory"],
            default: "general",
          },
        },
        required: ["family"],
        if: {
          properties: { family: { const: "memory" } },
          required: ["family"],
        },
        then: {
          properties: {
            size: {
              type: "string",
              title: "Size",
              enum: ["xlarge", "2xlarge", "4xlarge"],
              default: "xlarge",
            },
          },
          required: ["size"],
        },
        else: {
          properties: {
            size: {
              type: "string",
              title: "Size",
              enum: ["small", "medium", "large"],
              default: "small",
            },
          },
          required: ["size"],
        },
      },
      else: {
        properties: {
          storageType: {
            type: "string",
            title: "Storage Type",
            enum: ["ssd", "hdd"],
            default: "ssd",
          },
        },
        required: ["storageType"],
      },
    },
    lists: {
      type: "object",
      title: "Arrays",
      "x-order": 7,
      properties: {
        tags: {
          type: "array",
          title: "String List",
          description: "uniqueItems, minItems 1",
          items: { type: "string" },
          uniqueItems: true,
          minItems: 1,
          default: ["api", "prod"],
        },
        servers: {
          type: "array",
          title: "Object List",
          items: {
            type: "object",
            required: ["host"],
            properties: {
              host: { type: "string", title: "Host", format: "hostname" },
              port: { type: "integer", title: "Port", default: 443 },
              tls: { type: "boolean", title: "TLS", default: true },
            },
          },
          default: [{ host: "api.example.com", port: 443, tls: true }],
        },
        coordinates: {
          type: "array",
          title: "Tuple (prefixItems)",
          prefixItems: [
            { type: "number", title: "Latitude" },
            { type: "number", title: "Longitude" },
          ],
          items: { type: "number", title: "Extra" },
          default: [31.23, 121.47],
        },
      },
    },
    dynamic: {
      type: "object",
      title: "Dynamic Keys",
      "x-order": 8,
      properties: {
        labels: {
          type: "object",
          title: "Labels",
          description: "additionalProperties",
          additionalProperties: { type: "string" },
          default: { team: "platform" },
        },
        env: {
          type: "object",
          title: "Environment",
          description: "patternProperties ^API_",
          patternProperties: { "^API_": { type: "string", title: "API Env" } },
          additionalProperties: false,
          default: { API_KEY: "secret" },
        },
      },
    },
    composition: {
      type: "object",
      title: "Composition (allOf / anyOf / oneOf)",
      "x-collapse": true,
      "x-order": 9,
      properties: {
        merged: {
          type: "object",
          title: "allOf",
          properties: {
            name: { type: "string", title: "Name", default: "abc" },
          },
          allOf: [
            { properties: { name: { minLength: 2 } } },
            { required: ["name"] },
          ],
        },
        anyOfField: {
          type: "object",
          title: "anyOf",
          properties: {
            email: { type: "boolean", title: "Email", default: true },
            sms: { type: "boolean", title: "SMS", default: false },
          },
          anyOf: [
            {
              properties: {
                email: { const: true },
                emailAddress: {
                  type: "string",
                  title: "Email Address",
                  format: "email",
                },
              },
              required: ["email"],
            },
            {
              properties: {
                sms: { const: true },
                phone: { type: "string", title: "Phone" },
              },
              required: ["sms"],
            },
          ],
        },
        oneOfField: {
          type: "object",
          title: "oneOf",
          properties: {
            method: {
              type: "string",
              title: "Method",
              enum: ["card", "bank"],
              default: "card",
            },
          },
          oneOf: [
            {
              properties: {
                method: { const: "card" },
                cardNumber: { type: "string", title: "Card Number" },
              },
              required: ["method"],
            },
            {
              properties: {
                method: { const: "bank" },
                iban: { type: "string", title: "IBAN" },
              },
              required: ["method"],
            },
          ],
        },
      },
    },
    refs: {
      type: "object",
      title: "Reusable Definitions ($ref / $defs)",
      "x-order": 10,
      properties: {
        primary: { $ref: "#/$defs/endpoint" },
        backup: { $ref: "#/$defs/endpoint" },
      },
    },
  },
  $defs: {
    endpoint: {
      type: "object",
      title: "Endpoint",
      properties: {
        url: {
          type: "string",
          title: "URL",
          format: "uri",
          default: "https://example.com",
        },
        timeout: { type: "integer", title: "Timeout (ms)", default: 5000 },
      },
    },
  },
};

export const galleryValue = {
  image: "nginx:latest",
  flavor: "cpu-2c4g",
  summary: "Gallery overview",
  text: {
    email: "user@example.com",
    website: "https://example.com",
    hostname: "api.example.com",
    ipv4: "10.0.0.1",
    uuid: "550e8400-e29b-41d4-a716-446655440000",
    date: "2025-01-31",
    duration: "PT30S",
    password: "s3cret",
    code: "ABC-123",
    nullable: null,
    locked: "read-only",
  },
  numbers: {
    count: 10,
    ratio: 0.5,
    exclusive: 0.5,
    port: 8080,
    minValue: 1,
    maxValue: 10,
  },
  choice: { single: "alpha", numeric: 2, labeled: "medium" },
  toggle: { enabled: true, endpoint: "https://api.example.com", retries: 3 },
  nestedCondition: { kind: "compute", family: "memory", size: "xlarge" },
  lists: {
    tags: ["api", "prod"],
    servers: [{ host: "api.example.com", port: 443, tls: true }],
    coordinates: [31.23, 121.47],
  },
  dynamic: { labels: { team: "platform" }, env: { API_KEY: "secret" } },
  composition: {
    merged: { name: "abc" },
    anyOfField: { email: true, sms: false, emailAddress: "user@example.com" },
    oneOfField: { method: "card", cardNumber: "4242" },
  },
  refs: {
    primary: { url: "https://primary.example.com", timeout: 3000 },
    backup: { url: "https://backup.example.com", timeout: 5000 },
  },
};

export const galleryExample: Example = {
  name: "Feature Gallery",
  schema: gallerySchema,
  value: galleryValue,
};
