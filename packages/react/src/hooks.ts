import { SchemaRuntime } from "@schema-ts/core";
import { useEffect, useReducer } from "react";

/**
 * Hook to subscribe to a specific node in the SchemaRuntime.
 * Triggers a re-render ONLY when the specific node changes (version increment).
 */
export function useValue<T = unknown>(runtime: SchemaRuntime, path: string): T {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    return runtime.subscribe(path, (e) => {
      if (e.type === "value") forceUpdate();
    });
  }, [runtime, path]);

  return runtime.getValue(path) as T;
}
