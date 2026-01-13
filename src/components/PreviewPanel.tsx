import React, { useState, useEffect } from 'react';
import ApiKeyModal from './ApiKeyModal';
import ResourcePanel from './ResourcePanel';
import ErrorBoundary from './ErrorBoundary';
import { Reference, ImageResource, PdfResource } from '../services/resourceService';

interface PreviewPanelProps {
  content: string;
  editorContent?: string;
  onUpdateContent?: (content: string) => void;
  messages?: any[];
  setMessages?: (messages: any[]) => void;
  writingMode?: 'discuss' | 'write';
  model?: 'deepseek' | 'deepseek-reasoner' | 'qwen';
  onApiKeyChange?: (key: string) => void;
  apiKeyStatus?: { deepseek: boolean; qwen: boolean };
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface ToolHistoryEntry {
  id: string;
  timestamp: string;
  tool_name: string;
  parameters: Record<string, any>;
  result: ToolResult;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  content, 
  editorContent = '',
  onUpdateContent,
  messages = [],
  setMessages,
  writingMode = 'discuss',
  model = 'deepseek',
  onApiKeyChange,
  apiKeyStatus = { deepseek: false, qwen: false }
}) => {
  const [showToolHistory, setShowToolHistory] = useState<boolean>(false);
  const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [chatSessionName, setChatSessionName] = useState<string>('');
  const [activePanel, setActivePanel] = useState<'preview' | 'resources'>('preview');

  const handleApiKeySaved = (modelType: 'deepseek' | 'qwen', key: string) => {
    if (onApiKeyChange) {
      onApiKeyChange(key);
    }
    if (setMessages) {
      setMessages([...messages, {
        role: 'agent',
        content: `已保存${modelType === 'deepseek' ? 'DeepSeek' : 'Qwen'} API Key配置`
      }]);
    }
  };

  useEffect(() => {
    const savedToolHistory = localStorage.getItem('toolHistory');
    if (savedToolHistory) {
      try {
        const parsedToolHistory = JSON.parse(savedToolHistory);
        setToolHistory(parsedToolHistory);
      } catch (error) {
        console.warn('加载工具历史记录失败:', error);
      }
    }
  }, []);

  const saveChatHistory = () => {
    try {
      const chatData = {
        sessionName: chatSessionName || `聊天记录_${new Date().toLocaleString('zh-CN')}`,
        messages: messages,
        timestamp: new Date().toISOString(),
        model: model,
        writingMode: writingMode
      };
      
      const dataStr = JSON.stringify(chatData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chatData.sessionName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: `聊天记录已保存为 ${chatData.sessionName}.json`
        }]);
      }
    } catch (error) {
      console.error('保存聊天记录失败:', error);
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: `保存聊天记录失败：${error instanceof Error ? error.message : '未知错误'}`
        }]);
      }
    }
  };

  const clearChatHistory = () => {
    if (window.confirm('确定要清空所有聊天记录吗？')) {
      if (setMessages) {
        setMessages([{
          role: 'agent',
          content: '聊天记录已清空，欢迎重新开始！'
        }]);
      }
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('chatSessionName');
      setChatSessionName('');
    }
  };

  const clearToolHistory = () => {
    if (window.confirm('确定要清空所有工具使用历史吗？')) {
      setToolHistory([]);
      localStorage.removeItem('toolHistory');
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: '工具使用历史已清空'
        }]);
      }
    }
  };

  const saveLatexFile = () => {
    try {
      const latexContent = editorContent || content;
      if (!latexContent.trim()) {
        if (setMessages) {
          setMessages([...messages, {
            role: 'agent',
            content: '没有可保存的LaTeX内容'
          }]);
        }
        return;
      }
      
      const blob = new Blob([latexContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `paper_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.tex`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: 'LaTeX文件已保存'
        }]);
      }
    } catch (error) {
      console.error('保存LaTeX文件失败:', error);
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: `保存LaTeX文件失败：${error instanceof Error ? error.message : '未知错误'}`
        }]);
      }
    }
  };

  const openLatexFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tex,.txt,.latex';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const fileContent = e.target?.result as string;
            if (onUpdateContent) {
              onUpdateContent(fileContent);
            }
            if (setMessages) {
              setMessages([...messages, {
                role: 'agent',
                content: `已打开文件：${file.name}`
              }]);
            }
          } catch (error) {
            console.error('读取文件失败:', error);
            if (setMessages) {
              setMessages([...messages, {
                role: 'agent',
                content: `读取文件失败：${error instanceof Error ? error.message : '未知错误'}`
              }]);
            }
          }
        };
        reader.onerror = () => {
          if (setMessages) {
            setMessages([...messages, {
              role: 'agent',
              content: '文件读取错误'
            }]);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const getPlainText = (latex: string): string => {
    return latex
      .replace(/\\begin{document}/g, '')
      .replace(/\\end{document}/g, '')
      .replace(/\\section{[^}]+}/g, (match) => `\n\n# ${match.replace(/\\section{([^}]+)}/, '$1')}\n`)
      .replace(/\\subsection{[^}]+}/g, (match) => `\n## ${match.replace(/\\subsection{([^}]+)}/, '$1')}\n`)
      .replace(/\\subsubsection{[^}]+}/g, (match) => `\n### ${match.replace(/\\subsubsection{([^}]+)}/, '$1')}\n`)
      .replace(/\\title{[^}]+}/g, '')
      .replace(/\\author{[^}]+}/g, '')
      .replace(/\\date{[^}]+}/g, '')
      .replace(/\\maketitle/g, '')
      .replace(/\\usepackage{[^}]+}/g, '')
      .replace(/\\documentclass{[^}]+}/g, '')
      .trim();
  };

  const handleInsertReference = (reference: Reference) => {
    const citation = `\\cite{${reference.citationKey}}`;
    if (onUpdateContent) {
      onUpdateContent(editorContent + '\n' + citation);
    }
    if (setMessages) {
      setMessages([...messages, {
        role: 'agent',
        content: `已插入引用：[${reference.citationKey}] ${reference.title}`
      }]);
    }
  };

  const handleInsertImage = (image: ImageResource) => {
    const imageCode = `
\\begin{figure}[htbp]
  \\centering
  \\includegraphics[width=0.8\\textwidth]{${image.name}}
  \\caption{${image.description || image.name}}
  \\label{fig:${image.id}}
\\end{figure}`;
    if (onUpdateContent) {
      onUpdateContent(editorContent + imageCode);
    }
    if (setMessages) {
      setMessages([...messages, {
        role: 'agent',
        content: `已插入图片：${image.name}`
      }]);
    }
  };

  const handleInsertPdf = (pdf: PdfResource) => {
    const citation = `\\cite{${pdf.name.replace('.pdf', '')}}`;
    if (onUpdateContent) {
      onUpdateContent(editorContent + '\n' + citation);
    }
    if (setMessages) {
      setMessages([...messages, {
        role: 'agent',
        content: `已插入PDF引用：${pdf.name}`
      }]);
    }
  };

  return (
    <div className="panel preview-panel">
      <div className="preview-content-wrapper">
        {/* 工具栏触发区域 */}
        <div className="toolbar-trigger-zone" />
        
        {/* 左侧浮动工具栏 */}
        <div className="left-toolbar">
          <div className="toolbar-buttons">
              <button 
                onClick={() => setShowApiKeyModal(true)}
                className="toolbar-btn"
                title="配置API Key"
              >
                <span className="btn-icon">🔑</span>
                <span className="btn-text">配置API</span>
                <span className="api-status-indicators">
                  {apiKeyStatus.deepseek && <span className="status-dot deepseek" title="DeepSeek API Key 已配置">●</span>}
                  {apiKeyStatus.qwen && <span className="status-dot qwen" title="Qwen API Key 已配置">●</span>}
                  {!apiKeyStatus.deepseek && !apiKeyStatus.qwen && <span className="status-dot none" title="未配置 API Key">○</span>}
                </span>
              </button>
              <button 
                onClick={saveChatHistory}
                className="toolbar-btn"
                title="保存聊天记录"
              >
                <span className="btn-icon">💾</span>
                <span className="btn-text">保存记录</span>
              </button>
              <button 
                onClick={clearChatHistory}
                className="toolbar-btn"
                title="清空聊天记录"
              >
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">清空记录</span>
              </button>
              <button 
                onClick={saveLatexFile}
                className="toolbar-btn"
                title="保存LaTeX文件"
              >
                <span className="btn-icon">📄</span>
                <span className="btn-text">保存文件</span>
              </button>
              <button 
                onClick={openLatexFile}
                className="toolbar-btn"
                title="打开LaTeX文件"
              >
                <span className="btn-icon">📂</span>
                <span className="btn-text">打开文件</span>
              </button>
              <button 
                onClick={() => setShowToolHistory(!showToolHistory)}
                className="toolbar-btn"
                title="查看工具使用历史"
              >
                <span className="btn-icon">🔧</span>
                <span className="btn-text">工具历史</span>
              </button>
              <button 
                onClick={clearToolHistory}
                className="toolbar-btn"
                title="清空工具历史"
              >
                <span className="btn-icon">🧹</span>
                <span className="btn-text">清空历史</span>
              </button>
            </div>
        </div>
        
        {/* 悬浮提示 */}
        <div className="toolbar-hover-hint" />
        
        {/* 右侧预览内容区域 */}
        <div className="preview-main-content">
          <div className="panel-tabs">
            <button 
              className={`panel-tab ${activePanel === 'preview' ? 'active' : ''}`}
              onClick={() => setActivePanel('preview')}
            >
              👁️ 预览
            </button>
            <button 
              className={`panel-tab ${activePanel === 'resources' ? 'active' : ''}`}
              onClick={() => setActivePanel('resources')}
            >
              📚 资源
            </button>
          </div>

          {activePanel === 'preview' && (
            <>
              <h2 className="panel-title">预览</h2>
              
              {/* 工具历史记录 */}
              {showToolHistory && (
                <div className="tool-history-panel">
                  <div className="tool-history-header">
                    <h3>工具使用历史</h3>
                    <button 
                      onClick={() => setShowToolHistory(false)}
                      className="close-btn"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="tool-history-content">
                    {toolHistory.length === 0 ? (
                      <div className="empty-history">暂无工具使用记录</div>
                    ) : (
                      toolHistory.map((entry) => (
                        <div key={entry.id} className="tool-history-entry">
                          <div className="entry-header">
                            <span className="entry-tool-name">🔧 {entry.tool_name}</span>
                            <span className="entry-timestamp">
                              {new Date(entry.timestamp).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="entry-params">
                            <strong>参数：</strong>
                            <pre>{JSON.stringify(entry.parameters, null, 2)}</pre>
                          </div>
                          <div className={`entry-result ${entry.result.success ? 'success' : 'error'}`}>
                            <strong>结果：</strong>
                            {entry.result.success ? '✅ 成功' : '❌ 失败'}
                            {entry.result.data && (
                              <pre>{JSON.stringify(entry.result.data, null, 2)}</pre>
                            )}
                            {entry.result.error && (
                              <div className="result-error">错误：{entry.result.error}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              {/* 预览内容 */}
              <div className="preview-content">
                <pre>{getPlainText(content)}</pre>
              </div>
            </>
          )}

          {activePanel === 'resources' && (
            <ErrorBoundary>
              <ResourcePanel
                onInsertReference={handleInsertReference}
                onInsertImage={handleInsertImage}
                onInsertPdf={handleInsertPdf}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
      
      {/* API Key配置弹窗 */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onApiKeySaved={handleApiKeySaved}
      />
    </div>
  );
};

export default PreviewPanel;
