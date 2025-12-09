import { ReactNode } from "react";
import { CssBaseline as MuiCssBaseline } from "@mui/material";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { theme as defaultTheme } from "../theme";

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Theme provider component
 * Uses default theme, automatically applies CssBaseline
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MuiThemeProvider theme={defaultTheme}>
      <MuiCssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default ThemeProvider;
