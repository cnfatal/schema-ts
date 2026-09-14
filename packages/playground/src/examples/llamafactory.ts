import type { Schema } from "@schema-ts/core";
import type { Example } from ".";
import schema from "./llamafactory.schema.json";

/**
 * LLaMA-Factory fine-tuning chart schema. Its `runMode` default ("quick") gates
 * expert-only `allOf` branches, so it exercises conditional default projection:
 * the advanced fields must stay hidden until `runMode` is "expert".
 */
export const llamafactoryExample: Example = {
  name: "LLaMA-Factory",
  schema: schema as unknown as Schema,
  value: {},
};
