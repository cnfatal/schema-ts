import { BuiltinWidgetsRegistry } from "@schema-ts/react";
import { DefaultTextWidget } from "./TextWidget";
import { DefaultNumberWidget } from "./NumberWidget";
import { DefaultIntegerWidget } from "./IntegerWidget";
import { DefaultSelectWidget } from "./SelectWidget";
import { DefaultSwitchWidget } from "./SwitchWidget";
import { DefaultArrayWidget } from "./ArrayWidget";
import { DefaultObjectWidget } from "./ObjectWidget";
import { DefaultUnknownWidget } from "./UnknownWidget";

export * from "./TextWidget";
export * from "./NumberWidget";
export * from "./IntegerWidget";
export * from "./SelectWidget";
export * from "./SwitchWidget";
export * from "./ArrayWidget";
export * from "./ObjectWidget";
export * from "./UnknownWidget";

export const muiWidgetRegistry: BuiltinWidgetsRegistry = {
  text: DefaultTextWidget,
  number: DefaultNumberWidget,
  integer: DefaultIntegerWidget,
  select: DefaultSelectWidget,
  switch: DefaultSwitchWidget,
  array: DefaultArrayWidget,
  object: DefaultObjectWidget,
  unknown: DefaultUnknownWidget,
};
