import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface NumberWidgetProps extends WidgetProps {
  value: number | undefined;
  onChange: (value: number) => void;
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
}

/** Number widget extension - handles number type */
export const numberExtension = (
  component: React.ComponentType<NumberWidgetProps>,
) =>
  defineExtension<NumberWidgetProps>("number", component, {
    match: (props) => props.type === "number",
    mapProps: (props, base) => ({
      ...base,
      value: props.value as number | undefined,
      onChange: props.onChange as (value: number) => void,
      minimum: props.schema.minimum,
      exclusiveMinimum: props.schema.exclusiveMinimum,
      maximum: props.schema.maximum,
      exclusiveMaximum: props.schema.exclusiveMaximum,
      multipleOf: props.schema.multipleOf,
    }),
  });
