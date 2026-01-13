import { useState, useEffect } from 'react';
import MonacoEditor from './components/MonacoEditor';
import PreviewPanel from './components/PreviewPanel';
import AgentChat from './components/AgentChat';

const STORAGE_KEYS = {
  EDITOR_CONTENT: 'auto_save_editor_content',
  MESSAGES: 'auto_save_messages',
  LAST_SAVE_TIME: 'auto_save_last_save_time'
};

function App() {
  const [editorContent, setEditorContent] = useState<string>(`\\documentclass{article}
\\usepackage{ctex}
\\title{学术论文智能写作系统}
\\author{作者}
\\date{\\today}
\\begin{document}
\\maketitle

\\section{引言}

这是引言部分，介绍研究背景和意义。

\\section{相关工作}

这是相关工作部分，介绍已有的研究成果。

\\section{方法}

这是方法部分，介绍研究方法和实验设计。

\\section{结论}

这是结论部分，总结研究成果和未来工作。

\\end{document}`);

  const [messages, setMessages] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [lastSaveTime, setLastSaveTime] = useState<string>('');
  const [hasAutoSave, setHasAutoSave] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ deepseek: boolean; qwen: boolean }>({ deepseek: false, qwen: false });
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const loadApiKey = (modelType: 'deepseek' | 'qwen'): string => {
    try {
      const savedApiKey = localStorage.getItem(`apiKey_${modelType}`);
      if (savedApiKey) {
        if (savedApiKey.length > 20 && /^[A-Za-z0-9+/]*={0,2}$/.test(savedApiKey)) {
          try {
            const decoded = atob(savedApiKey);
            if (decoded.startsWith('sk-') && decoded.length >= 32) {
              return decoded;
            }
          } catch (decodeError) {
            console.warn('Base64解码失败，可能是旧格式:', decodeError);
          }
        }
        
        if (savedApiKey.startsWith('sk-') && savedApiKey.length >= 32) {
          return savedApiKey;
        }
      }
    } catch (error) {
      console.error('加载API Key失败:', error);
    }
    return '';
  };

  const checkApiKeyStatus = (currentMessages: any[]) => {
    const deepseekKey = loadApiKey('deepseek');
    const qwenKey = loadApiKey('qwen');
    
    const status = {
      deepseek: deepseekKey.length > 0,
      qwen: qwenKey.length > 0
    };
    
    setApiKeyStatus(status);
    
    localStorage.setItem('apiKeyStatus', JSON.stringify(status));
    
    let statusMessage = '';
    if (!status.deepseek && !status.qwen) {
      statusMessage = '⚠️ 检测到未配置 API Key。请点击左侧面板的"配置 API Key"按钮来配置 DeepSeek 或 Qwen API Key，以便使用 AI 写作功能。';
    } else if (status.deepseek && !status.qwen) {
      statusMessage = '✅ 已检测到 DeepSeek API Key。您也可以配置 Qwen API Key 以获得更多选择。';
    } else if (!status.deepseek && status.qwen) {
      statusMessage = '✅ 已检测到 Qwen API Key。您也可以配置 DeepSeek API Key 以获得更多选择。';
    } else {
      statusMessage = '✅ 已检测到 DeepSeek 和 Qwen API Key，所有 AI 功能均可正常使用。';
    }
    
    const hasApiKeyCheckMessage = currentMessages.some((msg: any) => 
      msg.content.includes('检测到') && (msg.content.includes('API Key') || msg.content.includes('API Key'))
    );
    
    if (!hasApiKeyCheckMessage) {
      setMessages([...currentMessages, {
        role: 'agent',
        content: statusMessage
      }]);
    }
  };

  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEYS.EDITOR_CONTENT);
    const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    const savedTime = localStorage.getItem(STORAGE_KEYS.LAST_SAVE_TIME);
    const savedApiKeyStatus = localStorage.getItem('apiKeyStatus');

    let loadedMessages: any[] = [];

    if (savedContent) {
      setEditorContent(savedContent);
    }
    if (savedMessages) {
      try {
        loadedMessages = JSON.parse(savedMessages);
        setMessages(loadedMessages);
      } catch (error) {
        console.error('加载对话历史失败:', error);
      }
    }
    if (savedTime) {
      setLastSaveTime(savedTime);
      setHasAutoSave(true);
    }
    if (savedApiKeyStatus) {
      try {
        const status = JSON.parse(savedApiKeyStatus);
        setApiKeyStatus(status);
      } catch (error) {
        console.error('加载API Key状态失败:', error);
      }
    }
    
    checkApiKeyStatus(loadedMessages);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    const saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.EDITOR_CONTENT, editorContent);
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN');
      localStorage.setItem(STORAGE_KEYS.LAST_SAVE_TIME, timeStr);
      setLastSaveTime(timeStr);
      setHasAutoSave(true);
      setIsFadingOut(false);
      
      const fadeOutTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 10000);
      
      return () => clearTimeout(fadeOutTimer);
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [editorContent]);

  useEffect(() => {
    if (messages.length > 0 && isInitialized) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN');
      localStorage.setItem(STORAGE_KEYS.LAST_SAVE_TIME, timeStr);
      setLastSaveTime(timeStr);
    }
  }, [messages, isInitialized]);

  const clearAutoSave = () => {
    localStorage.removeItem(STORAGE_KEYS.EDITOR_CONTENT);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.LAST_SAVE_TIME);
    localStorage.removeItem('apiKeyStatus');
    setHasAutoSave(false);
    setLastSaveTime('');
  };

  return (
    <div className="three-panel-layout">
      {hasAutoSave && (
        <div className={`auto-save-status ${isFadingOut ? 'fade-out' : ''}`}>
          <span className="save-indicator">💾 自动保存</span>
          <span className="save-time">最后保存: {lastSaveTime}</span>
          <button className="clear-save-btn" onClick={clearAutoSave}>清除保存</button>
        </div>
      )}
      
      {/* 左侧预览面板 */}
      <PreviewPanel 
        content={editorContent}
        editorContent={editorContent}
        onUpdateContent={setEditorContent}
        messages={messages}
        setMessages={setMessages}
        onApiKeyChange={setApiKey}
        apiKeyStatus={apiKeyStatus}
      />
      
      {/* 中间编辑面板 */}
      <MonacoEditor 
        content={editorContent} 
        onChange={setEditorContent} 
      />
      
      {/* 右侧Agent对话面板 */}
      <AgentChat 
        editorContent={editorContent} 
        onUpdateContent={setEditorContent}
        messages={messages}
        setMessages={setMessages}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
      />
    </div>
  );
}

export default App;