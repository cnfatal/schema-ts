import {
  Box,
  BoxProps,
  Divider as MuiDivider,
  DividerProps,
} from "@mui/material";

export type DecoratedDividerProps = BoxProps;

/**
 * Decorative divider
 * Divider with a center dot decoration
 */
export function DecoratedDivider({ sx, ...props }: DecoratedDividerProps) {
  return (
    <Box sx={{ p: 1, display: "flex", alignItems: "center", ...sx }} {...props}>
      <MuiDivider sx={{ flexGrow: 1, opacity: 0.5 }} />
      <Box
        sx={{
          mx: 2,
          width: 4,
          height: 4,
          borderRadius: "50%",
          bgcolor: "divider",
        }}
      />
      <MuiDivider sx={{ flexGrow: 1, opacity: 0.5 }} />
    </Box>
  );
}

export { MuiDivider as Divider };
export type { DividerProps };
export default DecoratedDivider;
