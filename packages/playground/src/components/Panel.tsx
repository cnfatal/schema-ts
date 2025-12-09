import { Paper, PaperProps, Box, BoxProps } from "@mui/material";

export type PanelContainerProps = Omit<PaperProps, "variant">;

/**
 * Panel container component
 * Wraps panel content, providing unified border and layout
 */
export function PanelContainer({
  sx,
  children,
  ...props
}: PanelContainerProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

export type PanelSectionProps = BoxProps;

/**
 * Panel section component
 * Used to divide different content areas within a panel
 */
export function PanelSection({ sx, children, ...props }: PanelSectionProps) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

export type EditorContainerProps = BoxProps;

/**
 * Editor container component
 * Wraps code editor, providing unified padding and overflow handling
 */
export function EditorContainer({
  sx,
  children,
  ...props
}: EditorContainerProps) {
  return (
    <Box
      sx={{ flexGrow: 1, p: 2, pt: 0, overflow: "hidden", ...sx }}
      {...props}
    >
      <Box
        sx={{
          height: "100%",
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default PanelContainer;
