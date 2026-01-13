import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { agentService } from '../services/agentService';

interface AgentChatProps {
  editorContent: string;
  onUpdateContent: (content: string) => void;
  messages?: Message[];
  setMessages?: (messages: Message[]) => void;
  apiKey?: string;
  onApiKeyChange?: (key: string) => void;
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  reasoning?: string;  // DeepSeek Reasoner 的思考过程
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  isStreaming?: boolean;
}

interface ToolCall {
  tool_name: string;
  parameters: Record<string, any>;
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

const AgentChat: React.FC<AgentChatProps> = ({ 
  editorContent, 
  onUpdateContent,
  messages = [],
  setMessages
}) => {
  const [input, setInput] = useState<string>('');
  const [writingMode, setWritingMode] = useState<'discuss' | 'write'>('discuss');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [model, setModel] = useState<'deepseek' | 'deepseek-reasoner' | 'qwen'>('deepseek');
  const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>([]);
  const [showToolHistory, setShowToolHistory] = useState<boolean>(false);
  const [currentApiKey, setCurrentApiKey] = useState<string>('');
  const [expandedToolResults, setExpandedToolResults] = useState<Record<string, boolean>>({});
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});

  const loadApiKey = (modelType: 'deepseek' | 'deepseek-reasoner' | 'qwen'): string => {
    try {
      const storageKey = modelType === 'deepseek-reasoner' ? 'deepseek' : modelType;
      const savedApiKey = localStorage.getItem(`apiKey_${storageKey}`);
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

  useEffect(() => {
    const loadedKey = loadApiKey(model);
    setCurrentApiKey(loadedKey);
  }, [model]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!currentApiKey.trim()) {
      if (setMessages) {
        setMessages([...messages, {
          role: 'agent',
          content: '请先配置API Key'
        }]);
      }
      return;
    }

    let currentEditorContent = editorContent;
    
    // 添加用户消息
    const userMessage: Message = { role: 'user', content: input };
    let updatedMessages = [...messages, userMessage];
    if (setMessages) {
      setMessages(updatedMessages);
    }
    setInput('');
    setIsLoading(true);

    try {
      const MAX_TOOL_ITERATIONS = 10;
      let iterationCount = 0;
      
      // DeepSeek 和 DeepSeek Reasoner 使用流式输出
      // Qwen 使用普通输出
      const useStreaming = model === 'deepseek' || model === 'deepseek-reasoner';
      
      // 发送初始请求
      let agentResponse = await sendAgentRequest(
        currentEditorContent, 
        input, 
        updatedMessages, 
        useStreaming,
        (newMessages) => {
          updatedMessages = newMessages;
          if (setMessages) setMessages(newMessages);
        }
      );
      
      // 处理工具调用循环（每次只处理一个工具）
      while (agentResponse.tool_calls && agentResponse.tool_calls.length > 0 && iterationCount < MAX_TOOL_ITERATIONS) {
        iterationCount++;
        
        // 只取第一个工具调用（后端已确保只返回一个）
        const toolCall = agentResponse.tool_calls[0];
        console.log(`[AgentChat] 工具调用迭代 ${iterationCount}: ${toolCall.tool_name}`);
        
        // 更新最后一条消息的工具调用信息
        const lastIndex = updatedMessages.length - 1;
        if (updatedMessages[lastIndex]?.role === 'agent') {
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            tool_calls: [toolCall]
          };
          if (setMessages) setMessages([...updatedMessages]);
        }
        
        // 执行单个工具调用（带超时）
        const TOOL_TIMEOUT = 30000; // 30秒超时
        let result: ToolResult;
        
        try {
          console.log(`[AgentChat] 执行工具: ${toolCall.tool_name}`);
          
          result = await Promise.race([
            agentService.executeToolCall(
              toolCall.tool_name,
              toolCall.parameters,
              currentEditorContent
            ),
            new Promise<ToolResult>((_, reject) => 
              setTimeout(() => reject(new Error(`工具 ${toolCall.tool_name} 执行超时 (${TOOL_TIMEOUT/1000}秒)`)), TOOL_TIMEOUT)
            )
          ]);
          
          console.log(`[AgentChat] 工具 ${toolCall.tool_name} 执行完成:`, result.success ? '成功' : '失败');
        } catch (error) {
          console.error(`[AgentChat] 工具 ${toolCall.tool_name} 执行失败:`, error);
          result = {
            success: false,
            error: error instanceof Error ? error.message : '工具执行失败'
          };
        }
        
        // 如果是编辑文件工具，更新编辑器内容
        if (result.success && toolCall.tool_name === 'edit_file' && result.data?.content) {
          currentEditorContent = result.data.content;
          onUpdateContent(currentEditorContent);
        }
        
        // 创建工具历史记录
        const historyEntry: ToolHistoryEntry = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          tool_name: toolCall.tool_name,
          parameters: toolCall.parameters,
          result: result
        };
        
        const toolResults = [result];
        const newToolHistoryEntries = [historyEntry];
        
        // 保存工具历史
        if (newToolHistoryEntries.length > 0) {
          setToolHistory(prev => [...prev, ...newToolHistoryEntries]);
        }
        
        // 更新最后一条消息的工具结果
        if (updatedMessages[lastIndex]?.role === 'agent') {
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            tool_results: toolResults
          };
          if (setMessages) setMessages([...updatedMessages]);
        }
        
        // 发送后续请求，让AI根据工具结果继续回答
        // 根据工具类型格式化结果
        let formattedResult: any = {
          tool: toolCall.tool_name,
          success: result.success,
          error: result.success ? undefined : result.error
        };
        
        if (result.success && result.data) {
          // 针对不同工具类型，提供完整的关键信息
          if (toolCall.tool_name === 'search_papers' && result.data.papers) {
            // 搜索论文：显示完整的论文信息，包括 arxiv_id（下载必需）
            formattedResult.count = result.data.count;
            formattedResult.papers = result.data.papers.map((p: any) => ({
              arxiv_id: p.arxiv_id,  // 关键：下载需要这个ID
              title: p.title,
              authors: p.authors?.slice(0, 3).join(', ') + (p.authors?.length > 3 ? '等' : ''),
              published: p.published?.split('T')[0],
              abstract: p.abstract?.substring(0, 200) + '...'
            }));
          } else if (toolCall.tool_name === 'download_paper') {
            // 下载论文：显示下载结果
            formattedResult.message = result.data.message;
            formattedResult.filename = result.data.filename;
            formattedResult.resource_id = result.data.resource_id;
          } else if (toolCall.tool_name === 'read_pdf_content') {
            // 读取PDF：显示完整文本内容（AI需要分析全文）
            formattedResult.name = result.data.name;
            formattedResult.text_length = result.data.text?.length || 0;
            formattedResult.text_stats = result.data.text_stats;
            // 完整文本，但限制最大长度避免超出 token 限制
            const MAX_TEXT_LENGTH = 40000; // 约 13000 个中文字或 40000 英文字符
            if (result.data.text && result.data.text.length > MAX_TEXT_LENGTH) {
              formattedResult.text = result.data.text.substring(0, MAX_TEXT_LENGTH);
              formattedResult.truncated = true;
              formattedResult.truncated_message = `文本过长，已截取前 ${MAX_TEXT_LENGTH} 字符（共 ${result.data.text.length} 字符）`;
            } else {
              formattedResult.text = result.data.text;
              formattedResult.truncated = false;
            }
          } else if (toolCall.tool_name === 'list_resources') {
            // 列出资源：显示资源列表
            formattedResult.count = result.data.count;
            formattedResult.resources = result.data.resources?.map((r: any) => ({
              id: r.id,
              name: r.name,
              type: result.data.resource_type
            }));
          } else {
            // 其他工具：显示完整数据（限制长度）
            formattedResult.data = result.data;
          }
        }
        
        const followUpInput = `工具 "${toolCall.tool_name}" 执行结果：\n${JSON.stringify(formattedResult, null, 2)}\n\n请基于工具执行结果继续回答用户的问题。如果需要下载论文，请使用论文的 arxiv_id 调用 download_paper 工具。每次只能调用一个工具。`;
        
        console.log(`[AgentChat] 发送后续请求...`);
        
        agentResponse = await sendAgentRequest(
          currentEditorContent,
          followUpInput,
          updatedMessages,
          useStreaming,
          (newMessages) => {
            updatedMessages = newMessages;
            if (setMessages) setMessages(newMessages);
          }
        );
        
        console.log(`[AgentChat] 后续请求完成，新工具调用: ${agentResponse.tool_calls?.length || 0}`);
      }
      
      // 如果是撰写模式，将AI回复添加到编辑器
      const lastMessage = updatedMessages[updatedMessages.length - 1];
      if (writingMode === 'write' && lastMessage?.role === 'agent' && lastMessage.content) {
        onUpdateContent(currentEditorContent + '\n' + lastMessage.content);
      }
      
    } catch (error) {
      console.error('AI响应失败:', error);
      
      let errorContent = '❌ **处理失败**\n\n';
      
      if (error instanceof Error) {
        // 检查是否包含详细错误信息格式
        if (error.message.includes('📋 错误代码:')) {
          // 已经是格式化的错误信息
          errorContent += error.message;
        } else {
          // 普通错误信息，添加额外上下文
          errorContent += `**错误信息：** ${error.message}\n\n`;
          
          // 添加调试信息
          errorContent += `---\n\n**🔍 调试信息**\n`;
          errorContent += `- 时间: ${new Date().toLocaleString('zh-CN')}\n`;
          errorContent += `- 模型: ${model}\n`;
          errorContent += `- 模式: ${writingMode === 'discuss' ? '讨论' : '撰写'}\n`;
          errorContent += `- API Key: ${currentApiKey ? '已配置 (' + currentApiKey.substring(0, 8) + '...)' : '未配置'}\n`;
          
          // 针对性建议
          if (error.message.includes('网络') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorContent += '\n**💡 网络问题排查：**\n';
            errorContent += '1. 打开终端运行 `node server/index.cjs` 启动后端\n';
            errorContent += '2. 检查端口 3001 是否被其他程序占用\n';
            errorContent += '3. 检查防火墙是否阻止了连接\n';
          } else if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('API Key')) {
            errorContent += '\n**💡 API Key 问题排查：**\n';
            errorContent += '1. 点击左侧工具栏的 API Key 按钮重新配置\n';
            errorContent += '2. 确保 API Key 格式正确（以 sk- 开头）\n';
            errorContent += '3. 检查 API Key 是否已过期或被禁用\n';
          } else if (error.message.includes('429') || error.message.includes('rate')) {
            errorContent += '\n**💡 频率限制：**\n';
            errorContent += '1. 请等待几秒后重试\n';
            errorContent += '2. 考虑升级 API 套餐以获得更高限额\n';
          } else if (error.message.includes('500') || error.message.includes('服务器')) {
            errorContent += '\n**💡 服务器问题：**\n';
            errorContent += '1. 检查后端终端的错误日志\n';
            errorContent += '2. 尝试重启后端服务器\n';
            errorContent += '3. AI 服务可能暂时不可用，稍后重试\n';
          }
        }
      } else {
        errorContent += `**未知错误：** ${String(error)}`;
      }
      
      const errorMessage: Message = { role: 'agent', content: errorContent };
      if (setMessages) {
        setMessages([...updatedMessages, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 封装发送请求的逻辑
  const sendAgentRequest = async (
    content: string,
    inputText: string,
    currentMessages: Message[],
    useStreaming: boolean,
    onMessagesUpdate: (messages: Message[]) => void
  ) => {
    // 先上传论文内容到后端缓存，获取 contentId
    let contentId: string | undefined;
    try {
      if (content && content.length > 0) {
        const cacheResult = await agentService.storeContent(content);
        contentId = cacheResult.contentId;
        console.log(`[AgentChat] 内容缓存: ${contentId}, isNew: ${cacheResult.isNew}`);
      }
    } catch (cacheError) {
      console.warn('[AgentChat] 内容缓存失败，将直接发送内容:', cacheError);
      // 缓存失败时继续使用直接发送
    }
    
    // 构建请求参数 - 优先使用 contentId
    const requestParams = {
      contentId,  // 优先使用缓存ID
      content: contentId ? undefined : content,  // 只有缓存失败时才发送完整内容
      input: inputText,
      mode: writingMode,
      model,
      apiKey: currentApiKey,
      messages: currentMessages
    };

    if (useStreaming) {
      // 创建流式消息
      const streamingMessage: Message = { 
        role: 'agent', 
        content: '',
        reasoning: '',  // 思考过程
        isStreaming: true 
      };
      
      let newMessages = [...currentMessages, streamingMessage];
      onMessagesUpdate(newMessages);
      
      const response = await agentService.sendStreamRequest(requestParams, (event) => {
        if (event.type === 'chunk') {
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex]?.isStreaming) {
            newMessages = [...newMessages];
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              content: newMessages[lastIndex].content + (event.content || ''),
              reasoning: (newMessages[lastIndex].reasoning || '') + (event.reasoning_content || '')
            };
            onMessagesUpdate(newMessages);
          }
        } else if (event.type === 'error' && event.error) {
          throw new Error(event.error);
        }
      });
      
      // 完成流式响应，移除流式标记
      const lastIndex = newMessages.length - 1;
      newMessages = [...newMessages];
      newMessages[lastIndex] = {
        ...newMessages[lastIndex],
        content: response.response,
        reasoning: response.reasoning,
        isStreaming: false,
        tool_calls: response.tool_calls
      };
      onMessagesUpdate(newMessages);
      
      return response;
    } else {
      // 普通请求（Qwen）
      const response = await agentService.sendRequest(requestParams);
      
      const agentMessage: Message = { 
        role: 'agent', 
        content: response.response,
        tool_calls: response.tool_calls
      };
      
      const newMessages = [...currentMessages, agentMessage];
      onMessagesUpdate(newMessages);
      
      return response;
    }
  };

  return (
    <div className="panel agent-panel">
      <div className="agent-main-content">
        <h2 className="panel-title">写作助手</h2>
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
        <div className="chat-history">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === 'agent' ? (
                <div className="markdown-content">
                  {/* DeepSeek Reasoner 思考过程 */}
                  {msg.reasoning && (
                    <div className="reasoning-block">
                      <div 
                        className="reasoning-header clickable"
                        onClick={() => setExpandedReasoning(prev => ({ 
                          ...prev, 
                          [`reasoning-${index}`]: !prev[`reasoning-${index}`] 
                        }))}
                      >
                        <span>🧠 思考过程</span>
                        <span className="toggle-icon">
                          {expandedReasoning[`reasoning-${index}`] ? '▼' : '▶'}
                        </span>
                      </div>
                      {expandedReasoning[`reasoning-${index}`] && (
                        <div className="reasoning-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.reasoning}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 主要内容 */}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                  
                  {/* 工具调用 */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <div className="tool-calls">
                      <div 
                        className="tool-calls-title clickable"
                        onClick={() => setExpandedToolResults(prev => ({ ...prev, [`calls-${index}`]: !prev[`calls-${index}`] }))}
                      >
                        <span>🔧 工具调用 ({msg.tool_calls.length})</span>
                        <span className="toggle-icon">{expandedToolResults[`calls-${index}`] ? '▼' : '▶'}</span>
                      </div>
                      {expandedToolResults[`calls-${index}`] && msg.tool_calls.map((toolCall, toolIndex) => {
                        const toolNameMap: Record<string, string> = {
                          'search_papers': '📚 搜索论文',
                          'download_paper': '⬇️ 下载论文',
                          'read_pdf_content': '📖 读取PDF',
                          'view_file': '👁️ 查看文件',
                          'edit_file': '✏️ 编辑文件',
                          'search_in_file': '🔍 搜索文件',
                          'list_resources': '📋 列出资源',
                          'add_resource': '➕ 添加资源',
                          'insert_resource': '📎 插入资源'
                        };
                        
                        const displayName = toolNameMap[toolCall.tool_name] || `🔧 ${toolCall.tool_name}`;
                        
                        return (
                          <div key={toolIndex} className="tool-call">
                            <div className="tool-name">{displayName}</div>
                            <div className="tool-params">
                              <strong>参数：</strong>
                              <pre>{JSON.stringify(toolCall.parameters, null, 2)}</pre>
                            </div>
                            {msg.tool_results && msg.tool_results[toolIndex] && (
                              <div className={`tool-result-inline ${msg.tool_results[toolIndex].success ? 'success' : 'error'}`}>
                                <span className="result-status">
                                  {msg.tool_results[toolIndex].success ? '✅' : '❌'}
                                </span>
                                {msg.tool_results[toolIndex].error && (
                                  <span className="result-error-text">{msg.tool_results[toolIndex].error}</span>
                                )}
                                {msg.tool_results[toolIndex].success && msg.tool_results[toolIndex].data && (
                                  <span className="result-success-text">执行成功</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* 工具结果详情 */}
                  {msg.tool_results && msg.tool_results.length > 0 && (
                    <div className="tool-results">
                      <div 
                        className="tool-results-title clickable"
                        onClick={() => setExpandedToolResults(prev => ({ ...prev, [`results-${index}`]: !prev[`results-${index}`] }))}
                      >
                        <span>📊 工具结果 ({msg.tool_results.length})</span>
                        <span className="toggle-icon">{expandedToolResults[`results-${index}`] ? '▼' : '▶'}</span>
                      </div>
                      {expandedToolResults[`results-${index}`] && msg.tool_results.map((result, resultIndex) => {
                        const formatResultData = (data: any): string => {
                          if (!data) return '';
                          
                          if (data.text && typeof data.text === 'string') {
                            const preview = data.text.length > 500 
                              ? data.text.substring(0, 500) + '...' 
                              : data.text;
                            return `文本内容 (${data.text.length} 字符):\n${preview}`;
                          }
                          
                          if (data.papers && Array.isArray(data.papers)) {
                            return `找到 ${data.count} 篇论文:\n${data.papers.map((p: any, i: number) => 
                              `${i + 1}. ${p.title || '未知标题'} (${p.arxiv_id || '无ID'})`
                            ).join('\n')}`;
                          }
                          
                          if (data.message) {
                            return data.message;
                          }
                          
                          return JSON.stringify(data, null, 2);
                        };
                        
                        return (
                          <div key={resultIndex} className={`tool-result ${result.success ? 'success' : 'error'}`}>
                            <div className="result-header">
                              <div className="result-status">
                                {result.success ? '✅ 成功' : '❌ 失败'}
                              </div>
                              {result.data && typeof result.data === 'object' && (
                                <div className="result-summary">
                                  {result.data.count !== undefined && `数量: ${result.data.count}`}
                                  {result.data.text_stats && `文本: ${result.data.text_stats.textLength} 字符, ${result.data.text_stats.numWords} 单词`}
                                </div>
                              )}
                            </div>
                            {result.data && (
                              <div className="result-data">
                                <details>
                                  <summary>查看详情</summary>
                                  <pre>{formatResultData(result.data)}</pre>
                                </details>
                              </div>
                            )}
                            {result.error && (
                              <div className="result-error">
                                <strong>错误：</strong>{result.error}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message agent">
              <em>正在处理中...</em>
            </div>
          )}
        </div>
        <div className="chat-input">
          <div className="input-row">
            <div className="mode-model-selectors">
              <select 
                value={writingMode} 
                onChange={(e) => setWritingMode(e.target.value as 'discuss' | 'write')}
                className="mode-selector"
              >
                <option value="discuss">讨论</option>
                <option value="write">撰写</option>
              </select>
              <select 
                value={model} 
                onChange={(e) => {
                  const newModel = e.target.value as 'deepseek' | 'deepseek-reasoner' | 'qwen';
                  setModel(newModel);
                }}
                className="model-selector"
              >
                <option value="deepseek">DeepSeek</option>
                <option value="deepseek-reasoner">DeepSeek R1</option>
                <option value="qwen">Qwen</option>
              </select>
            </div>
          </div>
          <div className="input-field">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="请输入您的需求..."
              disabled={isLoading}
            />
            <button onClick={handleSend} disabled={isLoading}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
