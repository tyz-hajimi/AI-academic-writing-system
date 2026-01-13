import React from 'react';
import Editor from '@monaco-editor/react';

interface MonacoEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ content, onChange }) => {
  // 编辑器配置
  const editorOptions = {
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    automaticLayout: true,
    tabSize: 2,
    theme: 'vs-light' as const,
  };

  return (
    <div className="panel editor-panel">
      <h3 className="panel-title">编辑区</h3>
      <div className="editor-container">
        <Editor
          height="100%"
          language="latex"
          value={content}
          onChange={(value) => onChange(value || '')}
          options={editorOptions}
        />
      </div>
    </div>
  );
};

export default MonacoEditor;