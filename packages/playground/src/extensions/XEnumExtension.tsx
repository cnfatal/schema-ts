import { useId } from "react";
import { WidgetProps, defineExtension } from "@schema-ts/react";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface XEnumWidgetProps extends WidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  options: {
    label: string;
    value: unknown;
  }[];
}

function XEnumWidget(props: XEnumWidgetProps) {
  const id = useId();
  const current =
    props.value === undefined || props.value === null
      ? ""
      : String(props.value);

  return (
    <div
      ref={(element) => props.fieldRef?.(element)}
      data-field-path={props.instanceLocation}
    >
      <Field
        label={
          <span className="flex items-center gap-2">
            {props.label}
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              x-enum
            </Badge>
          </span>
        }
        description={props.description}
        error={props.error}
        required={props.required}
        htmlFor={id}
      >
        {props.options.length > 0 && props.options.length <= 3 ? (
          <RadioGroup
            value={current}
            onValueChange={(next) => props.onChange(next)}
            disabled={props.disabled}
            className="flex flex-wrap gap-x-5 gap-y-2 pt-1"
          >
            {props.options.map((option, index) => (
              <label
                key={String(option.value)}
                htmlFor={`${id}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <RadioGroupItem
                  id={`${id}-${index}`}
                  value={String(option.value)}
                />
                {option.label}
              </label>
            ))}
          </RadioGroup>
        ) : (
          <Select
            value={current}
            onValueChange={(next) => props.onChange(next)}
            disabled={props.disabled}
          >
            <SelectTrigger
              id={id}
              className="w-full"
              aria-invalid={!!props.error}
            >
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {props.options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    </div>
  );
}

/**
 * XEnum Extension - demonstrates custom schema extension for labeled enum options.
 *
 * Usage in schema:
 * ```json
 * {
 *   "type": "string",
 *   "x-enum": [
 *     { "name": "Active", "value": "active" },
 *     { "name": "Pending", "value": "pending" }
 *   ]
 * }
 * ```
 */
export const XEnumExtension = defineExtension("xenum", XEnumWidget, {
  matcher: (props, base) => {
    const xenum = props.schema["x-enum"];
    if (Array.isArray(xenum)) {
      const xenumOptions = xenum as { name: string; value: unknown }[];
      return {
        ...base,
        value: props.value,
        onChange: props.onChange,
        options: xenumOptions.map((option) => ({
          label: option.name,
          value: option.value,
        })),
      } as XEnumWidgetProps;
    }
    return undefined;
  },
});
