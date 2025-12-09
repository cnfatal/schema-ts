import { type TextWidgetProps } from "@schema-ts/react";
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
 * Returns { valid: true } if input is valid, allowing onChange to be triggered
 * Returns { valid: false, error: "..." } if input is invalid, preventing onChange
 */
function validateInput(
  val: string,
  type: "text" | "number" | "integer",
  schema: Record<string, unknown>,
): ValidationResult {
  // Empty values are always valid (required is handled by parent)
  if (val === "") {
    return { valid: true };
  }

  if (type === "number" || type === "integer") {
    const num = Number(val);

    // Non-numeric is invalid
    if (isNaN(num)) {
      return { valid: false, error: "Please enter a valid number" };
    }

    // Integer check
    if (type === "integer" && !Number.isInteger(num)) {
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
      // Use precise calculation to avoid floating point errors
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
  } else {
    // String type validation

    // maxLength check
    if (typeof schema.maxLength === "number" && val.length > schema.maxLength) {
      return {
        valid: false,
        error: `Length cannot exceed ${schema.maxLength}`,
      };
    }

    // minLength check - only if not empty
    if (typeof schema.minLength === "number" && val.length < schema.minLength) {
      return {
        valid: false,
        error: `Length cannot be less than ${schema.minLength}`,
      };
    }

    // pattern check
    if (typeof schema.pattern === "string") {
      try {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(val)) {
          return { valid: false, error: "Invalid format" };
        }
      } catch {
        // regex invalid, ignore this check
      }
    }
  }

  return { valid: true };
}

/**
 * Text Input Widget
 * Uses public TextField component, no extra style code
 *
 * Optimization: When input value is clearly invalid, doesn't trigger onChange to avoid propagating invalid values
 */
export function DefaultTextWidget({
  label,
  value,
  onChange,
  error,
  description,
  required,
  type,
  schema,
}: TextWidgetProps) {
  const [internalValue, setInternalValue] = useState(() => {
    if (value !== undefined && value !== null) return String(value);
    return schema.default !== undefined ? String(schema.default) : "";
  });

  // Local validation error (shown when input is invalid and onChange not triggered)
  const [localError, setLocalError] = useState<string | undefined>();

  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
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

    if (type === "number" || type === "integer") {
      const currentNum = Number(internalValue);
      // Avoid input interruption caused by number formatting (e.g., "1." covered by "1")
      if (
        !isNaN(currentNum) &&
        typeof value === "number" &&
        currentNum === value
      ) {
        return;
      }
      if (internalValue === "" && nextValue === "") return;
    }

    if (internalValue !== nextValue) {
      setInternalValue(nextValue);
      setLocalError(undefined); // Clear local error when external value changes
    }
  }, [value, type, schema]);

  // Cache schema object for validation to avoid unnecessary recalculations
  const schemaForValidation = useMemo(
    () => schema as Record<string, unknown>,
    [schema],
  );

  // Use useRef to save the latest onChange to avoid useCallback dependency changes
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;

      // Update internal state immediately to keep UI responsive
      setInternalValue(val);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Allow intermediate numeric input states (e.g., "1.", "-") without triggering onChange
      if (
        (type === "number" || type === "integer") &&
        (val.endsWith(".") || val === "-" || val === "-.")
      ) {
        setLocalError(undefined);
        return;
      }

      // Pre-validate input
      const validation = validateInput(val, type, schemaForValidation);

      if (!validation.valid) {
        // Input invalid, don't trigger onChange, show local error
        setLocalError(validation.error);
        return;
      }

      // Input valid, clear local error
      setLocalError(undefined);

      // Use debounce to delay triggering onChange
      debounceTimerRef.current = setTimeout(() => {
        if (type === "number" || type === "integer") {
          if (val === "") {
            onChangeRef.current("");
          } else {
            const num = Number(val);
            if (!isNaN(num)) {
              onChangeRef.current(num);
            }
          }
        } else {
          onChangeRef.current(val);
        }
      }, DEBOUNCE_DELAY);
    },
    [type, schemaForValidation],
  );

  // Displayed error: local validation error takes priority over external error
  const displayError = localError || error;

  return (
    <FormField>
      <TextField
        label={label}
        type={type}
        value={internalValue}
        onChange={handleChange}
        error={!!displayError}
        helperText={displayError || description}
        required={required}
      />
    </FormField>
  );
}
