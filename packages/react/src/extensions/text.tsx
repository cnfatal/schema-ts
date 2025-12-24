import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface TextWidgetProps extends WidgetProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

/** Text widget extension - handles string type */
export const textExtension = (
  component: React.ComponentType<TextWidgetProps>,
) =>
  defineExtension<TextWidgetProps>("text", component, {
    match: (props) => props.type === "string",
    mapProps: (props, base) => ({
      ...base,
      value: props.value as string | undefined,
      onChange: props.onChange as (value: string) => void,
    }),
  });
