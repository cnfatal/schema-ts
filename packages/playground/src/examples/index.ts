import type { Schema } from "@schema-ts/core";
import { userProfileSchema, userProfileValue } from "./userProfile";
import { appConfigExample } from "./appConfig";
import { dynamicFieldsSchema, dynamicFieldsValue } from "./dynamicFields";
import { nestedIfThenElseExample } from "./nestedIfThenElse";
import { cloudResourceExample } from "./cloudResource";

export interface Example {
  name: string;
  schema: Schema;
  value: unknown;
}

export const examples: Example[] = [
  appConfigExample,
  {
    name: "User Profile",
    schema: userProfileSchema,
    value: userProfileValue,
  },
  {
    name: "Dynamic Fields",
    schema: dynamicFieldsSchema,
    value: dynamicFieldsValue,
  },
  nestedIfThenElseExample,
  cloudResourceExample,
];
