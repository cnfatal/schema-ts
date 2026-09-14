import { type SwitchWidgetProps } from "@schema-ts/react";
import { RequiredMark } from "@/components/field";
import { Switch } from "@/components/ui/switch";

/** Boolean toggle rendered as a label + switch row. */
export function DefaultSwitchWidget({
  label,
  value,
  onChange,
  error,
  fieldRef,
  description,
  required,
  disabled,
  onBlur,
  instanceLocation,
}: SwitchWidgetProps) {
  return (
    <div
      ref={(element) => fieldRef?.(element)}
      data-field-path={instanceLocation}
      className="flex items-start justify-between gap-4 py-0.5"
    >
      <div className="min-w-0">
        {label ? (
          <label className="text-sm font-medium text-foreground">
            {label}
            {required ? <RequiredMark /> : null}
          </label>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
        {error ? (
          <p className="mt-0.5 text-xs font-medium text-destructive">{error}</p>
        ) : null}
      </div>
      <Switch
        checked={!!value}
        disabled={disabled}
        onBlur={() => onBlur?.()}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}
