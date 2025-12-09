import {
  Select as MuiSelect,
  SelectProps as MuiSelectProps,
  SelectChangeEvent,
  FormControl,
  FormControlProps,
  MenuItem as MuiMenuItem,
  MenuItemProps as MuiMenuItemProps,
  FormHelperText,
  InputLabel,
} from "@mui/material";
import { forwardRef, ReactNode } from "react";
import { Text } from "./Text";

export interface SelectProps extends Omit<MuiSelectProps<string>, "onChange"> {
  /**
   * FormControl props
   */
  formControlProps?: Omit<FormControlProps, "children">;
  /**
   * Whether to show borderless style
   */
  borderless?: boolean;
  /**
   * Option change callback
   */
  onChange?: (value: string) => void;
  /**
   * Children
   */
  children?: ReactNode;
}

/**
 * Public Select component
 * Wraps MUI Select, providing unified default style
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ formControlProps, borderless, sx, children, onChange, ...props }, ref) => {
    const selectSx = borderless
      ? {
          bgcolor: "rgba(0,0,0,0.02)",
          "& .MuiOutlinedInput-notchedOutline": { border: "none" },
          ...sx,
        }
      : sx;

    const handleChange = (event: SelectChangeEvent<string>) => {
      onChange?.(event.target.value);
    };

    return (
      <FormControl ref={ref} {...formControlProps}>
        <MuiSelect
          size="small"
          sx={selectSx}
          onChange={handleChange}
          {...props}
        >
          {children}
        </MuiSelect>
      </FormControl>
    );
  },
);

Select.displayName = "Select";

export type SelectOptionProps = MuiMenuItemProps;

/**
 * Select option component
 */
export const SelectOption = forwardRef<HTMLLIElement, SelectOptionProps>(
  (props, ref) => {
    return <MuiMenuItem ref={ref} {...props} />;
  },
);

SelectOption.displayName = "SelectOption";

export interface SelectFieldProps {
  /**
   * Label
   */
  label?: string;
  /**
   * Current value
   */
  value?: string | number | null;
  /**
   * Options list
   */
  options: (string | number)[];
  /**
   * Value change callback
   */
  onChange?: (value: string) => void;
  /**
   * Error message
   */
  error?: string;
  /**
   * Description message
   */
  description?: string;
  /**
   * Whether it is required
   */
  required?: boolean;
}

/**
 * Select form field component
 * Includes label, select box, and helper text
 * Consistent with TextField style
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  description,
  required,
}: SelectFieldProps) {
  const helperText = error || description;

  return (
    <FormControl fullWidth size="small" error={!!error} required={required}>
      {label && <InputLabel shrink>{label}</InputLabel>}
      <Select
        value={String(value ?? "")}
        label={label}
        onChange={onChange}
        displayEmpty
      >
        <SelectOption value="">
          <Text variant="body2" color="text.disabled">
            Select an option...
          </Text>
        </SelectOption>
        {options.map((option) => (
          <SelectOption key={String(option)} value={String(option)}>
            {String(option)}
          </SelectOption>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}

SelectField.displayName = "SelectField";

export default Select;
