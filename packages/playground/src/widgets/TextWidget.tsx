import { type TextWidgetProps } from "@schema-ts/react";
import { FormField, TextField } from "../components";
import { useDebouncedInput } from "../hooks/useDebouncedInput";

/**
 * Text Input Widget
 */
export function DefaultTextWidget({
  label,
  value,
  disabled,
  onChange,
  error,
  description,
  required,
}: TextWidgetProps) {
  const externalValue =
    value !== undefined && value !== null ? String(value) : "";

  const [internalValue, handleChange] = useDebouncedInput(
    externalValue,
    onChange,
  );

  return (
    <FormField>
      <TextField
        label={label}
        type="text"
        disabled={disabled}
        value={internalValue}
        onChange={(e) => handleChange(e.target.value)}
        error={!!error}
        helperText={error || description}
        required={required}
      />
    </FormField>
  );
}
