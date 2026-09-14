import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { type TextWidgetProps } from "@schema-ts/react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedInput } from "@/hooks/useDebouncedInput";

/** Values longer than this (or maxLength above it) use a textarea. */
const TEXTAREA_THRESHOLD = 100;

/** Text widget routed by schema format: date/time, password, textarea, text. */
export function DefaultTextWidget({
  label,
  value,
  disabled,
  onChange,
  error,
  fieldRef,
  description,
  required,
  schema,
  onBlur,
  instanceLocation,
}: TextWidgetProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const externalValue =
    value !== undefined && value !== null ? String(value) : "";
  const [internalValue, handleChange] = useDebouncedInput(
    externalValue,
    onChange,
  );
  const placeholder =
    typeof schema.default === "string" ? schema.default : undefined;
  const format = typeof schema.format === "string" ? schema.format : "";
  const maxLength =
    typeof schema.maxLength === "number" ? schema.maxLength : undefined;

  const wrap = (control: ReactNode) => (
    <div
      ref={(element) => fieldRef?.(element)}
      data-field-path={instanceLocation}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        htmlFor={id}
      >
        {control}
      </Field>
    </div>
  );

  const common = {
    id,
    disabled,
    placeholder,
    "aria-invalid": !!error,
    onBlur: () => onBlur?.(),
  } as const;

  if (format === "date" || format === "time" || format === "date-time") {
    const type =
      format === "date"
        ? "date"
        : format === "time"
          ? "time"
          : "datetime-local";
    const inputValue =
      format === "date-time" ? externalValue.slice(0, 16) : externalValue;
    return wrap(
      <Input
        {...common}
        type={type}
        value={inputValue}
        onChange={(event) => handleChange(event.target.value)}
      />,
    );
  }

  if (format === "password") {
    return wrap(
      <div className="relative">
        <Input
          {...common}
          type={showPassword ? "text" : "password"}
          value={internalValue}
          className="pr-9"
          onChange={(event) => handleChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={showPassword ? "Hide value" : "Show value"}
          onClick={() => setShowPassword((visible) => !visible)}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>,
    );
  }

  const useTextarea =
    format === "textarea" ||
    (maxLength !== undefined && maxLength > TEXTAREA_THRESHOLD) ||
    externalValue.includes("\n") ||
    externalValue.length > TEXTAREA_THRESHOLD;

  if (useTextarea) {
    return wrap(
      <Textarea
        {...common}
        rows={4}
        value={internalValue}
        onChange={(event) => handleChange(event.target.value)}
      />,
    );
  }

  return wrap(
    <Input
      {...common}
      type="text"
      value={internalValue}
      onChange={(event) => handleChange(event.target.value)}
    />,
  );
}
