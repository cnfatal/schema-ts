import type { Schema } from "@schema-ts/core";

export const simpleLoginSchema: Schema = {
  type: "object",
  title: "Simple Login",
  required: ["username", "password"],
  properties: {
    username: {
      type: "string",
      title: "Username",
      minLength: 3,
    },
    password: {
      type: "string",
      title: "Password",
      minLength: 6,
      format: "password", // Note: standard JSON schema doesn't have "password" format, but UI libraries often support it or we can treat it as string
    },
    rememberMe: {
      type: "boolean",
      title: "Remember Me",
      default: false,
    },
  },
};

export const simpleLoginValue = {
  username: "admin",
  password: "password123",
  rememberMe: true,
};
