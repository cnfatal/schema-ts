import type { Schema } from "@schema-ts/core";
import { Example } from ".";

export const nestedIfThenElseSchema: Schema = {
  type: "object",
  title: "Nested Conditional Form (Shipping)",
  properties: {
    country: {
      type: "string",
      title: "Country",
      enum: ["China", "USA"],
    },
  },
  required: ["country"],
  if: {
    properties: { country: { const: "China" } },
    required: ["country"],
  },
  then: {
    properties: {
      province: {
        type: "string",
        title: "Province",
        enum: ["Guangdong", "Beijing"],
      },
    },
    required: ["province"],
    if: {
      properties: { province: { const: "Guangdong" } },
      required: ["province"],
    },
    then: {
      properties: {
        city: {
          type: "string",
          title: "City",
          enum: ["Shenzhen", "Guangzhou"],
        },
      },
      required: ["city"],
    },
    else: {
      if: {
        properties: { province: { const: "Beijing" } },
        required: ["province"],
      },
      then: {
        properties: {
          district: {
            type: "string",
            title: "District",
            enum: ["Chaoyang", "Haidian"],
          },
        },
        required: ["district"],
      },
    },
  },
  else: {
    if: {
      properties: { country: { const: "USA" } },
      required: ["country"],
    },
    then: {
      properties: {
        state: {
          type: "string",
          title: "State",
          enum: ["California", "New York"],
        },
      },
      required: ["state"],
    },
  },
};

export const nestedIfThenElseValue = {
  country: "China",
  province: "Guangdong",
  city: "Shenzhen",
};

export const nestedIfThenElseExample: Example = {
  name: "Nested If Then Else",
  schema: nestedIfThenElseSchema,
  value: nestedIfThenElseValue,
};
