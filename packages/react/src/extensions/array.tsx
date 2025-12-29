import React from "react";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface ArrayItemProps {
  key: string;
  content: React.ReactNode;
  canRemove: boolean;
  onRemove: () => void;
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
    match: (props) => props.type === "array",
    mapProps: (props, base) => {
      const { runtime, instanceLocation } = props;

      const items =
        props.children?.map((child) => {
          return {
            key: child.instanceLocation,
            content: base.renderChild(child),
            canRemove: child.canRemove,
            onRemove: () => {
              runtime.removeValue(child.instanceLocation);
            },
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
    },
  });
