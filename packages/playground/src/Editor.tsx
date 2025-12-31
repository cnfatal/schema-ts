import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { indentWithTab } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import styled from "@emotion/styled";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  lang?: "yaml" | "json";
}

const EditorWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;

  .cm-theme-light,
  .cm-theme-dark {
    height: 100%;
  }

  .cm-editor {
    height: 100% !important;
  }

  .cm-scroller {
    font-family: "Menlo", "Monaco", "Courier New", monospace;
    font-size: 14px;
    overflow: auto !important;
  }
`;

export const Editor = ({ value, onChange, lang = "yaml" }: EditorProps) => {
  const extensions = [keymap.of([indentWithTab])];
  if (lang === "yaml") {
    extensions.push(yaml());
  } else if (lang === "json") {
    extensions.push(json());
  }

  return (
    <EditorWrapper>
      <CodeMirror
        value={value}
        height="100%"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
        extensions={extensions}
        onChange={(val) => onChange(val)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
      />
    </EditorWrapper>
  );
};
