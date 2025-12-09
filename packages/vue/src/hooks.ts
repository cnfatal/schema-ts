import { type SchemaRuntime } from "@schema-ts/core";

export function useValue<T = unknown>(
  _runtime: SchemaRuntime,
  _path: string,
): T {
  return undefined as T;
}
