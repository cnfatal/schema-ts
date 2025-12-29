import type { Schema } from "@schema-ts/core";
import { userProfileSchema, userProfileValue } from "./userProfile";
import { simpleLoginSchema, simpleLoginValue } from "./simpleLogin";
import { appConfigSchema, appConfigValue } from "./appConfig";
import { dynamicFieldsSchema, dynamicFieldsValue } from "./dynamicFields";
import {
  nestedIfThenElseSchema,
  nestedIfThenElseValue,
} from "./nestedIfThenElse";
import { cloudResourceSchema, cloudResourceValue } from "./cloudResource";

export interface Example {
  name: string;
  schema: Schema;
  value: unknown;
}

export const examples: Example[] = [
  {
    name: "User Profile",
    schema: userProfileSchema,
    value: userProfileValue,
  },
  {
    name: "Simple Login",
    schema: simpleLoginSchema,
    value: simpleLoginValue,
  },
  {
    name: "App Configuration",
    schema: appConfigSchema,
    value: appConfigValue,
  },
  {
    name: "Dynamic Fields",
    schema: dynamicFieldsSchema,
    value: dynamicFieldsValue,
  },
  {
    name: "Nested Conditional (Shipping)",
    schema: nestedIfThenElseSchema,
    value: nestedIfThenElseValue,
  },
  {
    name: "Cloud Resource (Nested)",
    schema: cloudResourceSchema,
    value: cloudResourceValue,
  },
];
