import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A hook that provides debounced value management for controlled inputs.
 *
 * @param externalValue - The controlled value from props
 * @param onChange - Callback to trigger when debounced value changes
 * @param delay - Debounce delay in milliseconds (default: 300)
 * @returns [internalValue, handleChange] - Current value and change handler
 */
export function useDebouncedInput<T extends string | number>(
  externalValue: T,
  onChange: (value: T) => void,
  delay = 300,
): [T, (value: T) => void] {
  const [internalValue, setInternalValue] = useState(externalValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync internal value when external value changes (from parent)
  useEffect(() => {
    // Clear any pending debounce and sync with external value
    clearTimeout(debounceRef.current);
    setInternalValue(externalValue);
  }, [externalValue]);

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleChange = useCallback(
    (value: T) => {
      setInternalValue(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChangeRef.current(value), delay);
    },
    [delay],
  );

  return [internalValue, handleChange];
}
