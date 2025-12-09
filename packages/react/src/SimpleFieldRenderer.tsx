import React from "react";
import { Schema, type FieldNode, type Output } from "@schema-ts/core";
import { FormField, FormFieldRenderProps } from "./Form";
import { builtinExtensions } from "./extensions";

export type {
  TextWidgetProps,
  SelectWidgetProps,
  SwitchWidgetProps,
  ArrayWidgetProps,
  ArrayItemProps,
  ObjectWidgetProps,
} from "./extensions";

/** Schema-agnostic base props for all widgets */

export interface WidgetProps {
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  schema: Schema;
  registry: WidgetRegistry;
  renderChild: (child: FieldNode) => React.ReactNode;
  [key: string]: unknown;
}

export type WidgetType = string;

export type WidgetTypeProps = [WidgetType, WidgetProps];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WidgetRegistry = Record<WidgetType, React.ComponentType<any>>;

export type WidgetTypePropsParser = (
  props: FormFieldRenderProps,
  baseProps: WidgetProps,
) => WidgetTypeProps | null;

/**
 * A unified extension object that bundles together:
 * - type: the widget type identifier
 * - component: the React component to render
 * - parse: the parser function that determines if this extension applies
 */
export interface WidgetExtension<T> {
  type: string;
  component: React.ComponentType<T>;
  parse: WidgetTypePropsParser;
}

/**
 * Helper function to create a type-safe widget extension.
 * This simplifies extension creation by separating match logic from props mapping.
 *
 * @example
 * ```typescript
 * const MyExtension = defineExtension("mywidget", MyWidget, {
 *   match: (props) => !!props.schema["x-custom"],
 *   mapProps: (props, base) => ({
 *     ...base,
 *     customProp: props.schema["x-custom"],
 *   }),
 * });
 * ```
 */
export function defineExtension<T extends WidgetProps>(
  type: string,
  component: React.ComponentType<T>,
  options: {
    match: (props: FormFieldRenderProps) => boolean;
    mapProps: (props: FormFieldRenderProps, base: WidgetProps) => T;
  },
): WidgetExtension<T> {
  return {
    type,
    component,
    parse: (props: FormFieldRenderProps, base: WidgetProps) => {
      if (!options.match(props)) return null;
      return [type, options.mapProps(props, base)];
    },
  };
}

export class SimpleFieldRenderer {
  private registry: WidgetRegistry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extensions: WidgetExtension<any>[];

  /**
   * Creates a new SimpleFieldRenderer.
   *
   * @param registry - Base widget registry mapping widget types to components
   * @param extensions - Array of WidgetExtension objects for custom schema handling.
   *                     Custom extensions are checked before built-in ones.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(registry: WidgetRegistry, extensions?: WidgetExtension<any>[]) {
    this.extensions = [...builtinExtensions, ...(extensions ?? [])];
    this.registry = { ...registry };
    for (const ext of extensions ?? []) {
      this.registry[ext.type] = ext.component;
    }
  }

  /**
   * Resolves the widget type and its corresponding props from FormFieldRenderProps.
   * Iterates through all extensions (custom first, then built-in) to find a match.
   */
  private resolveWidget = (props: FormFieldRenderProps): WidgetTypeProps => {
    const baseProps = parseBaseWidgetProps(props, this.registry, this.render);

    for (const ext of this.extensions) {
      const widgetTypeProps = ext.parse(props, baseProps);
      if (widgetTypeProps) {
        return widgetTypeProps;
      }
    }
    return [
      "unknown",
      {
        ...baseProps,
        value: props.value,
        onChange: props.onChange,
      } as WidgetProps,
    ];
  };

  /**
   * Main render function - resolves widget and renders the appropriate component from registry
   */
  render = (props: FormFieldRenderProps): React.ReactNode => {
    const [type, widgetProps] = this.resolveWidget(props);
    const Component = this.registry[type];
    if (!Component) {
      console.warn(`No widget found for type "${type}"`);
      return null;
    }
    return <Component {...widgetProps} />;
  };
}

const parseBaseWidgetProps = (
  props: FormFieldRenderProps,
  registry: WidgetRegistry,
  render: (props: FormFieldRenderProps) => React.ReactNode,
): WidgetProps => {
  const { schema, runtime } = props;
  const label = schema.title || props.jsonPointer.split("/").pop() || "";
  const disabled = !!schema.readOnly;

  const renderChild = (child: FieldNode): React.ReactNode => (
    <FormField
      key={child.jsonPointer}
      path={child.jsonPointer}
      runtime={runtime}
      render={render}
    />
  );

  return {
    label,
    description: schema.description,
    disabled,
    error: extractErrorMessage(props.error),
    schema,
    registry,
    renderChild,
  };
};

function extractErrorMessage(output?: Output): string | undefined {
  if (!output || output.valid) return undefined;
  if (output.errors && output.errors.length > 0) {
    return extractErrorMessage(output.errors[0]);
  }
  if (output.error) return output.error;
  return undefined;
}
