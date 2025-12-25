import { Output } from "@schema-ts/core";
import { BuiltinWidgetsRegistry, createBuiltinExtensions } from "./extensions";
import { WidgetExtension, SimpleFieldRenderer } from "./SimpleFieldRenderer";

export * from "./Form";
export * from "./hooks";
export * from "./SimpleFieldRenderer";
export * from "./extensions";

export function createSimpleFieldRenderer(
  registry: BuiltinWidgetsRegistry,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensions?: WidgetExtension<any>[],
  mapErrorMessage?: (output?: Output) => string | undefined,
): SimpleFieldRenderer {
  const allextensions = [
    // custom extensions come first
    ...(extensions ?? []),
    // built-in extensions come after
    ...createBuiltinExtensions(registry),
  ];
  return new SimpleFieldRenderer(allextensions, mapErrorMessage);
}
