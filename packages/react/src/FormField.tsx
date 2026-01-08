import {
  type SchemaChangeEvent,
  SchemaRuntime,
  type FieldNode,
} from "@schema-ts/core";
import {
  type ReactNode,
  type RefCallback,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { type FormMode, useFormContext } from "./FormContext";

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
