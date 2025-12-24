import React from "react";
import { defineExtension, WidgetProps } from "../SimpleFieldRenderer";

export interface ObjectWidgetProps extends WidgetProps {
  children: React.ReactNode;
}

/** Object widget extension - handles object types, uses renderChild for properties */
export const objectExtension = (
  component: React.ComponentType<ObjectWidgetProps>,
) =>
  defineExtension<ObjectWidgetProps>("object", component, {
    match: (props) => props.type === "object",
    mapProps: (props, base) => {
      const children =
        props.children?.map((child) => base.renderChild(child)) || [];

      return {
        ...base,
        children,
      };
    },
  });
