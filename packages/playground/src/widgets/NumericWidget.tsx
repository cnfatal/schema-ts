import { useEffect, useRef, useState } from "react";
import type { Schema } from "@schema-ts/core";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useDebouncedCallback } from "@/hooks/useDebouncedInput";

const DEBOUNCE_DELAY = 300;

/** Bounded ranges wider than this stay a plain input (a slider would be unusable). */
const SLIDER_MAX_SPAN = 100;

function validateNumericInput(
  raw: string,
  integer: boolean,
  schema: Schema,
): string | undefined {
  if (raw === "") return undefined;
  const num = Number(raw);
  if (Number.isNaN(num)) return "Please enter a valid number";
  if (integer && !Number.isInteger(num)) return "Please enter an integer";
  if (typeof schema.minimum === "number" && num < schema.minimum) {
    return `Cannot be less than ${schema.minimum}`;
  }
  if (
    typeof schema.exclusiveMinimum === "number" &&
    num <= schema.exclusiveMinimum
  ) {
    return `Must be greater than ${schema.exclusiveMinimum}`;
  }
  if (typeof schema.maximum === "number" && num > schema.maximum) {
    return `Cannot be greater than ${schema.maximum}`;
  }
  if (
    typeof schema.exclusiveMaximum === "number" &&
    num >= schema.exclusiveMaximum
  ) {
    return `Must be less than ${schema.exclusiveMaximum}`;
  }
  if (typeof schema.multipleOf === "number" && schema.multipleOf > 0) {
    const remainder = Math.abs(num % schema.multipleOf);
    const tolerance = 1e-10;
    if (
      remainder > tolerance &&
      Math.abs(remainder - schema.multipleOf) > tolerance
    ) {
      return `Must be a multiple of ${schema.multipleOf}`;
    }
  }
  return undefined;
}

export interface NumericWidgetProps {
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  schema: Schema;
  fieldRef?: (element: HTMLElement | null) => void;
  onBlur?: () => void;
  instanceLocation?: string;
  integer?: boolean;
}

/**
 * Number/integer input.
 *
 * - Bounded range -> slider. The thumb tracks a local draft while dragging and
 *   commits once on release (no arbitrary delay, one update).
 * - Otherwise a text input that pre-validates and commits on a debounce.
 */
export function NumericWidget({
  label,
  description,
  required,
  disabled,
  error,
  value,
  onChange,
  schema,
  fieldRef,
  onBlur,
  instanceLocation,
  integer = false,
}: NumericWidgetProps) {
  const min = typeof schema.minimum === "number" ? schema.minimum : undefined;
  const max = typeof schema.maximum === "number" ? schema.maximum : undefined;
  const multipleOf =
    typeof schema.multipleOf === "number" ? schema.multipleOf : undefined;
  const span = min !== undefined && max !== undefined ? max - min : Infinity;
  const useSlider =
    min !== undefined &&
    max !== undefined &&
    (multipleOf !== undefined || span <= SLIDER_MAX_SPAN);

  const [internalValue, setInternalValue] = useState(() =>
    value === undefined || value === null
      ? schema.default !== undefined
        ? String(schema.default)
        : ""
      : String(value),
  );
  const [localError, setLocalError] = useState<string | undefined>();
  const [draft, setDraft] = useState<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const commit = useDebouncedCallback((raw: string) => {
    if (raw === "") {
      onChangeRef.current(0);
      return;
    }
    const num = Number(raw);
    if (!Number.isNaN(num)) onChangeRef.current(num);
  }, DEBOUNCE_DELAY);

  useEffect(() => {
    const next =
      value === undefined || value === null
        ? schema.default !== undefined
          ? String(schema.default)
          : ""
        : String(value);
    setInternalValue((current) => (current === next ? current : next));
    setLocalError(undefined);
  }, [value, schema]);

  const handleChange = (raw: string) => {
    setInternalValue(raw);
    const validationError = validateNumericInput(raw, integer, schema);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError(undefined);
    commit(raw);
  };

  const displayError = localError ?? error;

  if (useSlider && min !== undefined && max !== undefined) {
    const step = multipleOf ?? (integer ? 1 : 0.01);
    const raw = typeof value === "number" ? value : min;
    const current = draft ?? Math.min(Math.max(raw, min), max);

    return (
      <div
        ref={(element) => fieldRef?.(element)}
        data-field-path={instanceLocation}
      >
        <Field
          label={label}
          description={description}
          error={displayError}
          required={required}
        >
          <div className="flex items-center gap-3 pt-1">
            <Slider
              min={min}
              max={max}
              step={step}
              value={[current]}
              disabled={disabled}
              onValueChange={(next) => setDraft(next[0])}
              onValueCommit={(next) => {
                setDraft(null);
                onChange(next[0]);
              }}
              onBlur={() => onBlur?.()}
              className="flex-1"
            />
            <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">
              {current}
            </span>
          </div>
        </Field>
      </div>
    );
  }

  return (
    <div
      ref={(element) => fieldRef?.(element)}
      data-field-path={instanceLocation}
    >
      <Field
        label={label}
        description={description}
        error={displayError}
        required={required}
      >
        <Input
          type="number"
          inputMode="decimal"
          disabled={disabled}
          value={internalValue}
          aria-invalid={!!displayError}
          onBlur={() => onBlur?.()}
          onChange={(event) => handleChange(event.target.value)}
        />
      </Field>
    </div>
  );
}
