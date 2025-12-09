import { WidgetRegistry } from "@schema-ts/react";
import { DefaultTextWidget } from "./TextWidget";
import { DefaultSelectWidget } from "./SelectWidget";
import { DefaultSwitchWidget } from "./SwitchWidget";
import { DefaultArrayWidget } from "./ArrayWidget";
import { DefaultObjectWidget } from "./ObjectWidget";

export * from "./TextWidget";
export * from "./SelectWidget";
export * from "./SwitchWidget";
export * from "./ArrayWidget";
export * from "./ObjectWidget";

export const muiWidgetRegistry: WidgetRegistry = {
  text: DefaultTextWidget,
  select: DefaultSelectWidget,
  switch: DefaultSwitchWidget,
  array: DefaultArrayWidget,
  object: DefaultObjectWidget,
};
