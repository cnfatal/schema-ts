import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface TextWidgetProps extends WidgetProps {
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  type: "text" | "number" | "integer";
}

/** Text widget extension - handles string, number, integer types */
export const textExtension = defineExtension<TextWidgetProps>(
  "text",
  // Placeholder component - actual component is provided by registry
  (() => null) as React.ComponentType<TextWidgetProps>,
  {
    match: (props) =>
      props.type === "string" ||
      props.type === "number" ||
      props.type === "integer",
    mapProps: (props, base) => ({
      ...base,
      value: props.value as string | number | undefined,
      onChange: props.onChange,
      type: props.type as "text" | "number" | "integer",
    }),
  },
);
