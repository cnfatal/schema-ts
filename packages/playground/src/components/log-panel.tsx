import { useEffect, useRef } from "react";
import { Eraser, Terminal } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export interface LogEntry {
  id: number;
  time: string;
  level: "info" | "error" | "success";
  message: string;
  /** Instance path of the field the entry refers to, when applicable. */
  path?: string;
}

const LEVEL_META: Record<
  LogEntry["level"],
  { label: string; className: string }
> = {
  info: { label: "info", className: "text-sky-600 dark:text-sky-400" },
  success: {
    label: "done",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  error: { label: "error", className: "text-red-600 dark:text-red-400" },
};

/**
 * Restrained log console: monospace, line-per-entry with timestamp and severity,
 * auto-scrolled to the latest entry. Entries that carry an instance path can be
 * clicked to jump to the offending field.
 */
export function LogPanel({
  logs,
  onClear,
  onJump,
}: {
  logs: LogEntry[];
  onClear: () => void;
  onJump?: (path: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-8 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Log
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={logs.length === 0}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
        >
          <Eraser className="size-3.5" /> Clear
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto px-3 py-1.5 font-mono text-xs leading-5"
      >
        {logs.length === 0 ? (
          <div className="text-muted-foreground/70">No log entries</div>
        ) : (
          logs.map((entry) => {
            const meta = LEVEL_META[entry.level];
            const jumpable = Boolean(entry.path && onJump);
            return (
              <div key={entry.id} className="flex items-start gap-3 py-0.5">
                <span className="shrink-0 text-muted-foreground/70">
                  {entry.time}
                </span>
                <span
                  className={cn(
                    "w-11 shrink-0 font-medium uppercase",
                    meta.className,
                  )}
                >
                  {meta.label}
                </span>
                {jumpable ? (
                  <button
                    type="button"
                    title="Jump to field"
                    onClick={() => onJump?.(entry.path as string)}
                    className="min-w-0 cursor-pointer text-left break-all whitespace-pre-wrap text-foreground/90 underline-offset-2 hover:underline"
                  >
                    {entry.message}
                  </button>
                ) : (
                  <span className="min-w-0 break-all whitespace-pre-wrap text-foreground/90">
                    {entry.message}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
