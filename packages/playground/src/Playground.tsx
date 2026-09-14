import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BetterNormalizer, type Schema } from "@schema-ts/core";
import { createSimpleFieldRenderer } from "@schema-ts/react";
import { dump, load } from "js-yaml";
import { widgetRegistry } from "./widgets";
import {
  createXResourceEnumExtension,
  createXValidateValidator,
  XEnumExtension,
} from "@/extensions";
import { EditorPane } from "@/components/editor-pane";
import { LogPanel, type LogEntry } from "@/components/log-panel";
import {
  PreviewPane,
  type PreviewPaneHandle,
  type PreviewValidity,
} from "@/components/preview-pane";
import { StatusBar } from "@/components/status-bar";
import { TopBar } from "@/components/top-bar";
import { WorkbenchLayout } from "@/components/workbench-layout";
import { scrollToFieldPath } from "@/lib/field-navigation";
import { mockResourceLoader } from "@/lib/mock-resources";

export type Example = {
  name: string;
  schema: Schema;
  value: unknown;
};

function logTimestamp(): string {
  const now = new Date();
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

export const Playground = ({ examples }: { examples?: Example[] }) => {
  const previewRef = useRef<PreviewPaneHandle>(null);
  const [schemaStr, setSchemaStr] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [valid, setValid] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [selectedExampleName, setSelectedExampleName] = useState(() => {
    // ?example=Name deep-links to an example (also handy for screenshots).
    const fromUrl =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("example");
    if (fromUrl && examples?.some((example) => example.name === fromUrl)) {
      return fromUrl;
    }
    return examples ? examples[0].name : undefined;
  });
  const logIdRef = useRef(0);
  const lastLoadedRef = useRef<string | null>(null);

  const pushLog = useCallback(
    (level: LogEntry["level"], message: string, path?: string) => {
      setLogs((previous) =>
        [
          ...previous,
          {
            id: logIdRef.current++,
            time: logTimestamp(),
            level,
            message,
            path,
          },
        ].slice(-500),
      );
    },
    [],
  );

  useEffect(() => {
    if (!examples || !selectedExampleName) return;
    const example = examples.find((item) => item.name === selectedExampleName);
    if (!example) return;
    setSchemaStr(dump(example.schema));
    setValueStr(dump(example.value));
    // Guard against React StrictMode double-invoking effects (dev only).
    if (lastLoadedRef.current !== example.name) {
      lastLoadedRef.current = example.name;
      pushLog("info", `Loaded example: ${example.name}`);
    }
  }, [examples, selectedExampleName, pushLog]);

  const { schema, schemaError } = useMemo(() => {
    try {
      return { schema: load(schemaStr) as Schema, schemaError: null };
    } catch (error) {
      return {
        schema: null,
        schemaError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [schemaStr]);

  const { parsedValue, valueError } = useMemo(() => {
    try {
      return { parsedValue: load(valueStr), valueError: null };
    } catch (error) {
      return {
        parsedValue: {},
        valueError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [valueStr]);

  useEffect(() => {
    // Skip the transient empty state while an example is loading.
    if (schemaStr && schemaError)
      pushLog("error", `Schema parse error: ${schemaError}`);
  }, [schemaStr, schemaError, pushLog]);

  useEffect(() => {
    if (valueStr && valueError)
      pushLog("error", `Values parse error: ${valueError}`);
  }, [valueStr, valueError, pushLog]);

  const renderer = useMemo(
    () =>
      createSimpleFieldRenderer(widgetRegistry, [
        createXResourceEnumExtension({ load: mockResourceLoader }),
        XEnumExtension,
      ]),
    [],
  );
  const runtimeOptions = useMemo(
    () => ({
      schemaNormalizer: new BetterNormalizer({
        nonEmptyRequiredStrings: true,
      }),
    }),
    [],
  );
  const validator = useMemo(() => createXValidateValidator(), []);

  const handleChange = useCallback((next: unknown) => {
    setValueStr(dump(next));
  }, []);

  const handleValidationError = useCallback(
    ({ path, message }: { path: string; message: string }) => {
      pushLog("error", `Validation ${path || "/"}  ${message}`, path);
    },
    [pushLog],
  );

  const handleValidityChange = useCallback((validity: PreviewValidity) => {
    setValid(validity.valid);
    setErrorCount(validity.errorCount);
  }, []);

  const handleWidthChange = useCallback((width: number) => {
    setPreviewWidth(width);
  }, []);

  const handleSubmitResult = useCallback(
    (validity: PreviewValidity) => {
      setValid(validity.valid);
      setErrorCount(validity.errorCount);
      pushLog(
        validity.valid ? "success" : "error",
        validity.valid
          ? "Submit: form is valid"
          : `Submit: validation failed (${validity.errorCount} error${
              validity.errorCount === 1 ? "" : "s"
            })`,
      );
    },
    [pushLog],
  );

  return (
    <WorkbenchLayout
      topBar={
        <TopBar
          examples={examples}
          selectedExample={selectedExampleName}
          onSelectExample={setSelectedExampleName}
          onReset={() => examples && setSelectedExampleName(examples[0].name)}
        />
      }
      schema={
        <EditorPane
          title="JSON Schema"
          value={schemaStr}
          onChange={setSchemaStr}
          error={schemaError}
        />
      }
      values={
        <EditorPane
          title="Values"
          value={valueStr}
          onChange={setValueStr}
          error={valueError}
        />
      }
      preview={
        <PreviewPane
          ref={previewRef}
          schema={schema}
          value={parsedValue}
          render={renderer.render}
          runtimeOptions={runtimeOptions}
          validator={validator}
          formKey={selectedExampleName ?? "default"}
          onChange={handleChange}
          onValidationError={handleValidationError}
          onSubmit={handleSubmitResult}
          onValidityChange={handleValidityChange}
          onWidthChange={handleWidthChange}
        />
      }
      log={
        <LogPanel
          logs={logs}
          onClear={() => setLogs([])}
          onJump={scrollToFieldPath}
        />
      }
      statusBar={
        <StatusBar
          exampleName={selectedExampleName}
          valid={valid}
          errorCount={errorCount}
          previewWidth={previewWidth}
          logCount={logs.length}
          onGoToFirstError={() => previewRef.current?.scrollToFirstError()}
        />
      }
    />
  );
};
