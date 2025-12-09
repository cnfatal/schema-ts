import { type ObjectWidgetProps } from "@schema-ts/react";
import { FieldGroup } from "../components";

/**
 * Object Widget
 * Uses public FieldGroup component, no extra style code
 */
export function DefaultObjectWidget({
  label,
  description,
  required,
  error,
  children,
}: ObjectWidgetProps) {
  return (
    <FieldGroup
      label={label}
      description={description}
      required={required}
      error={error}
    >
      {children}
    </FieldGroup>
  );
}
