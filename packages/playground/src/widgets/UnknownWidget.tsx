import { type UnknownWidgetProps } from "@schema-ts/react";
import { Alert, FormField } from "../components";

export function DefaultUnknownWidget({
  schema,
  value,
  registerRef,
}: UnknownWidgetProps) {
  return (
    <FormField ref={registerRef} label="Unknown Widget">
      <Alert severity="warning">Unsupported schema type: {schema.type}</Alert>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </FormField>
  );
}
