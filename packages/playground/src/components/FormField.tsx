import {
  FormControl,
  FormControlProps,
  FormHelperText,
  InputLabel,
} from "@mui/material";
import { forwardRef } from "react";
import { Box, BoxProps } from "./Box";
import { RequiredMark } from "./FieldGroup";

export interface FormFieldProps extends BoxProps {
  /**
   * Label for the form field
   */
  label?: React.ReactNode;
  /**
   * Description text
   */
  description?: React.ReactNode;
  /**
   * Error message
   */
  error?: string;
  /**
   * Whether it is required
   */
  required?: boolean;
}

/**
 * Form field wrapper component
 * Provides unified margin and layout
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ sx, children, ...props }, ref) => {
    return (
      <Box ref={ref} sx={{ mb: 2, ...sx }} {...props}>
        {children}
      </Box>
    );
  },
);

FormField.displayName = "FormField";

export interface FormFieldControlProps extends Omit<FormControlProps, "error"> {
  /**
   * Label for the form field
   */
  label?: React.ReactNode;
  /**
   * Help text or error message
   */
  helperText?: React.ReactNode;
  /**
   * Whether there is an error
   */
  hasError?: boolean;
}

/**
 * Form control wrapper component
 * Wraps FormControl, providing label and helper text
 */
export const FormFieldControl = forwardRef<
  HTMLDivElement,
  FormFieldControlProps
>(({ label, helperText, hasError, children, ...props }, ref) => {
  return (
    <FormControl ref={ref} fullWidth error={hasError} {...props}>
      {label && <InputLabel sx={{ fontWeight: 500 }}>{label}</InputLabel>}
      {children}
      {helperText && (
        <FormHelperText sx={{ fontWeight: 500, mx: 1 }}>
          {helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
});

FormFieldControl.displayName = "FormFieldControl";

export interface FieldLabelProps extends BoxProps {
  /**
   * Whether it is required
   */
  required?: boolean;
}

/**
 * Field label component
 * Supports displaying a required marker
 */
export const FieldLabel = forwardRef<HTMLSpanElement, FieldLabelProps>(
  ({ required, children, sx, ...props }, ref) => {
    return (
      <Box
        component="span"
        ref={ref}
        sx={{ fontWeight: 500, color: "text.primary", ...sx }}
        {...props}
      >
        {children}
        {required && <RequiredMark sx={{ ml: 0.5 }} />}
      </Box>
    );
  },
);

FieldLabel.displayName = "FieldLabel";

export default FormField;
