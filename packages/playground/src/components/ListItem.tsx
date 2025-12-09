import { forwardRef } from "react";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { tokens } from "../theme";
import { Box, BoxProps } from "./Box";
import { Text } from "./Text";
import { IconButton } from "./IconButton";

export interface ListItemProps extends BoxProps {
  /**
   * Item index (used for sequence number)
   */
  index?: number;
  /**
   * Whether to show the delete button
   */
  showDelete?: boolean;
  /**
   * Delete callback
   */
  onDelete?: () => void;
}

/**
 * List item component
 * Used for each element in the Array widget, providing a unified card style and delete button
 */
export const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
  ({ index, showDelete = true, onDelete, children, sx, ...props }, ref) => {
    return (
      <Box
        ref={ref}
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: tokens.colors.border.default,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          "& .MuiOutlinedInput-root": {
            bgcolor: "transparent",
          },
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.08)",
            borderColor: "primary.light",
          },
          ...sx,
        }}
        {...props}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          {index !== undefined && (
            <Text
              variant="caption"
              sx={{
                flexGrow: 1,
                fontWeight: 800,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "0.65rem",
                opacity: 0.7,
              }}
            >
              Item {index + 1}
            </Text>
          )}
          {showDelete && (
            <IconButton size="small" colorVariant="danger" onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
        {children}
      </Box>
    );
  },
);

ListItem.displayName = "ListItem";

export default ListItem;
