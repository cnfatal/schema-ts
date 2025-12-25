import { UnknownWidgetProps } from "../SimpleFieldRenderer";

import { textExtension, TextWidgetProps } from "./text";
import { numberExtension, NumberWidgetProps } from "./number";
import { integerExtension, IntegerWidgetProps } from "./integer";
import { selectExtension, SelectWidgetProps } from "./select";
import { switchExtension, SwitchWidgetProps } from "./switch";
import { arrayExtension, ArrayWidgetProps } from "./array";
import { objectExtension, ObjectWidgetProps } from "./object";

export type { TextWidgetProps } from "./text";
export type { NumberWidgetProps } from "./number";
export type { IntegerWidgetProps } from "./integer";
export type { SelectWidgetProps } from "./select";
export type { SwitchWidgetProps } from "./switch";
export type { ArrayWidgetProps, ArrayItemProps } from "./array";
export type { ObjectWidgetProps } from "./object";

export { textExtension } from "./text";
export { numberExtension } from "./number";
export { integerExtension } from "./integer";
export { selectExtension } from "./select";
export { switchExtension } from "./switch";
export { arrayExtension } from "./array";
export { objectExtension } from "./object";

export type BuiltinWidgetsRegistry = {
  text: React.ComponentType<TextWidgetProps>;
  number: React.ComponentType<NumberWidgetProps>;
  integer: React.ComponentType<IntegerWidgetProps>;
  select: React.ComponentType<SelectWidgetProps>;
  switch: React.ComponentType<SwitchWidgetProps>;
  array: React.ComponentType<ArrayWidgetProps>;
  object: React.ComponentType<ObjectWidgetProps>;
  unknown: React.ComponentType<UnknownWidgetProps>;
};

/**
 * Creates the built-in widget extensions.
 * These extensions handle the core widget types: text, number, integer, select, switch, array, object.
 *
 * @returns Array of built-in extensions in priority order
 */
export function createBuiltinExtensions(
  builtinWidgets: BuiltinWidgetsRegistry,
) {
  return [
    // enum come first, object with enum is treated as enum
    selectExtension(builtinWidgets.select),
    // type object is most commonly used
    objectExtension(builtinWidgets.object),
    // type array
    arrayExtension(builtinWidgets.array),
    // type boolean
    switchExtension(builtinWidgets.switch),
    // type number
    numberExtension(builtinWidgets.number),
    // type integer
    integerExtension(builtinWidgets.integer),
    // type string
    textExtension(builtinWidgets.text),
  ];
}
