import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import type {
  Schema,
  SchemaChangeEvent,
  SchemaRuntimeOptions,
  Validator,
} from "@schema-ts/core";
import {
  Form,
  type FormFieldRenderProps,
  type FormHandle,
} from "@schema-ts/react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  countErrors,
  findFirstErrorPath,
  firstErrorMessage,
  scrollToFieldPath,
} from "@/lib/field-navigation";

export interface PreviewValidity {
  valid: boolean;
  errorCount: number;
}

export interface PreviewPaneHandle {
  /** Scroll to the first field with an error and highlight it. */
  scrollToFirstError: (options?: ScrollIntoViewOptions) => void;
}

export interface PreviewPaneProps {
  schema: Schema | null;
  value: unknown;
  render: (props: FormFieldRenderProps) => ReactNode;
  runtimeOptions?: SchemaRuntimeOptions;
  /** Custom validator (e.g. cross-field rules) passed to the form. */
  validator?: Validator;
  /** Remounts the form when this changes (e.g. the selected example). */
  formKey?: string;
  onChange?: (value: unknown) => void;
  /** Called when a field reports (or changes) a validation error. */
  onValidationError?: (error: { path: string; message: string }) => void;
  onSubmit?: (validity: PreviewValidity) => void;
  onValidityChange?: (validity: PreviewValidity) => void;
  onWidthChange?: (width: number) => void;
}

/**
 * The form preview region: renders the schema form, validates on submit,
 * scrolls to the first error, and reports validity/width to the workbench.
 */
export const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(
  function PreviewPane(
    {
      schema,
      value,
      render,
      runtimeOptions,
      validator,
      formKey,
      onChange,
      onValidationError,
      onSubmit,
      onValidityChange,
      onWidthChange,
    },
    ref,
  ) {
    const formRef = useRef<FormHandle>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    const readValidity = useCallback((): PreviewValidity => {
      const runtime = formRef.current?.getRuntime();
      const errorCount = runtime ? countErrors(runtime.root) : 0;
      return { valid: errorCount === 0, errorCount };
    }, []);

    useEffect(() => {
      const element = bodyRef.current;
      if (!element) return undefined;
      onWidthChange?.(Math.round(element.getBoundingClientRect().width));
      const observer = new ResizeObserver((entries) => {
        onWidthChange?.(Math.round(entries[0]?.contentRect.width ?? 0));
      });
      observer.observe(element);
      return () => observer.disconnect();
    }, [onWidthChange]);

    const scrollToFirstError = useCallback(
      (options?: ScrollIntoViewOptions) => {
        const runtime = formRef.current?.getRuntime();
        const first = runtime ? findFirstErrorPath(runtime.root) : undefined;
        if (first && scrollToFieldPath(first)) return;
        formRef.current?.scrollToFirstError(
          options ?? { behavior: "smooth", block: "center" },
        );
      },
      [],
    );

    useImperativeHandle(ref, () => ({ scrollToFirstError }), [
      scrollToFirstError,
    ]);

    const handleEvent = useCallback(
      (event: SchemaChangeEvent) => {
        if (event.type !== "error") return;
        const runtime = formRef.current?.getRuntime();
        const message = firstErrorMessage(runtime?.getNode(event.path)?.error);
        if (message) onValidationError?.({ path: event.path, message });
        onValidityChange?.(readValidity());
      },
      [onValidationError, onValidityChange, readValidity],
    );

    const handleSubmit = () => {
      const handle = formRef.current;
      if (!handle) return;
      const valid = handle.validate();
      onSubmit?.({ ...readValidity(), valid });
      if (!valid) scrollToFirstError();
    };

    return (
      <Panel title="Preview">
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-auto bg-muted/20 p-5"
        >
          {schema ? (
            <>
              <Form
                key={formKey}
                ref={formRef}
                schema={schema}
                value={value}
                onChange={onChange}
                render={render}
                runtimeOptions={runtimeOptions}
                validator={validator}
                onEvent={handleEvent}
              />
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <span className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> required
                </span>
                <Button onClick={handleSubmit}>Submit</Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Provide a valid JSON Schema to see the UI
            </div>
          )}
        </div>
      </Panel>
    );
  },
);
