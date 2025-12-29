import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface SwitchWidgetProps extends WidgetProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Switch widget extension - handles boolean types */
export const switchExtension = (
  component: React.ComponentType<SwitchWidgetProps>,
) =>
  defineExtension<SwitchWidgetProps>("switch", component, {
    matcher: (props, base) => {
      if (props.type === "boolean") {
        return {
          ...base,
          value: !!props.value,
          onChange: props.onChange,
        };
      }
      return undefined;
    },
  });
