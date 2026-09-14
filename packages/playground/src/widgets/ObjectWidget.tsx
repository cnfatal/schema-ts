import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type ObjectWidgetProps } from "@schema-ts/react";
import { safeRegexTest } from "@schema-ts/core";
import {
  instanceLevel,
  isEffectivelyEmpty,
  isStringMap,
  isWideField,
} from "./util";
import { FieldGroup } from "@/components/field";
import { KeyValueLayout } from "@/components/key-value-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Object widget.
 *
 * - String maps (additionalProperties: string) render as "key = value" rows.
 * - Fixed properties render in a responsive grid.
 * - Dynamic (removable) properties get a card.
 * Nesting never produces a card inside a card.
 */
export function DefaultObjectWidget({
  label,
  description,
  required,
  error,
  fieldRef,
  properties,
  onAddProperty,
  instanceLocation,
  schema,
}: ObjectWidgetProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const level = instanceLevel(instanceLocation);
  const canAdd = !!onAddProperty;
  const stringMap = isStringMap(schema);
  const patterns = schema.patternProperties
    ? Object.keys(schema.patternProperties)
    : [];
  const trimmedKey = newKey.trim();
  const keyMatches =
    patterns.length === 0 ||
    patterns.some((pattern) => safeRegexTest(pattern, trimmedKey));
  const visibleProperties = (properties ?? []).filter(
    (prop) => prop.onRemove || !isEffectivelyEmpty(prop.schema),
  );

  // An object with nothing renderable is not worth a section header.
  if (visibleProperties.length === 0 && !canAdd) {
    return null;
  }

  const add = () => {
    const key = newKey.trim();
    if (!key || !keyMatches) return;
    onAddProperty?.(key, stringMap ? newValue : undefined);
    setNewKey("");
    setNewValue("");
  };

  return (
    <FieldGroup
      label={label}
      description={description}
      required={required}
      error={error}
      fieldRef={fieldRef}
      dataPath={instanceLocation}
      level={level}
      collapsible={Boolean((schema as Record<string, unknown>)["x-collapse"])}
    >
      {stringMap ? (
        <div className="flex flex-col gap-2">
          {visibleProperties.map((prop) => (
            <div key={prop.key} className="flex items-center gap-2">
              <KeyValueLayout
                className="flex-1"
                keyNode={
                  <span className="truncate font-mono text-[13px] text-foreground">
                    {prop.key}
                  </span>
                }
                valueNode={prop.render({ label: "" })}
              />
              {prop.onRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${prop.key}`}
                  onClick={() => prop.onRemove?.()}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {visibleProperties.map((prop) =>
            prop.onRemove ? (
              <div key={prop.key} className="sm:col-span-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {prop.key}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${prop.key}`}
                      onClick={() => prop.onRemove?.()}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {prop.render()}
                </div>
              </div>
            ) : (
              <div
                key={prop.key}
                className={
                  isWideField(prop.schema) ? "sm:col-span-2" : undefined
                }
              >
                {prop.render()}
              </div>
            ),
          )}
        </div>
      )}

      {canAdd ? (
        stringMap ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={newKey}
              placeholder="Key"
              className="max-w-[220px]"
              onChange={(event) => setNewKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Input
              value={newValue}
              placeholder="Value"
              className="flex-1"
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newKey.trim()}
              onClick={add}
            >
              <Plus /> Add
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <Input
                value={newKey}
                placeholder={
                  patterns.length > 0
                    ? `Key (must match ${patterns[0]})`
                    : "New property name"
                }
                aria-invalid={trimmedKey.length > 0 && !keyMatches}
                className="max-w-xs"
                onChange={(event) => setNewKey(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!trimmedKey || !keyMatches}
                onClick={add}
              >
                <Plus /> Add property
              </Button>
            </div>
            {trimmedKey && !keyMatches ? (
              <p className="mt-1 text-xs text-destructive">
                Key must match {patterns.join(" or ")}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </FieldGroup>
  );
}
