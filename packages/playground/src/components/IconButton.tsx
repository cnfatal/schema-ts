import {
  IconButton as MuiIconButton,
  IconButtonProps as MuiIconButtonProps,
} from "@mui/material";
import { forwardRef } from "react";

export interface IconButtonProps extends MuiIconButtonProps {
  /**
   * Preset color variants
   */
  colorVariant?: "default" | "danger";
}

/**
 * Public IconButton component
 * Wraps MUI IconButton, providing preset color variants
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ colorVariant = "default", sx, ...props }, ref) => {
    const variantStyles =
      colorVariant === "danger"
        ? {
            color: "text.disabled",
            "&:hover": { color: "error.main", bgcolor: "error.lighter" },
          }
        : {};

    return (
      <MuiIconButton
        ref={ref}
        sx={{
          ...variantStyles,
          ...sx,
        }}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";

export default IconButton;
