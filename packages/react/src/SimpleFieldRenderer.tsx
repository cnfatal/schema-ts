import React from "react";
import { Schema, type Output } from "@schema-ts/core";
import { FormField, FormFieldRenderProps } from "./Form";
import { FormMode } from "./FormContext";

/**
 * Determines if a field should be disabled based on schema and form mode.
 *
 * Rules:
 * - `readOnly: true` → always disabled
 * - `const` is defined → always disabled (value is fixed)
 * - `writeOnly: true` + edit mode → disabled (can only set on create)
 *
 * @param schema - The field's schema
 * @param mode - Form mode: 'create' or 'edit'
 * @returns true if the field should be disabled
 */
export function isFieldDisabled(schema: Schema, mode?: FormMode): boolean {
  if (schema.readOnly) return true;
  if (schema.const !== undefined) return true;
  if (schema.writeOnly && mode === "edit") return true;
  return false;
}

/** Schema-agnostic base props for all widgets */

export interface WidgetProps {
  // also the title
  label: string;
  description?: string;
  example?: unknown;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  mode?: FormMode;
  /**
   * Ref callback to register the field's DOM element for scrolling to errors.
   */
  registerRef: (element: HTMLElement | null) => void;

  // the schema for the field being rendered
  instanceLocation: string;
  schema: Schema;

  // default value from schema
  defaultValue?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (value: any) => void;

  // render child field
  renderChild: RenderChild;

  [key: string]: unknown;
}

export type RenderChild = (
  path: string,
  options?: Record<string, unknown>,
) => React.ReactNode;

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
  matcher: (props: FormFieldRenderProps, base: WidgetProps) => T | undefined;
}

/**
 * Helper function to create a type-safe widget extension.
 * This simplifies extension creation by separating match logic from props mapping.
 *
 * @example
 * ```typescript
 * const MyExtension = defineExtension("mywidget", MyWidget, {
 *   matcher: (props, base) => {
 *     if (!props.schema["x-custom"]) return undefined;
 *     return {
 *       ...base,
 *       customProp: props.schema["x-custom"],
 *     };
 *   },
 * });
 * ```
 */
export function defineExtension<T extends WidgetProps>(
  type: string,
  component: React.ComponentType<T>,
  options: {
    matcher: (props: FormFieldRenderProps, base: WidgetProps) => T | undefined;
  },
): WidgetExtension<T> {
  return {
    type,
    component,
    matcher: options.matcher,
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
    const {
      schema,
      runtime,
      value,
      error,
      onChange,
      instanceLocation,
      mode,
      ...otherProps
    } = props;
    const widgetProps: WidgetProps = {
      label: schema.title || instanceLocation.split("/").pop() || "",
      description: schema.description,
      example: schema.examples?.[0],
      disabled: isFieldDisabled(schema, mode),
      error: this.mapErrorMessage(error),
      mode,
      instanceLocation,
      schema,
      renderChild: (
        path: string,
        options?: Record<string, unknown>,
      ): React.ReactNode => {
        return (
          <FormField
            key={path}
            path={path}
            runtime={runtime}
            render={this.render}
            {...options}
          />
        );
      },
      value,
      defaultValue: schema.default ?? schema.const,
      onChange,
      ...otherProps,
    };

    for (const ext of this.extensions) {
      const result = ext.matcher(props, widgetProps);
      if (result) {
        return [ext.type, result];
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
