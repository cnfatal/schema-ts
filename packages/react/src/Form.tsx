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
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

export type FormMode = "create" | "edit";

export interface FormFieldRenderProps extends FieldNode {
  value: unknown;
  onChange: (val: unknown) => void;
  runtime: SchemaRuntime;
  mode?: FormMode;
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

  const renderProps = useMemo(
    () =>
      node
        ? ({
            ...node,
            value: runtime.getValue(path),
            runtime,
            onChange,
            version,
            ...props,
          } as FormFieldRenderProps)
        : null,
    [node, version, runtime, onChange, path, props],
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
  [key: string]: unknown;
};

export const Form: FC<FormProps> = ({
  schema,
  value,
  onChange,
  validator,
  render,
  runtimeOptions,
  ...props
}: FormProps) => {
  // Capture initial value only once at mount
  const [initialValue] = useState(() => value);

  const runtime = useMemo(
    () =>
      new SchemaRuntime(
        validator || new Validator(),
        schema,
        initialValue,
        runtimeOptions,
      ),
    [schema, validator, initialValue, runtimeOptions],
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

  return <FormField path={"#"} runtime={runtime} render={render} {...props} />;
};
