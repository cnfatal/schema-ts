import { type NumberWidgetProps } from "@schema-ts/react";
import { NumericWidget } from "./NumericWidget";

/** Number input widget. */
export function DefaultNumberWidget(props: NumberWidgetProps) {
  return <NumericWidget {...props} integer={false} />;
}
