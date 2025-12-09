import { Box as MuiBox, BoxProps as MuiBoxProps } from "@mui/material";
import { forwardRef } from "react";

export type BoxProps = MuiBoxProps;

/**
 * Base Box component
 * Used for layout and style container
 * Directly re-exports MUI Box, preserving its native ref handling
 */
export const Box = MuiBox;

export interface FlexProps extends BoxProps {
  /**
   * Main axis direction
   */
  direction?: "row" | "column";
  /**
   * Child element spacing
   */
  gap?: number | string;
  /**
   * Main axis alignment
   */
  justify?: MuiBoxProps["justifyContent"];
  /**
   * Cross axis alignment
   */
  align?: MuiBoxProps["alignItems"];
}

/**
 * Flex layout component
 */
export const Flex = forwardRef<HTMLElement, FlexProps>(
  ({ direction = "row", gap, justify, align, sx, ...props }, ref) => {
    return (
      <MuiBox
        ref={ref}
        sx={{
          display: "flex",
          flexDirection: direction,
          gap,
          justifyContent: justify,
          alignItems: align,
          ...sx,
        }}
        {...props}
      />
    );
  },
);

Flex.displayName = "Flex";

export type CenterProps = BoxProps;

/**
 * Centered container component
 */
export const Center = forwardRef<HTMLElement, CenterProps>(
  ({ sx, ...props }, ref) => {
    return (
      <MuiBox
        ref={ref}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          ...sx,
        }}
        {...props}
      />
    );
  },
);

Center.displayName = "Center";

export default Box;
