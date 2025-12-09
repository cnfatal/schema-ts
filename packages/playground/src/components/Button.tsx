import {
  Button as MuiButton,
  ButtonProps as MuiButtonProps,
} from "@mui/material";
import { forwardRef } from "react";

export interface ButtonProps extends Omit<MuiButtonProps, "variant"> {
  variant?: MuiButtonProps["variant"] | "soft";
}

/**
 * Public Button component
 * Wraps MUI Button, providing unified default styles and extended variants
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "contained", ...props }, ref) => {
    return (
      <MuiButton
        ref={ref}
        variant={variant as MuiButtonProps["variant"]}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export default Button;
