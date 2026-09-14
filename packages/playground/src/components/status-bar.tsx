export interface StatusBarProps {
  exampleName?: string;
  valid: boolean;
  errorCount: number;
  previewWidth: number;
  logCount: number;
  onGoToFirstError: () => void;
}

/** Bottom status bar: validity, preview width and log size. */
export function StatusBar({
  exampleName,
  valid,
  errorCount,
  previewWidth,
  logCount,
  onGoToFirstError,
}: StatusBarProps) {
  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{exampleName}</span>
        <span
          className={
            valid
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
          }
        >
          {valid
            ? "valid"
            : `${errorCount} error${errorCount === 1 ? "" : "s"}`}
        </span>
        {valid ? null : (
          <button
            type="button"
            className="hover:text-foreground"
            onClick={onGoToFirstError}
          >
            Go to first error
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>preview {previewWidth}px</span>
        <span>{logCount} log</span>
      </div>
    </footer>
  );
}
