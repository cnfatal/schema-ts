import React from "react";
import { Schema, type FieldNode, type Output } from "@schema-ts/core";
import { FormField, FormFieldRenderProps } from "./Form";

/** Schema-agnostic base props for all widgets */

export interface WidgetProps {
  // also the title
  label: string;
  description?: string;
  example?: unknown;
  required?: boolean;
  disabled?: boolean;
  error?: string;

  // the schema for the field being rendered
  schema: Schema;

  // WidgetRegistry to components reuse
  registry: WidgetRegistry;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (value: any) => void;

  renderChild: (child: FieldNode) => React.ReactNode;

  // Additional props specific to widget implementations
  [key: string]: unknown;
}

export type UnknownWidgetProps = WidgetProps & {
  value: unknown;
  onChange: (value: unknown) => void;
};

export type WidgetType = string;

export type WidgetTypeProps = [WidgetType, WidgetProps];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WidgetRegistry = Record<WidgetType, React.ComponentType<any>>;

export interface WidgetExtension<T> {
  /** Unique identifier for the extension, used as the key in the widget registry */
  type: string;
  /** React component used to render the field for this extension */
  component: React.ComponentType<T>;

  /** Function to determine if this extension matches given FormFieldRenderProps */
  match?: (props: FormFieldRenderProps) => boolean;
  /** Function to map FormFieldRenderProps to the specific WidgetProps for this extension */
  mapProps?: (props: FormFieldRenderProps, base: WidgetProps) => T;
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
    match: options.match,
    mapProps: options.mapProps,
  };
}

export class SimpleFieldRenderer {
  private registry: WidgetRegistry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extensions: WidgetExtension<any>[];
  private mapErrorMessage: (output?: Output) => string | undefined;

  /**
   * Creates a new SimpleFieldRenderer.
   *
   * @param registry - Base widget registry mapping widget types to components
   * @param extensions - Array of WidgetExtension objects for custom schema handling.
   *                     Custom extensions are checked before built-in ones.
   */

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extensions?: WidgetExtension<any>[],
    mapErrorMessage?: (output?: Output) => string | undefined,
  ) {
    this.registry = {};
    this.extensions = extensions || [];
    // register all extensions' components
    for (const ext of this.extensions) {
      this.registry[ext.type] = ext.component;
    }
    this.mapErrorMessage = mapErrorMessage || extractErrorMessage;
  }

  /**
   * Resolves the widget type and its corresponding props from FormFieldRenderProps.
   * Iterates through all extensions (custom first, then built-in) to find a match.
   */
  private resolveWidget = (props: FormFieldRenderProps): WidgetTypeProps => {
    const { schema, runtime } = props;
    const widgetProps: WidgetProps = {
      label: schema.title || props.instanceLocation.split("/").pop() || "",
      description: schema.description,
      example: schema.examples?.[0],
      disabled: !!schema.readOnly,
      error: this.mapErrorMessage(props.error),
      schema,
      registry: this.registry,
      renderChild: (child: FieldNode): React.ReactNode => (
        <FormField
          key={child.instanceLocation}
          path={child.instanceLocation}
          runtime={runtime}
          render={this.render}
        />
      ),
      value: props.value,
      onChange: props.onChange,
    };

    for (const ext of this.extensions) {
      if (ext.match?.(props)) {
        return [
          ext.type,
          ext.mapProps ? ext.mapProps(props, widgetProps) : widgetProps,
        ];
      }
    }
    return ["unknown", widgetProps as UnknownWidgetProps];
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

function extractErrorMessage(output?: Output): string | undefined {
  if (!output || output.valid) return undefined;
  if (output.errors && output.errors.length > 0) {
    return extractErrorMessage(output.errors[0]);
  }
  if (output.error) return output.error;
  return undefined;
}
