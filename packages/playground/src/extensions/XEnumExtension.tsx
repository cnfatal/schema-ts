import { WidgetProps, defineExtension } from "@schema-ts/react";

export interface XEnumWidgetProps extends WidgetProps {
  value: unknown;
  onChange: (value: unknown) => void;
  options: {
    label: string;
    value: unknown;
  }[];
}

function XEnumWidget(props: XEnumWidgetProps) {
  return (
    <div
      ref={props.fieldRef}
      style={{
        marginBottom: "16px",
        padding: "8px",
        border: "1px dashed #ccc",
        borderRadius: "4px",
      }}
    >
      <label
        style={{
          display: "block",
          marginBottom: "4px",
          fontSize: "12px",
          color: "#666",
        }}
      >
        {props.label} (XEnum Extension)
      </label>
      <select
        style={{ width: "100%", padding: "4px" }}
        value={props.value as string}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">Select option...</option>
        {props.options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {props.error && (
        <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
          {props.error}
        </div>
      )}
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
