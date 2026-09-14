import type { ReactNode } from "react";
import { cn } from "cn";

export interface PanelProps {
  title: string;
  /** Optional header controls on the right. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Flat region with a compact title bar. */
export function Panel({ title, actions, children, className }: PanelProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b px-3">
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        {actions}
      </div>
      {children}
    </div>
  );
}
