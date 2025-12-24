import {
  type FieldNode,
  Schema,
  type SchemaChangeEvent,
  SchemaRuntime,
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

export type RenderFormField = (props: FormFieldRenderProps) => ReactNode;

export interface FormFieldRenderProps extends FieldNode {
  value: unknown;
  runtime: SchemaRuntime;
  onChange: (val: unknown) => void;
}

export interface FormFieldProps {
  runtime: SchemaRuntime;
  path: string;
  render?: RenderFormField;
}

export function FormField({ runtime, path, render }: FormFieldProps) {
  // Get node reference once - node reference is stable across updates
  const node = useMemo(() => runtime.findNode(path), [runtime, path]);

  // Stable subscribe callback
  const subscribe = useCallback(
    (onStoreChange: () => void) => runtime.subscribe(path, onStoreChange),
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
          } as FormFieldRenderProps)
        : null,
    [node, version, runtime, onChange, path],
  );

  if (!renderProps) return null;

  return render?.(renderProps) ?? null;
}

type FormProps = {
  schema: Schema;
  value?: unknown;
  onChange?: (value: unknown) => void;
  validator?: Validator;
  render?: RenderFormField;
};

export const Form: FC<FormProps> = ({
  schema,
  value,
  onChange,
  validator,
  render,
}) => {
  // Capture initial value only once at mount
  const [initialValue] = useState(() => value);

  const runtime = useMemo(
    () => new SchemaRuntime(validator || new Validator(), schema, initialValue),
    [schema, validator, initialValue],
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

  return <FormField path={"#"} runtime={runtime} render={render} />;
};
