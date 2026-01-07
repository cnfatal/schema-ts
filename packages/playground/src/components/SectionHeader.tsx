import { Box, Typography, BoxProps } from "@mui/material";
import { tokens } from "../theme";

export interface SectionHeaderProps extends Omit<BoxProps, "title"> {
  title: string;
  actions?: React.ReactNode;
}

/**
 * Section header component
 * Displays a section title with a decorative bar
 */
export function SectionHeader({
  title,
  actions,
  sx,
  ...props
}: SectionHeaderProps) {
  return (
    <Box
      sx={{
        p: 1,
        px: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: `linear-gradient(to right, rgba(99, 102, 241, 0.02), transparent)`,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        ...sx,
      }}
      {...props}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: "text.secondary",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 4,
            height: 12,
            bgcolor: "primary.main",
            borderRadius: 0.5,
          }}
        />
        {title}
      </Typography>
      {actions && <Box>{actions}</Box>}
    </Box>
  );
}

export default SectionHeader;
