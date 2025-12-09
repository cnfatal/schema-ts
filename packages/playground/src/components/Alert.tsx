import { Alert as MuiAlert, AlertProps as MuiAlertProps } from "@mui/material";
import { forwardRef } from "react";

export type AlertProps = MuiAlertProps;

/**
 * Alert component
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ sx, ...props }, ref) => {
    return (
      <MuiAlert
        ref={ref}
        sx={{
          borderRadius: 2,
          ...sx,
        }}
        {...props}
      />
    );
  },
);

Alert.displayName = "Alert";

export default Alert;
