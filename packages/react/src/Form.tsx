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
  type RefCallback,
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
   * Validate the entire form by triggering validation for all fields.
   * Forces re-validation even for untouched fields.
   * @returns true if form is valid (no errors), false otherwise
   */
  validate(): boolean;

  /**
   * Check if the form currently has any validation errors.
   * Does not trigger validation, only checks current state.
   * @returns true if form has no errors, false otherwise
   */
  isValid(): boolean;

  /**
   * Get the current form value.
   * @returns The current form data
   */
  getValue(): unknown;

  /**
   * Scroll to the first field with a validation error.
   * @param options - Optional scroll behavior options
   * @returns true if an error field was found and scrolled to, false otherwise
   */
  scrollToFirstError(options?: ScrollIntoViewOptions): boolean;
}

/**
 * Find the first field node with a validation error (depth-first).
 * Unlike findFirstErrorPath, this returns the node itself rather than its path.
 * @param node - The root node to start searching from
 * @returns The first node with an error, or null if no errors found
 */
function findFirstErrorNode(node: FieldNode): FieldNode | null {
  // Check if this node has an error
  if (node.error && !node.error.valid) {
    // If this node has children, check if any child has an error first
    // This ensures we find the deepest/most specific error
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childError = findFirstErrorNode(child);
        if (childError !== null) {
          return childError;
        }
      }
    }
    // No child errors, return this node
    return node;
  }

  // This node has no error, check children
  if (node.children) {
    for (const child of node.children) {
      const childError = findFirstErrorNode(child);
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
  /** Callback to trigger validation, typically called on blur */
  onBlur: () => void;
  runtime: SchemaRuntime;
  mode?: FormMode;
  /**
   * Ref callback to register the field's DOM element for scrollToFirstError.
   * Pass this to the ref prop of your widget: `<div ref={fieldRef}>...</div>`
   */
  fieldRef: RefCallback<HTMLElement>;
  /** Custom props passed through from FormField */
  [key: string]: unknown;
}

export interface FormFieldProps {
  runtime: SchemaRuntime;
  /** JSON path to render (e.g., "#" for root, "#/properties/name" for nested) */
  path: string;
  /** Render function to create UI for this field */
  render?: (props: FormFieldRenderProps) => ReactNode;
  /** Custom props to pass through to the render function */
  [key: string]: unknown;
}

export function FormField({ runtime, path, render, ...props }: FormFieldProps) {
  // Get node reference once - node reference is stable across updates
  const node = useMemo(() => runtime.findNode(path), [runtime, path]);

  // Get context for registry and mode
  const context = useFormContext();
  const registry = context?.domRegistry ?? null;

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

  // onBlur callback - can be used to trigger validation on blur
  const onBlur = useCallback(() => {
    // Re-validate by setting current value (triggers validation)
    const currentValue = runtime.getValue(path);
    runtime.setValue(path, currentValue);
  }, [runtime, path]);

  // Create fieldRef callback for DOM element registration
  const instanceLocation = node?.instanceLocation ?? "";
  const fieldRef: RefCallback<HTMLElement> = useCallback(
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
            onBlur,
            fieldRef,
            version,
            ...props,
          } as FormFieldRenderProps)
        : null,
    [node, version, runtime, onChange, onBlur, fieldRef, path, props],
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
  /** Initial values for shared state. Keys are state keys, values are initial values. */
  sharedStateInitialValues?: Record<string, unknown>;
};

export const Form = forwardRef<FormHandle, FormProps>(function Form(
  props: FormProps,
  ref,
) {
  const {
    schema,
    value,
    onChange,
    validator,
    render,
    runtimeOptions,
    mode,
    sharedStateInitialValues,
  } = props;

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
  const formSharedState = useFormSharedState(sharedStateInitialValues);

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
      validate: (): boolean => {
        // Force re-validation by setting the current value
        // This ensures all fields are validated, including untouched ones
        const currentValue = runtime.getValue("#");
        runtime.setValue("#", currentValue);
        // Check if there are any errors after validation
        return findFirstErrorNode(runtime.root) === null;
      },
      isValid: (): boolean => {
        return findFirstErrorNode(runtime.root) === null;
      },
      getValue: (): unknown => {
        return runtime.getValue("#");
      },
      scrollToFirstError: (
        options: ScrollIntoViewOptions = {
          behavior: "smooth",
          block: "center",
        },
      ): boolean => {
        const node = findFirstErrorNode(runtime.root);
        if (node === null) {
          return false;
        }
        const element = domRegistry.get(node.instanceLocation);
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
