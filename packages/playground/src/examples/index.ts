import type { Schema } from "@schema-ts/core";
import { appConfigExample } from "./appConfig";
import { galleryExample } from "./gallery";
import { llamafactoryExample } from "./llamafactory";

export interface Example {
  name: string;
  schema: Schema;
  value: unknown;
}

export const examples: Example[] = [
  llamafactoryExample,
  appConfigExample,
  galleryExample,
];
