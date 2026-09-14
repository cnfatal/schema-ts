import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "cn";

export interface SplitPaneProps {
  /** Main pane: left for horizontal splits, top for vertical splits. */
  primary: ReactNode;
  /** Secondary pane: right/bottom. */
  secondary: ReactNode;
  /** horizontal = side by side (resize width); vertical = stacked (resize height). */
  direction?: "horizontal" | "vertical";
  /** Initial size of the primary pane, as a percentage. */
  defaultSize?: number;
  minPrimary?: number;
  minSecondary?: number;
  /** Persist the split size under this localStorage key. */
  storageKey?: string;
  className?: string;
}

const DIVIDER = 12;

/**
 * Two-pane split with a VS Code style sash: a 1px line that highlights on
 * hover/drag, with a three-dot grip. Supports pointer drag, arrow keys and
 * Home/End, and optionally remembers the size across reloads.
 */
export function SplitPane({
  primary,
  secondary,
  direction = "horizontal",
  defaultSize = 40,
  minPrimary = 160,
  minSecondary = 220,
  storageKey,
  className,
}: SplitPaneProps) {
  const isX = direction === "horizontal";
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0 && stored < 100) return stored;
    }
    return defaultSize;
  });

  const clamp = useCallback(
    (percent: number) => {
      const element = containerRef.current;
      if (!element) return percent;
      const total = isX ? element.clientWidth : element.clientHeight;
      if (total <= minPrimary + minSecondary + DIVIDER) return percent;
      const min = (minPrimary / total) * 100;
      const max = ((total - minSecondary - DIVIDER) / total) * 100;
      return Math.min(Math.max(percent, min), max);
    },
    [isX, minPrimary, minSecondary],
  );

  const updateFromPointer = useCallback(
    (event: PointerEvent) => {
      const element = containerRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const percent = isX
        ? ((event.clientX - rect.left) / rect.width) * 100
        : ((event.clientY - rect.top) / rect.height) * 100;
      setSize(clamp(percent));
    },
    [clamp, isX],
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const stop = () => setDragging(false);
    window.addEventListener("pointermove", updateFromPointer);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", updateFromPointer);
      window.removeEventListener("pointerup", stop);
    };
  }, [dragging, updateFromPointer]);

  useEffect(() => {
    if (storageKey) window.localStorage.setItem(storageKey, String(size));
  }, [size, storageKey]);

  const startDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
    updateFromPointer(event.nativeEvent);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 2;
    const decrease = isX ? "ArrowLeft" : "ArrowUp";
    const increase = isX ? "ArrowRight" : "ArrowDown";
    if (event.key === decrease) {
      event.preventDefault();
      setSize((value) => clamp(value - step));
    } else if (event.key === increase) {
      event.preventDefault();
      setSize((value) => clamp(value + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setSize((value) => clamp(value - 100));
    } else if (event.key === "End") {
      event.preventDefault();
      setSize((value) => clamp(value + 100));
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        isX ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flexBasis: `${size}%`, flexGrow: 0, flexShrink: 0 }}
      >
        {primary}
      </div>

      <div
        role="separator"
        aria-orientation={isX ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(size)}
        tabIndex={0}
        title="Drag to resize"
        onPointerDown={startDragging}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative flex shrink-0 items-center justify-center outline-none",
          isX ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize",
          // 1px sash line, always visible, accent on hover/drag (VS Code).
          "before:absolute before:bg-border before:transition-colors before:content-['']",
          isX
            ? "before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2"
            : "before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2",
          dragging
            ? "before:bg-primary"
            : "hover:before:bg-primary focus-visible:before:bg-primary",
        )}
      >
        {/* Three-dot grip, shown on hover/drag. */}
        <span
          className={cn(
            "absolute z-10 flex items-center justify-center gap-0.5 rounded-sm border border-border bg-card p-0.5 shadow-sm transition-colors",
            isX ? "flex-col" : "flex-row",
            dragging
              ? "border-primary"
              : "group-hover:border-primary/60 group-focus-visible:border-primary/60",
          )}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={cn(
                "size-[3px] rounded-full",
                dragging ? "bg-primary" : "bg-muted-foreground",
              )}
            />
          ))}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {secondary}
      </div>
    </div>
  );
}
