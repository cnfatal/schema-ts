import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useTheme } from "@/components/theme";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  lang?: "yaml" | "json";
}

/** CodeMirror editor using the official VS Code color themes. */
export const Editor = ({ value, onChange, lang = "yaml" }: EditorProps) => {
  const { resolved } = useTheme();
  const extensions = [keymap.of([indentWithTab])];
  if (lang === "yaml") {
    extensions.push(yaml());
  } else if (lang === "json") {
    extensions.push(json());
  }

  return (
    <div className={cnEditor}>
      <CodeMirror
        value={value}
        height="100%"
        theme={resolved === "dark" ? vscodeDark : vscodeLight}
        extensions={extensions}
        onChange={(val) => onChange(val)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
      />
    </div>
  );
};

const cnEditor = [
  "h-full min-h-0 overflow-hidden",
  "[&_.cm-theme]:h-full",
  "[&_.cm-editor]:h-full",
  "[&_.cm-scroller]:overflow-auto",
  "[&_.cm-scroller]:font-mono [&_.cm-scroller]:text-[13px]",
].join(" ");
