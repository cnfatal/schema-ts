import type { Schema } from "@schema-ts/core";

export const appConfigSchema: Schema = {
  type: "object",
  title: "Application Configuration",
  properties: {
    appName: {
      type: "string",
      title: "Application Name",
      default: "MyApp",
    },
    version: {
      type: "string",
      title: "Version",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
    features: {
      type: "object",
      title: "Features",
      properties: {
        darkMode: { type: "boolean", title: "Dark Mode" },
        notifications: { type: "boolean", title: "Notifications" },
        betaAccess: { type: "boolean", title: "Beta Access" },
      },
    },
    apiEndpoints: {
      type: "array",
      title: "API Endpoints",
      items: {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
          url: { type: "string", title: "URL", format: "uri" },
        },
        required: ["name", "url"],
      },
    },
  },
};

export const appConfigValue = {
  appName: "My Awesome App",
  version: "1.0.0",
  features: {
    darkMode: true,
    notifications: false,
    betaAccess: true,
  },
  apiEndpoints: [
    { name: "Production", url: "https://api.myapp.com" },
    { name: "Staging", url: "https://staging-api.myapp.com" },
  ],
};
