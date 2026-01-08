import { SchemaRuntime } from "@schema-ts/core";
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  useMemo,
  useRef,
} from "react";

export type FormMode = "create" | "edit";

/**
 * Registry for DOM elements associated with form fields.
 * UI components can register their root DOM element by instanceLocation path.
 */
export interface FieldDomRegistry {
  /** Register a DOM element for a field path */
  register(path: string, element: HTMLElement): void;
  /** Unregister a DOM element for a field path */
  unregister(path: string): void;
  /** Get the DOM element for a field path */
  get(path: string): HTMLElement | undefined;
}

export interface FormSharedState {
  setValue(key: string, value: unknown): void;
  getValue(key: string): unknown;
  subscribe(key: string, callback: (value: unknown) => void): () => void;
}

/**
 * Context value providing access to form-level utilities.
 */
export interface FormContextValue {
  /** The SchemaRuntime instance managing form state */
  runtime: SchemaRuntime;
  /** Registry for DOM elements associated with form fields */
  domRegistry: FieldDomRegistry;
  /** Form mode: 'create' for new records, 'edit' for existing records */
  mode?: FormMode;
  /** Shared state for communication between components */
  formSharedState: FormSharedState;
}

/**
 * Context providing access to form-level utilities.
 * Widget components can use this to access runtime, DOM registry, etc.
 */
export const FormContext = createContext<FormContextValue | null>(null);

/**
 * Hook to access the form context from within a form.
 * @returns The FormContextValue or null if not within a Form
 */
export function useFormContext(): FormContextValue | null {
  return useContext(FormContext);
}

/**
 * Hook to watch a shared state key in the form context.
 * Triggers a re-render when the key's value changes.
 * @param key - The key to watch
 * @returns The current value for the key
 */
export function useFormContextSharedStateValue<T>(key: string): T | undefined {
  const context = useFormContext();
  if (!context) {
    throw new Error(
      "useFormContextSharedStateValue must be used within a Form",
    );
  }

  const { formSharedState } = context;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return formSharedState.subscribe(key, onStoreChange);
    },
    [formSharedState, key],
  );

  const getSnapshot = useCallback(() => {
    return formSharedState.getValue(key) as T | undefined;
  }, [formSharedState, key]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Hook to access the form's shared state management.
 * Allows setting and getting shared values between components.
 */
export function useFormContextSharedState() {
  const context = useFormContext();
  if (!context) {
    throw new Error("useFormContextSharedState must be used within a Form");
  }
  return context.formSharedState;
}

/**
 * Hook to create a shared state management instance.
 * Provides setValue, getValue, and subscribe methods for inter-component communication.
 * @param initialValues - Optional initial values for the shared state (only applied on mount)
 */
export function useFormSharedState(
  initialValues?: Record<string, unknown>,
): FormSharedState {
  const valuesRef = useRef<Map<string, unknown>>(
    new Map(initialValues ? Object.entries(initialValues) : undefined),
  );
  const listenersRef = useRef<Map<string, Set<(val: unknown) => void>>>(
    new Map(),
  );

  return useMemo(
    () => ({
      setValue: (key: string, value: unknown) => {
        if (valuesRef.current.get(key) === value) return;
        valuesRef.current.set(key, value);
        listenersRef.current.get(key)?.forEach((l) => l(value));
      },
      getValue: (key: string) => valuesRef.current.get(key),
      subscribe: (key: string, callback: (value: unknown) => void) => {
        if (!listenersRef.current.has(key)) {
          listenersRef.current.set(key, new Set());
        }
        const listeners = listenersRef.current.get(key);
        if (listeners) {
          listeners.add(callback);
        }
        return () => {
          const listeners = listenersRef.current.get(key);
          if (listeners) {
            listeners.delete(callback);
          }
        };
      },
    }),
    [],
  );
}
