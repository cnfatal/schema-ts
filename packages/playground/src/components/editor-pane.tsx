import { Editor } from "@/Editor";
import { Panel } from "@/components/panel";

export interface EditorPaneProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  lang?: "yaml" | "json";
}

/** A workbench editor pane with a parse-error footer. */
export function EditorPane({
  title,
  value,
  onChange,
  error,
  lang = "yaml",
}: EditorPaneProps) {
  return (
    <Panel
      title={title}
      actions={
        error ? (
          <span className="text-[11px] text-destructive">parse error</span>
        ) : null
      }
    >
      <div className="min-h-0 flex-1">
        <Editor value={value} onChange={onChange} lang={lang} />
      </div>
      {error ? (
        <div className="shrink-0 border-t bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </Panel>
  );
}
