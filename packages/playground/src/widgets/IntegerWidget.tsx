import { type IntegerWidgetProps } from "@schema-ts/react";
import { NumericWidget } from "./NumericWidget";

/** Integer input widget. */
export function DefaultIntegerWidget(props: IntegerWidgetProps) {
  return <NumericWidget {...props} integer />;
}
