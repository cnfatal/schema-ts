import React from "react";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface ObjectPropertyProps {
  key: string;
  canRemove: boolean;
  content: React.ReactNode;
  onRemove: () => void;
}

export interface ObjectWidgetProps extends WidgetProps {
  properties: ObjectPropertyProps[];
  canAddProperty: boolean;
  onAddProperty: (key: string) => void;
}

/** Object widget extension - handles object types, uses renderChild for properties */
export const objectExtension = (
  component: React.ComponentType<ObjectWidgetProps>,
) =>
  defineExtension<ObjectWidgetProps>("object", component, {
    match: (props) => props.type === "object",
    mapProps: (props, base) => {
      const { runtime, instanceLocation } = props;

      const properties: ObjectPropertyProps[] =
        props.children?.map((child) => {
          const childKey = child.instanceLocation.split("/").pop() || "";

          return {
            key: childKey,
            canRemove: child.canRemove,
            content: base.renderChild(child),
            onRemove: () => {
              runtime.removeValue(child.instanceLocation);
            },
          };
        }) || [];

      return {
        ...base,
        properties,
        canAddProperty: props.canAdd,
        onAddProperty: (key: string) => {
          runtime.addValue(instanceLocation, key);
        },
      };
    },
  });
