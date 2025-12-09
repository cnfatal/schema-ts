import {
  type FieldNode,
  Schema,
  SchemaRuntime,
  Validator,
} from "@schema-ts/core";
import {
  type FC,
  type ReactNode,
  memo,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
} from "react";

export type RenderFormField = (props: FormFieldRenderProps) => ReactNode;

export interface FormFieldRenderProps extends FieldNode {
  runtime: SchemaRuntime;
  onChange: (val: unknown) => void;
}

export interface FormFieldProps {
  runtime: SchemaRuntime;
  path: string;
  render?: RenderFormField;
}

const FormFieldComponent: FC<FormFieldProps> = ({ runtime, path, render }) => {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const unsubscribe = runtime.subscribe(path, () => {
      forceUpdate();
    });
    return unsubscribe;
  }, [runtime, path]);

  const node = runtime.findNode(path);
  if (!node) return null;

  const onChange = (val: unknown) => {
    runtime.setValue(path, val);
  };

  const renderProps: FormFieldRenderProps = {
    ...node,
    runtime,
    onChange,
  };

  if (render) {
    return render(renderProps);
  }

  // Fallback if no render is provided?
  // Ideally Form should assume a default or the user provides one.
  // For now return null or JSON dump.
  return null;
};

export const FormField = memo(FormFieldComponent);

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
  const runtime = useMemo(() => {
    return new SchemaRuntime(validator || new Validator(), schema, value);
  }, [schema, value, validator]);

  // Subscribe to changes to trigger re-renders
  useSyncExternalStore(
    (onStoreChange) => {
      return runtime.subscribe("#", onStoreChange);
    },
    () => runtime.getVersion(),
  );

  useEffect(() => {
    if (onChange) {
      return runtime.subscribe("#", (e) => {
        if (e.type === "value") {
          onChange(runtime.getValue("#"));
        }
      });
    }
    return undefined;
  }, [runtime, onChange]);

  return (
    <FormField
      path={runtime.root.jsonPointer}
      runtime={runtime}
      render={render}
    />
  );
};
