import { type SwitchWidgetProps } from "@schema-ts/react";
import { SwitchField } from "../components";

/**
 * Switch Widget
 * Uses public SwitchField component, no extra style code
 */
export function DefaultSwitchWidget({
  label,
  value,
  onChange,
  error,
  registerRef,
  description,
  required,
}: SwitchWidgetProps) {
  return (
    <SwitchField
      ref={registerRef}
      label={label}
      checked={!!value}
      onChange={onChange}
      error={error}
      description={description}
      required={required}
    />
  );
}
