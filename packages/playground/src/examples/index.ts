import type { Schema } from "@schema-ts/core";
import { appConfigExample } from "./appConfig";
import { galleryExample } from "./gallery";

export interface Example {
  name: string;
  schema: Schema;
  value: unknown;
}

export const examples: Example[] = [appConfigExample, galleryExample];
