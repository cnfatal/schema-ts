import type { ReactNode } from "react";
import { cn } from "cn";

/** Rounded surface for a workbench region. */
export function Region({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
