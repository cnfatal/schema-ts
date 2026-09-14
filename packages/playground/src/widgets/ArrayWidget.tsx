import { Plus, Trash2 } from "lucide-react";
import { type ArrayWidgetProps } from "@schema-ts/react";
import { instanceLevel } from "./util";
import { FieldGroup } from "@/components/field";
import { Button } from "@/components/ui/button";

/** Array widget with add/remove and collapsible long lists. */
export function DefaultArrayWidget({
  label,
  description,
  required,
  error,
  fieldRef,
  items,
  canAdd,
  onAdd,
  instanceLocation,
  disabled,
}: ArrayWidgetProps) {
  const level = instanceLevel(instanceLocation);

  return (
    <FieldGroup
      label={label}
      description={description}
      required={required}
      error={error}
      fieldRef={fieldRef}
      dataPath={instanceLocation}
      level={level}
      collapsible={items.length > 5}
      actions={
        canAdd ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onAdd}
          >
            <Plus /> Add
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="rounded-lg border border-border bg-muted/20 p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  #{index + 1}
                </span>
                {item.onRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => item.onRemove?.()}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              {item.render({ label: "" })}
            </div>
          ))}
        </div>
      )}
    </FieldGroup>
  );
}
