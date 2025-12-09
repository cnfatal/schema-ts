import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface SelectWidgetProps extends WidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  options: unknown[];
}

/** Select widget extension - handles enum types */
export const selectExtension = defineExtension<SelectWidgetProps>(
  "select",
  (() => null) as React.ComponentType<SelectWidgetProps>,
  {
    match: (props) => Array.isArray(props.schema.enum),
    mapProps: (props, base) => ({
      ...base,
      value: props.value,
      onChange: props.onChange,
      options: props.schema.enum || [],
    }),
  },
);
