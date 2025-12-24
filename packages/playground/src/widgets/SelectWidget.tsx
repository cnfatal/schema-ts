import { type SelectWidgetProps } from "@schema-ts/react";
import { FormField, SelectField } from "../components";

/**
 * Dropdown Select Widget
 * Uses public SelectField component, no extra style code
 */
export function DefaultSelectWidget({
  label,
  value,
  onChange,
  options,
  error,
  description,
  required,
}: SelectWidgetProps) {
  return (
    <FormField>
      <SelectField
        label={label}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value={value as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options={options as any}
        onChange={onChange}
        error={error}
        description={description}
        required={required}
      />
    </FormField>
  );
}
