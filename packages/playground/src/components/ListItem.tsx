import { forwardRef } from "react";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { tokens } from "../theme";
import { Box, BoxProps } from "./Box";
import { IconButton } from "./IconButton";

export interface ListItemProps extends BoxProps {
  /**
   * Sequence number or key label
   */
  index?: number;
  label?: string;
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
 * Used for each element in the Array/Object widget, providing a unified card style and delete button
 */
export const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
  (
    { index, label, showDelete = true, onDelete, children, sx, ...props },
    ref,
  ) => {
    return (
      <Box
        ref={ref}
        sx={{
          p: 1,
          borderRadius: 1.5,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: tokens.colors.border.default,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          "& .MuiOutlinedInput-root": {
            bgcolor: "transparent",
          },
          ...sx,
        }}
        {...props}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: label || index !== undefined ? 1 : 0,
          }}
        >
          {showDelete && onDelete && (
            <IconButton
              size="small"
              colorVariant="danger"
              onClick={() => onDelete && onDelete()}
            >
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
