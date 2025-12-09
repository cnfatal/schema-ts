import {
  Typography as MuiTypography,
  TypographyProps as MuiTypographyProps,
} from "@mui/material";
import { forwardRef } from "react";

export type TextProps = MuiTypographyProps;

/**
 * Text component
 */
export const Text = forwardRef<HTMLSpanElement, TextProps>((props, ref) => {
  return <MuiTypography ref={ref} {...props} />;
});

Text.displayName = "Text";

export interface HeadingProps extends Omit<MuiTypographyProps, "variant"> {
  /**
   * Heading level
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Heading component
 */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 1, ...props }, ref) => {
    const variant = `h${level}` as MuiTypographyProps["variant"];
    return <MuiTypography ref={ref} variant={variant} {...props} />;
  },
);

Heading.displayName = "Heading";

export default Text;
