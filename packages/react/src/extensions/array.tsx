import React from "react";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface ArrayItemProps {
  key: string;
  content: React.ReactNode;
  onRemove: () => void;
}

export interface ArrayWidgetProps extends WidgetProps {
  items: ArrayItemProps[];
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

      // Helper to get fresh array value at execution time (avoids stale closures)
      const getCurrentArray = (): unknown[] =>
        (runtime.getValue(instanceLocation) as unknown[]) || [];
      const items =
        props.children?.map((child, index) => {
          return {
            key: child.instanceLocation,
            content: base.renderChild(child),
            onRemove: () => {
              const newValue = [...getCurrentArray()];
              newValue.splice(index, 1);
              runtime.setValue(instanceLocation, newValue);
            },
          };
        }) || [];

      return {
        ...base,
        items,
        onAdd: () => {
          runtime.setValue(instanceLocation, [...getCurrentArray(), undefined]);
        },
      };
    },
  });
