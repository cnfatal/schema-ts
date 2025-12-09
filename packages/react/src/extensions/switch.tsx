import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface SwitchWidgetProps extends WidgetProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

/** Switch widget extension - handles boolean types */
export const switchExtension = defineExtension<SwitchWidgetProps>(
  "switch",
  (() => null) as React.ComponentType<SwitchWidgetProps>,
  {
    match: (props) => props.type === "boolean",
    mapProps: (props, base) => ({
      ...base,
      value: !!props.value,
      onChange: props.onChange,
    }),
  },
);
