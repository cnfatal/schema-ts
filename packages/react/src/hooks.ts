import { SchemaRuntime } from "@schema-ts/core";
import { useSyncExternalStore } from "react";

/**
 * Hook to subscribe to a specific node in the SchemaRuntime.
 * Triggers a re-render ONLY when the specific node changes (version increment).
 */
export function useValue<T = unknown>(runtime: SchemaRuntime, path: string): T {
  useSyncExternalStore(
    (onStoreChange) => runtime.subscribe(path, onStoreChange),
    () => {
      const node = runtime.findNode(path);
      return node ? node.version : -1;
    },
  );

  return runtime.getValue(path) as T;
}
