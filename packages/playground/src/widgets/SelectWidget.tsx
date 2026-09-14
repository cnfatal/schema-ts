import { useId } from "react";
import { type SelectWidgetProps } from "@schema-ts/react";
import { Field } from "@/components/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Up to this many options are shown as radios; more become a dropdown. */
const MAX_RADIO_OPTIONS = 3;

/** Enum widget: radio group for small sets, dropdown otherwise. */
export function DefaultSelectWidget({
  label,
  value,
  onChange,
  options,
  error,
  fieldRef,
  description,
  required,
  disabled,
  onBlur,
  instanceLocation,
}: SelectWidgetProps) {
  const id = useId();
  const items = (options ?? []) as (string | number)[];
  const current = value === undefined || value === null ? "" : String(value);
  const useRadio = items.length > 0 && items.length <= MAX_RADIO_OPTIONS;

  return (
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
        {useRadio ? (
          <RadioGroup
            value={current}
            onValueChange={(next) => onChange(next)}
            disabled={disabled}
            onBlur={() => onBlur?.()}
            className="flex flex-wrap gap-x-5 gap-y-2 pt-1"
          >
            {items.map((option, index) => (
              <label
                key={String(option)}
                htmlFor={`${id}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <RadioGroupItem id={`${id}-${index}`} value={String(option)} />
                {String(option)}
              </label>
            ))}
          </RadioGroup>
        ) : (
          <Select
            value={current}
            onValueChange={(next) => onChange(next)}
            disabled={disabled}
          >
            <SelectTrigger
              id={id}
              className="w-full"
              aria-invalid={!!error}
              onBlur={() => onBlur?.()}
            >
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {items.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </div>
  );
}
