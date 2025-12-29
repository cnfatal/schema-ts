import type { Schema } from "@schema-ts/core";

/**
 * Example demonstrating dynamic object properties (additionalProperties)
 * and dynamic array items
 */
export const dynamicFieldsSchema: Schema = {
  type: "object",
  title: "Dynamic Fields Demo",
  description: "Demonstrates additionalProperties and dynamic array management",
  properties: {
    // Fixed property
    name: {
      type: "string",
      title: "Configuration Name",
      description: "A fixed property that cannot be removed",
    },

    // Object with additionalProperties - allows adding/removing key-value pairs
    metadata: {
      type: "object",
      title: "Metadata",
      description: "Dynamic key-value pairs - add any custom metadata",
      additionalProperties: {
        type: "string",
      },
    },

    // Object with typed additionalProperties
    settings: {
      type: "object",
      title: "Settings",
      description: "Dynamic settings with nested object values",
      additionalProperties: {
        type: "object",
        properties: {
          enabled: { type: "boolean", title: "Enabled" },
          value: { type: "string", title: "Value" },
        },
      },
    },

    // Object with patternProperties
    envVars: {
      type: "object",
      title: "Environment Variables",
      description: "Keys matching ENV_ pattern",
      patternProperties: {
        "^ENV_.*$": {
          type: "string",
          title: "Environment Variable",
        },
      },
      additionalProperties: false,
    },

    // Array with items - dynamic add/remove
    tags: {
      type: "array",
      title: "Tags",
      description: "Dynamic list of string tags",
      items: {
        type: "string",
      },
    },

    // Array with prefixItems (fixed first elements) and items (dynamic rest)
    priorityList: {
      type: "array",
      title: "Priority List",
      description: "First 2 items are required, rest are optional",
      prefixItems: [
        { type: "string", title: "Primary (Required)" },
        { type: "string", title: "Secondary (Required)" },
      ],
      items: {
        type: "string",
        title: "Additional Priority",
      },
    },

    // Array of objects
    endpoints: {
      type: "array",
      title: "API Endpoints",
      description: "List of endpoints with URL and method",
      items: {
        type: "object",
        properties: {
          url: { type: "string", title: "URL", format: "uri" },
          method: {
            type: "string",
            title: "HTTP Method",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          },
          headers: {
            type: "object",
            title: "Headers",
            additionalProperties: { type: "string" },
          },
        },
        required: ["url", "method"],
      },
    },
  },
  required: ["name"],
};

export const dynamicFieldsValue = {
  name: "My Configuration",

  // Dynamic metadata
  metadata: {
    version: "1.0.0",
    author: "John Doe",
    environment: "production",
  },

  // Dynamic settings
  settings: {
    cache: { enabled: true, value: "redis://localhost:6379" },
    logging: { enabled: true, value: "debug" },
  },

  // Pattern-matched env vars
  envVars: {
    ENV_DATABASE_URL: "postgres://localhost:5432/mydb",
    ENV_API_KEY: "sk-abc123",
  },

  // Dynamic tags
  tags: ["production", "api", "v2"],

  // Priority list with fixed prefix items
  priorityList: ["Critical", "High", "Medium", "Low"],

  // Array of objects
  endpoints: [
    {
      url: "https://api.example.com/users",
      method: "GET",
      headers: { Authorization: "Bearer token" },
    },
    {
      url: "https://api.example.com/data",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  ],
};
