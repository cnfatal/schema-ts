import { type UnknownWidgetProps } from "@schema-ts/react";
import { Field } from "@/components/field";

export function DefaultUnknownWidget({
  schema,
  value,
  fieldRef,
  label,
  description,
  instanceLocation,
}: UnknownWidgetProps) {
  return (
    <div
      ref={(element) => fieldRef?.(element)}
      data-field-path={instanceLocation}
    >
      <Field
        label={label ?? "Unknown field"}
        description={
          description ?? `Unsupported schema type: ${String(schema.type)}`
        }
      >
        <pre className="overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </Field>
    </div>
  );
}
