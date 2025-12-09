import {
  TextField as MuiTextField,
  TextFieldProps as MuiTextFieldProps,
} from "@mui/material";
import { forwardRef } from "react";

export type TextFieldProps = MuiTextFieldProps;

/**
 * Text field component
 * Wraps MUI TextField, providing unified default styles
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ sx, ...props }, ref) => {
    return <MuiTextField ref={ref} fullWidth size="small" sx={sx} {...props} />;
  },
);

TextField.displayName = "TextField";

export default TextField;
