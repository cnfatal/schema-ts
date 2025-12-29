import React from "react";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface ArrayItemProps {
  key: string;
  // render the item content, options is passed to the widget
  render: (options?: Record<string, unknown>) => React.ReactNode;
  // when onRemove is not undefined, the item can be removed
  onRemove?: () => void;
}

export interface ArrayWidgetProps extends WidgetProps {
  items: ArrayItemProps[];
  canAdd: boolean;
  onAdd: () => void;
}

/** Array widget extension - handles array types, uses renderChild for items */
export const arrayExtension = (
  component: React.ComponentType<ArrayWidgetProps>,
) =>
  defineExtension<ArrayWidgetProps>("array", component, {
    matcher: (props, base) => {
      if (props.type === "array") {
        const { runtime, instanceLocation } = props;

        const items =
          props.children?.map((child) => {
            return {
              key: child.instanceLocation,
              render: (options?: Record<string, unknown>) =>
                base.renderChild(child.instanceLocation, options),
              onRemove: child.canRemove
                ? () => {
                    runtime.removeValue(child.instanceLocation);
                  }
                : undefined,
            };
          }) || [];

        return {
          ...base,
          items,
          canAdd: props.canAdd,
          onAdd: () => {
            runtime.addValue(instanceLocation);
          },
        };
      }
      return undefined;
    },
  });
