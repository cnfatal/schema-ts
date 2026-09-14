import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleHelp, List, Search } from "lucide-react";
import { defineExtension, type WidgetProps } from "@schema-ts/react";

export interface ResourceOption {
  id: string;
  label: string;
  description?: string;
  /** Optional Tailwind gradient classes for a mock thumbnail. */
  tone?: string;
}

export interface ResourceQuery {
  /** Resource kind from the schema, e.g. "image", "flavor", "model". */
  resource: string;
  /** Optional resource-specific selector, e.g. "cpu,gpu". */
  type?: string;
}

/** App-provided loader. May be async (e.g. a remote resource call). */
export type ResourceLoader = (
  query: ResourceQuery,
) => ResourceOption[] | Promise<ResourceOption[]>;

export interface XResourceEnumExtensionOptions {
  /** Maps a resource kind (+ optional type filter) to options. */
  load: ResourceLoader;
  /** How long to wait before committing free-form input, in ms. */
  debounceMs?: number;
  /** Schema keyword to match. Defaults to `x-resource-enum`. */
  keyword?: string;
}

export interface XResourceEnumWidgetProps extends WidgetProps {
  load: ResourceLoader;
  resourceKind: string;
  query: { type?: string };
  debounceMs: number;
}

function titleFor(kind: string): string {
  return (
    "Select " +
    (kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Resource")
  );
}

function OptionThumb({ option }: { option: ResourceOption }) {
  const tone = option.tone ?? "from-zinc-400 to-zinc-600";
  return (
    <span
      className={
        "flex size-8 shrink-0 items-center justify-center rounded bg-gradient-to-br text-xs font-bold text-white " +
        tone
      }
    >
      {option.label.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Searchable dialog resource picker keyed on `x-resource-enum`.
 *
 * The field stays free-form editable; the link icon opens a searchable dialog
 * whose options come from the app-provided `load` function. The same widget
 * serves images, flavors, models, or any custom resource.
 *
 * ```json
 * { "type": "string", "x-resource-enum": { "resource": "flavor", "type": "cpu,gpu" } }
 * ```
 */
function XResourceEnumWidget({
  label,
  description,
  value,
  onChange,
  error,
  required,
  disabled,
  fieldRef,
  instanceLocation,
  load,
  resourceKind,
  query,
  debounceMs,
}: XResourceEnumWidgetProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(typeof value === "string" ? value : "");
  const commitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const filterType = query?.type;

  useEffect(() => {
    setDraft(typeof value === "string" ? value : "");
  }, [value]);

  useEffect(
    () => () => {
      clearTimeout(commitTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    Promise.resolve(load({ resource: resourceKind, type: filterType }))
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setOptions([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, load, resourceKind, filterType]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return options;
    return options.filter((option) =>
      (option.id + " " + option.label + " " + (option.description ?? ""))
        .toLowerCase()
        .includes(text),
    );
  }, [options, search]);

  const commitNow = (next: string) => {
    clearTimeout(commitTimer.current);
    setDraft(next);
    onChange(next);
  };

  const handleInput = (next: string) => {
    setDraft(next);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => onChange(next), debounceMs);
  };

  return (
    <div
      ref={(element) => fieldRef?.(element)}
      data-field-path={instanceLocation}
      className="flex min-w-0 flex-col gap-1.5"
    >
      {label || description ? (
        <span className="flex items-center gap-1">
          {label ? (
            <label className="text-sm leading-none font-medium text-foreground">
              {label}
              {required ? (
                <span className="ml-0.5 text-destructive">*</span>
              ) : null}
            </label>
          ) : null}
          {description ? (
            <span
              title={description}
              aria-label="Field description"
              className="inline-flex text-muted-foreground/70 hover:text-foreground"
            >
              <CircleHelp className="size-3.5" />
            </span>
          ) : null}
        </span>
      ) : null}

      <div className="relative">
        <input
          value={draft}
          disabled={disabled}
          aria-invalid={!!error}
          placeholder="Enter a value or pick from the list"
          onChange={(event) => handleInput(event.target.value)}
          onBlur={() => {
            clearTimeout(commitTimer.current);
            if (draft !== value) onChange(draft);
          }}
          className="h-9 w-full rounded-md border border-input bg-transparent pr-9 pl-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled}
          title={titleFor(resourceKind)}
          aria-label={titleFor(resourceKind)}
          onClick={() => setOpen(true)}
          className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <List className="size-4" />
        </button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
              onClick={() => setOpen(false)}
            >
              <div
                className="mt-16 w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-2 border-b border-border p-3">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={search}
                    placeholder="Search..."
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-8 w-full bg-transparent text-sm outline-none"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {titleFor(resourceKind)}
                  </span>
                </div>
                <div className="max-h-72 overflow-auto p-1">
                  {loading ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      Loading...
                    </p>
                  ) : filtered.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No matches
                    </p>
                  ) : (
                    filtered.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          commitNow(option.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      >
                        <OptionThumb option={option} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {option.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.id}
                            {option.description
                              ? " · " + option.description
                              : ""}
                          </span>
                        </span>
                        {option.id === draft ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function createXResourceEnumExtension(
  options: XResourceEnumExtensionOptions,
) {
  const keyword = options.keyword ?? "x-resource-enum";
  const debounceMs = options.debounceMs ?? 300;
  return defineExtension<XResourceEnumWidgetProps>(
    "x-resource-enum",
    XResourceEnumWidget,
    {
      matcher: (props, base) => {
        const raw = props.schema[keyword];
        if (!raw) return undefined;
        const config = (typeof raw === "object" ? raw : {}) as {
          resource?: string;
          type?: string;
        };
        return {
          ...base,
          load: options.load,
          resourceKind: config.resource ?? "unknown",
          query: { type: config.type },
          debounceMs,
        };
      },
    },
  );
}
