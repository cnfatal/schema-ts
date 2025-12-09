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
  const handleChange = (val: string) => {
    if (Array.isArray(options)) {
      const index = options.findIndex((opt) => String(opt) === val);
      if (index !== -1) {
        onChange(options[index]);
        return;
      }
    }
    onChange(val);
  };

  return (
    <FormField>
      <SelectField
        label={label}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value={value as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options={options as any}
        onChange={handleChange}
        error={error}
        description={description}
        required={required}
      />
    </FormField>
  );
}
