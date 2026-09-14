import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Horizontal "key = value" row used for string maps (additionalProperties).
 * The value node is the schema widget, so it reuses normal field rendering.
 */
export function KeyValueLayout({
  keyNode,
  valueNode,
  className,
}: {
  keyNode: ReactNode;
  valueNode: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="min-w-0 flex-1">{keyNode}</div>
      <span className="shrink-0 text-sm text-muted-foreground">=</span>
      <div className="min-w-0 flex-[3]">{valueNode}</div>
    </div>
  );
}
