import {
  AppBar as MuiAppBar,
  Toolbar as MuiToolbar,
  AppBarProps as MuiAppBarProps,
  ToolbarProps as MuiToolbarProps,
} from "@mui/material";
import { forwardRef, ReactNode } from "react";
import { tokens } from "../theme";

export interface AppBarProps extends Omit<
  MuiAppBarProps,
  "position" | "elevation"
> {
  children?: ReactNode;
}

/**
 * App bar component
 * Provides unified top navigation bar style
 */
export const AppBar = forwardRef<HTMLDivElement, AppBarProps>(
  ({ sx, children, ...props }, ref) => {
    return (
      <MuiAppBar
        ref={ref}
        position="static"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: tokens.colors.border.default,
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiAppBar>
    );
  },
);

AppBar.displayName = "AppBar";

export type ToolbarProps = MuiToolbarProps;

/**
 * Toolbar component
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(
  ({ sx, ...props }, ref) => {
    return (
      <MuiToolbar
        ref={ref}
        sx={{
          px: { xs: 2, md: 4 },
          ...sx,
        }}
        {...props}
      />
    );
  },
);

Toolbar.displayName = "Toolbar";

export default AppBar;
