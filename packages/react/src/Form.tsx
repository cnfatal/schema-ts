import {
  type FieldNode,
  Schema,
  type SchemaChangeEvent,
  SchemaRuntime,
  type SchemaRuntimeOptions,
  Validator,
  deepEqual,
} from "@schema-ts/core";
import {
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type FieldDomRegistry,
  type FormContextValue,
  type FormMode,
  FormContext,
  useFormContext,
  useFormSharedState,
} from "./FormContext";

/**
 * Imperative handle exposed by the Form component via ref.
 * Allows external control of form behavior.
 */
export interface FormHandle {
  /**
   * Scroll to the first field with a validation error.
   * @param options - Optional scroll behavior options
   * @returns true if an error field was found and scrolled to, false otherwise
   */
  scrollToFirstError(options?: ScrollIntoViewOptions): boolean;
}

/**
 * Find the first field node with a validation error (depth-first).
 * @param node - The root node to start searching from
 * @returns The instanceLocation path of the first error, or null if no errors
 */
function findFirstErrorPath(node: FieldNode): string | null {
  // Check if this node has an error
  if (node.error && !node.error.valid) {
    // If this node has children, check if any child has an error first
    // This ensures we find the deepest/most specific error
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childError = findFirstErrorPath(child);
        if (childError !== null) {
          return childError;
        }
      }
    }
    // No child errors, return this node's path
    return node.instanceLocation;
  }

  // This node has no error, check children
  if (node.children) {
    for (const child of node.children) {
      const childError = findFirstErrorPath(child);
      if (childError !== null) {
        return childError;
      }
    }
  }

  return null;
}

export interface FormFieldRenderProps extends FieldNode {
  value: unknown;
  onChange: (val: unknown) => void;
  runtime: SchemaRuntime;
  mode?: FormMode;
  /**
   * Ref callback to register the field's DOM element for scrollToFirstError.
   * Pass this to the root element of your widget: `<div ref={registerRef}>...</div>`
   */
  registerRef: (element: HTMLElement | null) => void;
}

export interface FormFieldProps {
  runtime: SchemaRuntime;
  // jsonpath to render
  path: string;
  // render call Component to render ui
  render?: (props: FormFieldRenderProps) => ReactNode;
  mode?: FormMode;
  [key: string]: unknown;
}

export function FormField({ runtime, path, render, ...props }: FormFieldProps) {
  // Get node reference once - node reference is stable across updates
  const node = useMemo(() => runtime.findNode(path), [runtime, path]);

  // Get context for registry and mode
  const context = useFormContext();
  const registry = context?.domRegistry ?? null;
  const mode = props.mode ?? context?.mode;

  // Stable subscribe callback - only trigger re-render for value and schema changes
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      runtime.subscribe(path, (e: SchemaChangeEvent) => {
        // TODO: limit to value/schema changes only?
        if (e.type) {
          onStoreChange();
        }
      }),
    [runtime, path],
  );

  // Get version directly from cached node reference
  const version = useSyncExternalStore(subscribe, () => node?.version ?? -1);

  const onChange = useCallback(
    (val: unknown) => runtime.setValue(path, val),
    [runtime, path],
  );

  // Create registerRef callback for DOM element registration
  const instanceLocation = node?.instanceLocation ?? "";
  const registerRef = useCallback(
    (element: HTMLElement | null) => {
      if (!registry) return;
      if (element) {
        registry.register(instanceLocation, element);
      } else {
        registry.unregister(instanceLocation);
      }
    },
    [registry, instanceLocation],
  );

  const renderProps = useMemo(
    () =>
      node
        ? ({
            ...node,
            value: runtime.getValue(path),
            runtime,
            onChange,
            registerRef,
            version,
            ...props,
            mode,
          } as FormFieldRenderProps)
        : null,
    [node, version, runtime, onChange, registerRef, path, props, mode],
  );

  if (!renderProps) return null;

  return render?.(renderProps) ?? null;
}

export type FormProps = {
  schema: Schema;
  value?: unknown;
  onChange?: (value: unknown) => void;
  validator?: Validator;
  render?: (props: FormFieldRenderProps) => ReactNode;
  /** Form mode: 'create' for new records, 'edit' for existing records */
  mode?: FormMode;
  /** Schema runtime options for controlling default value behavior */
  runtimeOptions?: SchemaRuntimeOptions;
};

export const Form = forwardRef<FormHandle, FormProps>(function Form(
  props: FormProps,
  ref,
) {
  const { schema, value, onChange, validator, render, runtimeOptions, mode } =
    props;

  // Capture initial value only once at mount
  const [initialValue] = useState(() => value);

  const runtime = useMemo(
    () =>
      new SchemaRuntime(
        validator ?? new Validator(),
        schema,
        initialValue,
        runtimeOptions,
      ),
    [schema, validator, initialValue, runtimeOptions],
  );

  // Create field DOM registry
  const registryMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const domRegistry = useMemo<FieldDomRegistry>(
    () => ({
      register: (path: string, element: HTMLElement) => {
        registryMapRef.current.set(path, element);
      },
      unregister: (path: string) => {
        registryMapRef.current.delete(path);
      },
      get: (path: string) => registryMapRef.current.get(path),
    }),
    [],
  );

  // Shared state for communication between components
  const formSharedState = useFormSharedState();

  // Create form context value
  const formContextValue = useMemo<FormContextValue>(
    () => ({
      runtime,
      domRegistry,
      mode,
      formSharedState,
    }),
    [runtime, domRegistry, mode, formSharedState],
  );

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      scrollToFirstError: (
        options: ScrollIntoViewOptions = {
          behavior: "smooth",
          block: "center",
        },
      ): boolean => {
        const errorPath = findFirstErrorPath(runtime.root);
        if (errorPath === null) {
          return false;
        }
        const element = domRegistry.get(errorPath);
        if (element) {
          element.scrollIntoView(options);
          // Try to focus the element if it's focusable
          if (typeof element.focus === "function") {
            element.focus();
          }
          return true;
        }
        return false;
      },
    }),
    [runtime, domRegistry],
  );

  // Sync external value to runtime (only when value actually differs)
  useEffect(() => {
    const currentValue = runtime.getValue("#");
    if (!deepEqual(currentValue, value)) {
      runtime.setValue("#", value);
    }
  }, [runtime, value]);

  useEffect(() => {
    if (onChange) {
      return runtime.subscribeAll((e: SchemaChangeEvent) => {
        if (e.type === "value") {
          onChange(runtime.getValue("#"));
        }
      });
    }
    return undefined;
  }, [runtime, onChange]);

  return (
    <FormContext.Provider value={formContextValue}>
      <FormField path={"#"} runtime={runtime} render={render} />
    </FormContext.Provider>
  );
});
