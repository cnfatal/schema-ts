import { createTheme, alpha } from "@mui/material";

// Design tokens - used to manage design variables like colors and spacing
export const tokens = {
  colors: {
    primary: {
      main: "#6366f1", // Modern indigo
      light: "#818cf8",
      dark: "#4f46e5",
    },
    background: {
      default: "#f8fafc", // Very light grey-blue
      paper: "#ffffff",
      subtle: "rgba(0, 0, 0, 0.01)",
      subtleHover: "rgba(0, 0, 0, 0.02)",
    },
    text: {
      primary: "#1e293b",
      secondary: "#64748b",
    },
    border: {
      default: "rgba(0, 0, 0, 0.06)",
      subtle: "rgba(0, 0, 0, 0.03)",
      primaryLight: "rgba(99, 102, 241, 0.1)",
    },
  },
  spacing: {
    xs: 0.5, // 4px
    sm: 1, // 8px
    md: 2, // 16px
    lg: 3, // 24px
    xl: 4, // 32px
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
} as const;

// Create MUI theme
export const theme = createTheme({
  palette: {
    primary: tokens.colors.primary,
    background: tokens.colors.background,
    text: tokens.colors.text,
    divider: "rgba(0, 0, 0, 0.05)",
  },
  shape: {
    borderRadius: tokens.borderRadius.md,
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "-apple-system", "sans-serif"',
    h6: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    subtitle2: {
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontSize: "0.75rem",
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        outlined: {
          borderColor: tokens.colors.border.default,
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: tokens.borderRadius.md,
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        sizeSmall: {
          padding: "6px 16px",
          fontSize: "0.8125rem",
        },
      },
      variants: [
        {
          props: { variant: "soft" as never },
          style: {
            backgroundColor: alpha(tokens.colors.primary.main, 0.08),
            color: tokens.colors.primary.main,
            "&:hover": {
              backgroundColor: alpha(tokens.colors.primary.main, 0.15),
            },
          },
        },
      ],
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.md,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: tokens.borderRadius.sm,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: tokens.borderRadius.sm,
          },
        },
      },
    },
  },
});

// Extend MUI types to support custom variants
declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    soft: true;
  }
}

export default theme;
