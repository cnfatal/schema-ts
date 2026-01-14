import React from "react";
import { Schema } from "@schema-ts/core";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";
import { FormFieldRenderProps } from "../FormField";

export interface ObjectPropertyProps {
  key: string;
  schema: Schema;

  // render the property content, options is passed to the widget
  render: (options?: Record<string, unknown>) => React.ReactNode;

  // when onRemove is not undefined, the property can be removed
  onRemove?: () => void;
}

export interface ObjectWidgetProps extends WidgetProps {
  // properties of the object
  properties: ObjectPropertyProps[];

  // if onAddProperty is not undefined, the object can be added
  // widget can call this function to add a new property
  // when value is not undefined, a default value(from schema) will be set
  onAddProperty?: (key: string, value?: unknown) => void;
}

/** Object widget extension - handles object types, uses renderChild for properties */
export const objectExtension = (
  component: React.ComponentType<ObjectWidgetProps>,
) =>
  defineExtension<ObjectWidgetProps>("object", component, {
    matcher: (props: FormFieldRenderProps, base: WidgetProps) => {
      if (props.type === "object") {
        const { runtime, instanceLocation } = props;

        const properties: ObjectPropertyProps[] =
          props.children?.map((child) => {
            const childKey = child.instanceLocation.split("/").pop() || "";

            const onRemove = child.canRemove
              ? () => {
                  runtime.removeValue(child.instanceLocation);
                }
              : undefined;

            const renderChild = (options?: Record<string, unknown>) =>
              base.renderChild(child.instanceLocation, options);

            return {
              key: childKey,
              schema: child.schema,
              render: renderChild,
              onRemove,
            };
          }) || [];

        const onAddProperty = props.canAdd
          ? (key: string, value?: unknown) => {
              runtime.addChild(instanceLocation, key, value);
            }
          : undefined;

        return {
          ...base,
          properties,
          onAddProperty,
        };
      }
      return undefined;
    },
  });
