import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface SelectWidgetProps extends WidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  options: unknown[];
}

/** Select widget extension - handles enum types */
export const selectExtension = (
  component: React.ComponentType<SelectWidgetProps>,
) =>
  defineExtension<SelectWidgetProps>("select", component, {
    matcher: (props, base) => {
      if (Array.isArray(props.schema.enum)) {
        return {
          ...base,
          value: props.value,
          onChange: props.onChange,
          options: props.schema.enum || [],
        };
      }
      return undefined;
    },
  });
