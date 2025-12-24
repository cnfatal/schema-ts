import { type IntegerWidgetProps } from "@schema-ts/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormField, TextField } from "../components";

/** Default debounce time (ms) */
const DEBOUNCE_DELAY = 300;

/**
 * Input pre-validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Pre-validates input value based on schema constraints
 */
function validateInput(
  val: string,
  schema: Record<string, any>,
): ValidationResult {
  if (val === "") {
    return { valid: true };
  }

  const num = Number(val);

  // Non-numeric is invalid
  if (isNaN(num)) {
    return { valid: false, error: "Please enter a valid number" };
  }

  // Integer check
  if (!Number.isInteger(num)) {
    return { valid: false, error: "Please enter an integer" };
  }

  // minimum check
  if (typeof schema.minimum === "number" && num < schema.minimum) {
    return { valid: false, error: `Cannot be less than ${schema.minimum}` };
  }

  // exclusiveMinimum check
  if (
    typeof schema.exclusiveMinimum === "number" &&
    num <= schema.exclusiveMinimum
  ) {
    return {
      valid: false,
      error: `Must be greater than ${schema.exclusiveMinimum}`,
    };
  }

  // maximum check
  if (typeof schema.maximum === "number" && num > schema.maximum) {
    return {
      valid: false,
      error: `Cannot be greater than ${schema.maximum}`,
    };
  }

  // exclusiveMaximum check
  if (
    typeof schema.exclusiveMaximum === "number" &&
    num >= schema.exclusiveMaximum
  ) {
    return {
      valid: false,
      error: `Must be less than ${schema.exclusiveMaximum}`,
    };
  }

  // multipleOf check
  if (typeof schema.multipleOf === "number" && schema.multipleOf > 0) {
    const remainder = Math.abs(num % schema.multipleOf);
    const tolerance = 1e-10;
    if (
      remainder > tolerance &&
      Math.abs(remainder - schema.multipleOf) > tolerance
    ) {
      return {
        valid: false,
        error: `Must be a multiple of ${schema.multipleOf}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Integer Input Widget
 */
export function DefaultIntegerWidget({
  label,
  value,
  onChange,
  error,
  description,
  required,
  schema,
}: IntegerWidgetProps) {
  const [internalValue, setInternalValue] = useState(() => {
    if (value !== undefined && value !== null) return String(value);
    return schema.default !== undefined ? String(schema.default) : "";
  });

  const [localError, setLocalError] = useState<string | undefined>();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextValue =
      value === undefined || value === null
        ? schema.default !== undefined
          ? String(schema.default)
          : ""
        : String(value);

    const currentNum = Number(internalValue);
    if (
      !isNaN(currentNum) &&
      typeof value === "number" &&
      currentNum === value
    ) {
      return;
    }
    if (internalValue === "" && nextValue === "") return;

    if (internalValue !== nextValue) {
      setInternalValue(nextValue);
      setLocalError(undefined);
    }
  }, [value, schema]);

  const schemaForValidation = useMemo(
    () => schema as Record<string, any>,
    [schema],
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInternalValue(val);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (val === "-") {
        setLocalError(undefined);
        return;
      }

      const validation = validateInput(val, schemaForValidation);

      if (!validation.valid) {
        setLocalError(validation.error);
        return;
      }

      setLocalError(undefined);

      debounceTimerRef.current = setTimeout(() => {
        if (val === "") {
          onChangeRef.current("" as any);
        } else {
          const num = Number(val);
          if (!isNaN(num)) {
            onChangeRef.current(num);
          }
        }
      }, DEBOUNCE_DELAY);
    },
    [schemaForValidation],
  );

  const displayError = localError || error;

  return (
    <FormField>
      <TextField
        label={label}
        type="number"
        value={internalValue}
        onChange={handleChange}
        error={!!displayError}
        helperText={displayError || description}
        required={required}
      />
    </FormField>
  );
}
