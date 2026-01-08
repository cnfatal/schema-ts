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
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type FieldDomRegistry,
  type FormContextValue,
  type FormMode,
  FormContext,
  useFormSharedState,
} from "./FormContext";
import { FormField, type FormFieldRenderProps } from "./FormField";

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

/**
 * Handler function type for custom scroll-to-error behavior.
 * @param element - The DOM element to scroll to
 * @param options - Scroll behavior options
 */
export type ScrollToErrorHandler = (
  element: HTMLElement,
  options: ScrollIntoViewOptions,
) => void;

/**
 * Default scroll-to-error handler.
 * Scrolls to an element and focuses on it after scroll completes.
 * Uses scrollend event when supported, with timeout fallback.
 * @param element - The element to scroll to
 * @param options - Scroll behavior options
 */
function scrollToElementAndFocus(
  element: HTMLElement,
  options: ScrollIntoViewOptions = { behavior: "smooth", block: "center" },
): void {
  element.scrollIntoView(options);

  // Focus after scroll completes
  const focusElement = () => {
    // Find first focusable element within or use element itself
    const focusable =
      element.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      ) ?? element;
    if (typeof focusable.focus === "function") {
      focusable.focus({ preventScroll: true });
    }
  };

  if (options.behavior === "smooth") {
    // Use scrollend event if supported, otherwise fallback to timeout
    if ("onscrollend" in window) {
      const scrollContainer =
        element.closest("[style*='overflow']") ??
        document.scrollingElement ??
        document.documentElement;
      const handleScrollEnd = () => {
        focusElement();
        scrollContainer.removeEventListener("scrollend", handleScrollEnd);
      };
      scrollContainer.addEventListener("scrollend", handleScrollEnd, {
        once: true,
      });
      // Fallback timeout in case scrollend doesn't fire
      setTimeout(() => {
        scrollContainer.removeEventListener("scrollend", handleScrollEnd);
        focusElement();
      }, 500);
    } else {
      // Fallback for browsers without scrollend support
      setTimeout(focusElement, 300);
    }
  } else {
    // Instant scroll, focus immediately
    focusElement();
  }
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
  /**
   * Custom handler for scrolling to error fields.
   * If not provided, uses the default scrollToElementAndFocus behavior.
   * @param element - The DOM element to scroll to
   * @param options - Scroll behavior options passed from scrollToFirstError
   */
  onScrollToError?: ScrollToErrorHandler;
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
    onScrollToError,
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
          const handler = onScrollToError ?? scrollToElementAndFocus;
          handler(element, options);
          return true;
        }
        return false;
      },
    }),
    [runtime, domRegistry, onScrollToError],
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
