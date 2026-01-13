// Agent服务调用模块

interface AgentRequest {
  content?: string;       // 论文内容（首次上传时使用）
  contentId?: string;     // 缓存的内容ID（后续请求使用）
  input: string;
  mode: 'discuss' | 'write';
  model: 'deepseek' | 'deepseek-reasoner' | 'qwen';
  apiKey: string;
  messages?: Array<{ role: 'user' | 'agent'; content: string }>;
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

interface AgentResponse {
  response: string;
  reasoning?: string;  // DeepSeek Reasoner 的思考过程
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

interface StreamEvent {
  type: 'start' | 'chunk' | 'complete' | 'error';
  model?: string;
  content?: string;
  reasoning_content?: string;  // DeepSeek Reasoner 的思考过程增量
  full_response?: string;
  full_reasoning?: string;     // DeepSeek Reasoner 的完整思考过程
  tool_calls?: ToolCall[];
  error?: string;
}

// 检测后端服务器状态
async function checkServerStatus(): Promise<{
  isRunning: boolean;
  details: string;
  suggestion: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('http://localhost:3001/api/health', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return {
        isRunning: true,
        details: '后端服务器运行正常',
        suggestion: ''
      };
    } else {
      return {
        isRunning: false,
        details: `服务器返回异常状态码: ${response.status}`,
        suggestion: '后端服务可能存在问题，请检查终端日志'
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          isRunning: false,
          details: '健康检查超时 (3秒)',
          suggestion: '服务器可能正在启动或响应缓慢'
        };
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
        return {
          isRunning: false,
          details: '无法连接到 localhost:3001',
          suggestion: '后端服务器未运行，请在终端执行: node server/index.cjs'
        };
      }
    }
    
    return {
      isRunning: false,
      details: `检查失败: ${error}`,
      suggestion: '请手动检查后端服务状态'
    };
  }
}

// 生成详细的网络错误报告
async function generateNetworkErrorReport(originalError: Error, endpoint: string): Promise<string> {
  const timestamp = new Date().toLocaleString('zh-CN');
  const serverStatus = await checkServerStatus();
  
  let report = `## ❌ 网络请求失败\n\n`;
  report += `**时间:** ${timestamp}\n`;
  report += `**请求地址:** ${endpoint}\n`;
  report += `**原始错误:** ${originalError.message}\n\n`;
  
  report += `---\n\n`;
  report += `### 🔍 诊断结果\n\n`;
  
  if (!serverStatus.isRunning) {
    report += `**服务器状态:** 🔴 离线\n`;
    report += `**详情:** ${serverStatus.details}\n\n`;
    
    report += `### 💡 解决方案\n\n`;
    report += `**方法 1: 启动后端服务器**\n`;
    report += `\`\`\`bash\n`;
    report += `cd C:\\Users\\86183\\Desktop\\writing\n`;
    report += `node server/index.cjs\n`;
    report += `\`\`\`\n\n`;
    
    report += `**方法 2: 使用测试脚本检查**\n`;
    report += `\`\`\`bash\n`;
    report += `node test-ai.cjs\n`;
    report += `\`\`\`\n\n`;
    
    report += `**方法 3: 检查端口占用**\n`;
    report += `\`\`\`powershell\n`;
    report += `netstat -ano | Select-String ":3001"\n`;
    report += `\`\`\`\n`;
  } else {
    report += `**服务器状态:** 🟢 在线\n\n`;
    report += `服务器健康检查通过，但请求仍然失败。可能的原因：\n\n`;
    report += `1. **浏览器扩展干扰** - 广告拦截器可能阻止请求\n`;
    report += `2. **CORS 问题** - 检查浏览器控制台是否有 CORS 错误\n`;
    report += `3. **请求超时** - 网络延迟或服务器处理时间过长\n`;
    report += `4. **浏览器缓存** - 尝试硬刷新 (Ctrl+Shift+R)\n\n`;
    
    report += `### 💡 建议操作\n\n`;
    report += `1. 按 F12 打开开发者工具\n`;
    report += `2. 切换到 Network 标签\n`;
    report += `3. 重新发送请求\n`;
    report += `4. 查看失败请求的详细错误信息\n`;
  }
  
  return report;
}

// 详细错误类，包含调试信息
class AgentServiceError extends Error {
  public code: string;
  public details: string;
  public suggestion: string;
  
  constructor(message: string, code: string, details: string, suggestion: string) {
    super(message);
    this.name = 'AgentServiceError';
    this.code = code;
    this.details = details;
    this.suggestion = suggestion;
  }
  
  toDisplayString(): string {
    return `${this.message}\n\n📋 错误代码: ${this.code}\n📝 详细信息: ${this.details}\n💡 建议: ${this.suggestion}`;
  }
}

// 内容缓存 - 存储 contentId
let cachedContentId: string | null = null;
let cachedContentHash: string | null = null;

// 简单的内容哈希（用于检测内容是否变化）
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

export const agentService = {
  // 上传论文内容到后端缓存
  async storeContent(content: string): Promise<{ contentId: string; isNew: boolean }> {
    const contentHash = simpleHash(content);
    
    // 如果内容没有变化且已有缓存ID，直接返回
    if (cachedContentId && cachedContentHash === contentHash) {
      console.log(`[AgentService] 内容未变化，复用缓存 ID: ${cachedContentId}`);
      return { contentId: cachedContentId, isNew: false };
    }
    
    console.log(`[AgentService] 上传论文内容到后端缓存 (${(content.length / 1024).toFixed(1)} KB)`);
    
    try {
      const response = await fetch('http://localhost:3001/api/content/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.data.contentId) {
        cachedContentId = result.data.contentId;
        cachedContentHash = contentHash;
        console.log(`[AgentService] 内容已缓存: ${cachedContentId} (${result.data.sizeFormatted})`);
        return { contentId: cachedContentId, isNew: result.data.isNew };
      }
      
      throw new Error('无效的服务器响应');
    } catch (error) {
      console.error('[AgentService] 上传内容失败:', error);
      // 失败时清除缓存
      cachedContentId = null;
      cachedContentHash = null;
      throw error;
    }
  },
  
  // 清除内容缓存
  clearContentCache() {
    cachedContentId = null;
    cachedContentHash = null;
    console.log('[AgentService] 内容缓存已清除');
  },
  
  // 获取当前缓存的 contentId
  getContentId(): string | null {
    return cachedContentId;
  },

  // 普通请求（用于 Qwen）
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    const { content, contentId, input, mode, model, apiKey, messages } = request;
    const endpoint = 'http://localhost:3001/api/agent';
    
    console.log(`[AgentService] 发送普通请求 - 模型: ${model}, 模式: ${mode}`);
    
    // 构建请求体 - 优先使用 contentId
    const requestBody: Record<string, any> = { input, mode, model, apiKey, messages };
    if (contentId) {
      requestBody.contentId = contentId;
      console.log(`[AgentService] 使用缓存内容 ID: ${contentId}`);
    } else if (content) {
      requestBody.content = content;
      console.log(`[AgentService] 直接发送内容 (${(content.length / 1024).toFixed(1)} KB)`);
    }
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`[AgentService] 收到响应 - 状态: ${response.status}, 耗时: ${elapsed}ms`);
      
      if (!response.ok) {
        let errorMessage = `HTTP错误: ${response.status}`;
        let errorDetails = `状态码: ${response.status}, 状态文本: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          console.error('[AgentService] 服务器返回错误:', errorData);
          
          if (errorData.error) {
            errorMessage = errorData.error;
            errorDetails = JSON.stringify(errorData, null, 2);
          }
        } catch (parseError) {
          errorDetails += `, 无法解析错误响应体`;
        }
        
        throw new AgentServiceError(
          errorMessage,
          `HTTP_${response.status}`,
          errorDetails,
          getHttpErrorSuggestion(response.status)
        );
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new AgentServiceError(
          data.error || '服务器返回失败响应',
          'API_ERROR',
          JSON.stringify(data, null, 2),
          '请检查请求参数是否正确'
        );
      }
      
      if (!data.data) {
        throw new AgentServiceError(
          '服务器响应格式错误',
          'INVALID_RESPONSE',
          '响应中缺少 data 字段',
          '可能是后端服务版本不匹配，请尝试重启后端服务'
        );
      }
      
      console.log(`[AgentService] 请求成功 - 响应长度: ${data.data.response?.length || 0}`);
      return data.data;
      
    } catch (error) {
      console.error('[AgentService] 请求失败:', error);
      
      // 如果已经是 AgentServiceError，直接抛出
      if (error instanceof AgentServiceError) {
        throw new Error(error.toDisplayString());
      }
      
      // 处理网络错误 - 生成详细报告
      if (error instanceof TypeError) {
        const errorMsg = error.message;
        console.error('[AgentService] 网络错误详情:', errorMsg);
        
        if (errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          const report = await generateNetworkErrorReport(error, endpoint);
          throw new Error(report);
        }
      }
      
      // 处理其他错误
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('未知错误: ' + String(error));
    }
  },

  // 流式请求（用于 DeepSeek 和 DeepSeek Reasoner）
  async sendStreamRequest(request: AgentRequest, onEvent: (event: StreamEvent) => void): Promise<AgentResponse> {
    const { content, contentId, input, mode, model, apiKey, messages } = request;
    const endpoint = 'http://localhost:3001/api/agent/stream';
    
    console.log(`[AgentService] 发送流式请求 - 模型: ${model}, 模式: ${mode}`);
    
    // 构建请求体 - 优先使用 contentId
    const requestBody: Record<string, any> = { input, mode, model, apiKey, messages };
    if (contentId) {
      requestBody.contentId = contentId;
      console.log(`[AgentService] 使用缓存内容 ID: ${contentId}`);
    } else if (content) {
      requestBody.content = content;
      console.log(`[AgentService] 直接发送内容 (${(content.length / 1024).toFixed(1)} KB)`);
    }
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`[AgentService] 流式连接建立 - 状态: ${response.status}, 耗时: ${elapsed}ms`);
      
      if (!response.ok) {
        let errorMessage = `HTTP错误: ${response.status}`;
        let errorDetails = `状态码: ${response.status}, 状态文本: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          console.error('[AgentService] 流式请求服务器返回错误:', errorData);
          
          if (errorData.error) {
            errorMessage = errorData.error;
            errorDetails = JSON.stringify(errorData, null, 2);
          }
        } catch (parseError) {
          errorDetails += `, 无法解析错误响应体`;
        }
        
        throw new AgentServiceError(
          errorMessage,
          `HTTP_${response.status}`,
          errorDetails,
          getHttpErrorSuggestion(response.status)
        );
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      if (!reader) {
        throw new AgentServiceError(
          '无法读取流式响应',
          'STREAM_ERROR',
          '响应体为空或不支持流式读取',
          '请检查浏览器是否支持 ReadableStream'
        );
      }
      
      return new Promise((resolve, reject) => {
        const readStream = async () => {
          try {
            let chunkCount = 0;
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log(`[AgentService] 流式读取完成 - 共 ${chunkCount} 个数据块`);
                break;
              }
              
              chunkCount++;
              buffer += decoder.decode(value, { stream: true });
              
              // 处理SSE格式的数据
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    return;
                  }
                  
                  try {
                    const event: StreamEvent = JSON.parse(data);
                    
                    if (onEvent) {
                      onEvent(event);
                    }
                    
                    if (event.type === 'complete') {
                      console.log(`[AgentService] 流式响应完成 - 响应长度: ${event.full_response?.length || 0}`);
                      resolve({
                        response: event.full_response || '',
                        reasoning: event.full_reasoning,
                        tool_calls: event.tool_calls
                      });
                    }
                    
                    if (event.type === 'error') {
                      const errorMsg = event.error || '流式响应错误';
                      console.error('[AgentService] 流式响应错误:', errorMsg);
                      
                      if (onEvent) {
                        onEvent({ type: 'error', error: errorMsg });
                      }
                      
                      reject(new AgentServiceError(
                        errorMsg,
                        'STREAM_API_ERROR',
                        `服务器返回错误: ${errorMsg}`,
                        '请检查 API Key 是否有效，或稍后重试'
                      ));
                    }
                  } catch (parseError) {
                    console.warn('[AgentService] 解析流式事件失败:', parseError, 'data:', data);
                  }
                }
              }
            }
          } catch (error) {
            console.error('[AgentService] 流式读取错误:', error);
            reject(error);
          }
        };
        
        readStream().catch(reject);
      });
      
    } catch (error) {
      console.error('[AgentService] 流式请求失败:', error);
      
      // 如果已经是 AgentServiceError，转换为显示字符串
      if (error instanceof AgentServiceError) {
        throw new Error(error.toDisplayString());
      }
      
      // 处理网络错误 - 生成详细报告
      if (error instanceof TypeError) {
        const errorMsg = error.message;
        console.error('[AgentService] 流式网络错误详情:', errorMsg);
        
        if (errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          const report = await generateNetworkErrorReport(error, endpoint);
          throw new Error(report);
        }
      }
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('未知错误: ' + String(error));
    }
  },

  async executeToolCall(toolName: string, parameters: Record<string, any>, editorContent?: string): Promise<ToolResult> {
    console.log(`[AgentService] 执行工具调用 - 工具: ${toolName}`);
    
    try {
      const response = await fetch('http://localhost:3001/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tool_name: toolName, 
          parameters,
          editor_content: editorContent 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AgentService] 工具调用失败:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[AgentService] 工具调用成功 - 工具: ${toolName}, 结果: ${result.success ? '成功' : '失败'}`);
      return result;
    } catch (error) {
      console.error('[AgentService] 工具调用异常:', error);
      throw error;
    }
  },

  async getAvailableTools(): Promise<any> {
    try {
      const response = await fetch('http://localhost:3001/api/tools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data.tools;
    } catch (error) {
      console.error('[AgentService] 获取工具列表失败:', error);
      throw error;
    }
  },
  
  // 导出服务器状态检查函数供外部使用
  checkServerStatus
};

// 根据 HTTP 状态码返回建议
function getHttpErrorSuggestion(status: number): string {
  switch (status) {
    case 400:
      return '请求参数有误，请检查输入内容';
    case 401:
      return 'API Key 无效或已过期，请重新配置';
    case 403:
      return 'API Key 权限不足，请检查账户状态';
    case 404:
      return 'API 接口不存在，请检查后端服务是否正确启动';
    case 429:
      return 'API 调用频率过高，请稍后再试';
    case 500:
      return '服务器内部错误，请检查后端日志';
    case 502:
    case 503:
    case 504:
      return 'AI 服务暂时不可用，请稍后再试';
    default:
      return '请检查网络连接和服务器状态';
  }
}
