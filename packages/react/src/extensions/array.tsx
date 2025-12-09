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
export const arrayExtension = defineExtension<ArrayWidgetProps>(
  "array",
  (() => null) as React.ComponentType<ArrayWidgetProps>,
  {
    match: (props) => props.type === "array",
    mapProps: (props, base) => {
      const items =
        props.children?.map((child, index) => ({
          key: child.jsonPointer,
          content: base.renderChild(child),
          onRemove: () => {
            const newValue = [...((props.value as unknown[]) || [])];
            newValue.splice(index, 1);
            props.runtime.setValue(props.jsonPointer, newValue);
          },
        })) || [];

      return {
        ...base,
        items,
        onAdd: () => {
          const newValue = [...((props.value as unknown[]) || []), undefined];
          props.runtime.setValue(props.jsonPointer, newValue);
        },
      };
    },
  },
);
