import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RequiredMark() {
  return <span className="ml-0.5 text-destructive">*</span>;
}

interface FieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** A single labelled control: label, control, then error or description. */
export function Field({
  label,
  description,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label || description ? (
        <span className="flex items-center gap-1">
          {label ? (
            <label
              htmlFor={htmlFor}
              className="text-sm leading-none font-medium text-foreground"
            >
              {label}
              {required ? <RequiredMark /> : null}
            </label>
          ) : null}
          {description ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label="Field description"
                  className="inline-flex text-muted-foreground/70 hover:text-foreground"
                >
                  <CircleHelp className="size-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {description}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

interface FieldGroupProps {
  label?: string;
  description?: ReactNode;
  required?: boolean;
  error?: string;
  /** Right-aligned header controls (e.g. Add button). */
  actions?: ReactNode;
  /** Depth in the instance tree. Level 1 renders as a card, deeper levels plain. */
  level: number;
  /** Render a collapse toggle in the header. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  fieldRef?: (element: HTMLElement | null) => void;
  /** Instance path exposed as data-field-path for scroll-to-error. */
  dataPath?: string;
  className?: string;
}

/**
 * Section container for objects and arrays.
 *
 * Level 1 becomes a card with a header row; deeper levels render as plain
 * indented sections, so nesting never produces a card inside a card.
 */
export function FieldGroup({
  label,
  description,
  required,
  error,
  actions,
  level,
  collapsible = false,
  defaultOpen = true,
  children,
  fieldRef,
  dataPath,
  className,
}: FieldGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasHeader = Boolean(label || description || actions || collapsible);

  const header = hasHeader ? (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {label ? (
          <h3
            className={cn(
              "font-semibold text-foreground",
              level <= 1 ? "text-base" : "text-[11px] tracking-wider uppercase",
            )}
          >
            {label}
            {required ? <RequiredMark /> : null}
          </h3>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {collapsible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={cn("transition-transform", !open && "-rotate-90")}
            />
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;

  const content = (
    <>
      {children}
      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </>
  );

  if (level === 0) {
    return (
      <div
        ref={(element) => fieldRef?.(element)}
        data-field-path={dataPath}
        className={cn("min-w-0", className)}
      >
        {header ? <div className="mb-3">{header}</div> : null}
        {content}
      </div>
    );
  }

  if (level === 1) {
    return (
      <Card
        ref={fieldRef}
        data-field-path={dataPath}
        className={cn("mb-4 gap-0 py-0", className)}
      >
        {header ? <div className="border-b px-5 py-3.5">{header}</div> : null}
        <div className={cn("px-5 py-4", collapsible && !open && "hidden")}>
          {content}
        </div>
      </Card>
    );
  }

  return (
    <section
      ref={(element) => fieldRef?.(element)}
      data-field-path={dataPath}
      className={cn("mb-4 border-l border-border pl-4", className)}
    >
      {header ? <div className="mb-3">{header}</div> : null}
      <div className={cn(collapsible && !open && "hidden")}>{content}</div>
    </section>
  );
}
