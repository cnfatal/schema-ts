import { WidgetExtension } from "../SimpleFieldRenderer";

import { textExtension } from "./text";
import { selectExtension } from "./select";
import { switchExtension } from "./switch";
import { arrayExtension } from "./array";
import { objectExtension } from "./object";

export type { TextWidgetProps } from "./text";
export type { SelectWidgetProps } from "./select";
export type { SwitchWidgetProps } from "./switch";
export type { ArrayWidgetProps, ArrayItemProps } from "./array";
export type { ObjectWidgetProps } from "./object";

export { textExtension } from "./text";
export { selectExtension } from "./select";
export { switchExtension } from "./switch";
export { arrayExtension } from "./array";
export { objectExtension } from "./object";

/**
 * Creates the built-in widget extensions.
 * These extensions handle the core widget types: text, select, switch, array, object.
 *
 * @returns Array of built-in extensions in priority order
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const builtinExtensions: WidgetExtension<any>[] = [
  selectExtension,
  switchExtension,
  textExtension,
  arrayExtension,
  objectExtension,
];
