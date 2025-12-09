import { Editor as MonacoEditor } from "@monaco-editor/react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
}

export const Editor = ({ value, onChange, lang = "yaml" }: EditorProps) => {
  return (
    <MonacoEditor
      value={value}
      onChange={(val) => onChange(val || "")}
      language={lang}
      height="100%"
      width="100%"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
};
