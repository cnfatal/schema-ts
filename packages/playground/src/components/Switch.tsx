import {
  Switch as MuiSwitch,
  SwitchProps as MuiSwitchProps,
  FormControlLabel,
  FormHelperText,
} from "@mui/material";
import { forwardRef } from "react";
import { Box } from "./Box";
import { FieldLabel } from "./FormField";

export type SwitchProps = MuiSwitchProps;

/**
 * Switch component
 * Wraps MUI Switch
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (props, ref) => {
    return <MuiSwitch ref={ref} color="primary" {...props} />;
  },
);

Switch.displayName = "Switch";

export interface SwitchFieldProps {
  /**
   * Label
   */
  label?: string;
  /**
   * Whether it is checked
   */
  checked?: boolean;
  /**
   * Value change callback
   */
  onChange?: (checked: boolean) => void;
  /**
   * Whether it is required
   */
  required?: boolean;
  /**
   * Error message
   */
  error?: string;
  /**
   * Description message
   */
  description?: string;
}

/**
 * Switch field component
 * Includes label, switch control, and help text
 */
export const SwitchField = forwardRef<HTMLDivElement, SwitchFieldProps>(
  ({ label, checked, onChange, required, error, description }, ref) => {
    const helperText = error || description;

    return (
      <Box ref={ref} sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={!!checked}
              onChange={(e) => onChange?.(e.target.checked)}
            />
          }
          label={<FieldLabel required={required}>{label}</FieldLabel>}
        />
        {helperText && (
          <FormHelperText error={!!error} sx={{ fontWeight: 500, mx: 1 }}>
            {helperText}
          </FormHelperText>
        )}
      </Box>
    );
  },
);

SwitchField.displayName = "SwitchField";

export default Switch;
