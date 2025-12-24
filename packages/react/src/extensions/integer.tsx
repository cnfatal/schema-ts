import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface IntegerWidgetProps extends WidgetProps {
  value: number | undefined;
  onChange: (value: number) => void;
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
}

/** Integer widget extension - handles integer type */
export const integerExtension = (
  component: React.ComponentType<IntegerWidgetProps>,
) =>
  defineExtension<IntegerWidgetProps>("integer", component, {
    match: (props) => props.type === "integer",
    mapProps: (props, base) => ({
      ...base,
      value: props.value as number | undefined,
      onChange: props.onChange as (value: number) => void,
      minimum: props.schema.minimum,
      maximum: props.schema.maximum,
      multipleOf: props.schema.multipleOf || 1,
      exclusiveMinimum: props.schema.exclusiveMinimum,
      exclusiveMaximum: props.schema.exclusiveMaximum,
    }),
  });
