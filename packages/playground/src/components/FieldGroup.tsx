import { BoxProps, FormHelperText } from "@mui/material";

import { tokens } from "../theme";
import { Box, Flex } from "./Box";
import { Text } from "./Text";

export interface FieldGroupProps extends BoxProps {
  /**
   * Group title
   */
  label?: string;
  /**
   * Description text
   */
  description?: React.ReactNode;
  /**
   * Whether it is required
   */
  required?: boolean;
  /**
   * Error message
   */
  error?: string;
  /**
   * Action button area on the right side of the header
   */
  headerAction?: React.ReactNode;
  /**
   * Whether to use a compact description layout (description on the same line as the title)
   */
  compactDescription?: boolean;
}

/**
 * Field group container
 * Used for Object and Array types, providing a unified container style
 */
export function FieldGroup({
  label,
  description,
  required,
  error,
  headerAction,
  compactDescription = false,
  sx,
  children,
  ...props
}: FieldGroupProps) {
  return (
    <Box
      sx={{
        mb: 2,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: tokens.colors.background.subtle,
        transition: "all 0.2s",
        border: `1px solid ${tokens.colors.border.subtle}`,
        "&:hover": {
          bgcolor: tokens.colors.background.subtleHover,
          borderColor: tokens.colors.border.primaryLight,
        },
        "& .MuiOutlinedInput-root": {
          bgcolor: "transparent",
        },
        ...sx,
      }}
      {...props}
    >
      {/* Header: Title + Optional Action */}
      {(label || headerAction) && (
        <Flex
          align="center"
          justify="space-between"
          sx={{ mb: compactDescription ? 2 : 1.5 }}
        >
          <Flex align="center" gap={1}>
            <FieldIndicator />
            <Box>
              <Text
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: "text.primary",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                {label}
                {required && <RequiredMark />}
              </Text>
              {/* Compact Mode: Description shown on same line as title */}
              {compactDescription && description && (
                <Text
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  {description}
                </Text>
              )}
            </Box>
          </Flex>
          {headerAction}
        </Flex>
      )}

      {/* Non-compact Mode: Description on a separate line */}
      {!compactDescription && description && (
        <Text
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1.5 }}
        >
          {description}
        </Text>
      )}

      {/* Content Area */}
      {children}

      {/* Error Message */}
      {error && (
        <FormHelperText error sx={{ mt: 1.5, fontWeight: 500 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}

export type FieldIndicatorProps = BoxProps;

/**
 * Field indicator
 * Decorative bar shown before field group titles
 */
export function FieldIndicator({ sx, ...props }: FieldIndicatorProps) {
  return (
    <Box
      sx={{
        width: 3,
        height: 16,
        bgcolor: "primary.light",
        opacity: 0.5,
        borderRadius: 1,
        ...sx,
      }}
      {...props}
    />
  );
}

export interface RequiredMarkProps extends BoxProps {
  component?: React.ElementType;
}

/**
 * Required marker component
 */
export function RequiredMark({ sx, ...props }: RequiredMarkProps) {
  return (
    <Box
      component="span"
      sx={{
        color: "error.main",
        fontSize: "1.2rem",
        lineHeight: 0,
        ...sx,
      }}
      {...props}
    >
      *
    </Box>
  );
}

export default FieldGroup;
