/**
 * AI API模块 - DeepSeek和Qwen API调用
 */

const axios = require('axios');
const { MODEL_CONFIG } = require('./config.cjs');

// 调用DeepSeek API（支持 deepseek-chat 和 deepseek-reasoner 模型）
async function callDeepSeekApi(prompt, apiKey, model = 'deepseek-chat') {
  try {
    const config = MODEL_CONFIG[model] || MODEL_CONFIG['deepseek-chat'];

    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    if (config.reasoningEffort) {
      requestBody.reasoning_effort = config.reasoningEffort;
    }

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    
    // 提取详细错误信息
    let errorMsg = 'DeepSeek API调用失败';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        errorMsg = `API Key 无效或已过期 (${data?.error?.message || 'Unauthorized'})`;
      } else if (status === 429) {
        errorMsg = `API 调用频率超限，请稍后重试 (${data?.error?.message || 'Rate Limited'})`;
      } else if (status === 500) {
        errorMsg = `DeepSeek 服务器错误 (${data?.error?.message || 'Internal Server Error'})`;
      } else {
        errorMsg = data?.error?.message || `HTTP ${status} 错误`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = '无法连接到 DeepSeek API 服务器';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg = 'DeepSeek API 请求超时';
    }
    
    throw new Error(errorMsg);
  }
}

// 调用DeepSeek API流式响应（支持 deepseek-chat 和 deepseek-reasoner 模型）
// onChunk 回调参数: (content, fullResponse, reasoningContent, fullReasoningContent)
async function callDeepSeekApiStream(prompt, apiKey, model = 'deepseek-chat', onChunk) {
  try {
    const config = MODEL_CONFIG[model] || MODEL_CONFIG['deepseek-chat'];

    const requestBody = {
      model: model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true  // 启用流式响应
    };

    if (config.reasoningEffort) {
      requestBody.reasoning_effort = config.reasoningEffort;
    }

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream'  // 设置响应类型为流
    });

    let fullResponse = '';
    let fullReasoningContent = '';  // 思考过程内容
    let buffer = '';
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // 处理SSE格式的数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              resolve({ response: fullResponse, reasoning: fullReasoningContent });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta || {};
              
              // 处理普通内容
              const content = delta.content || '';
              if (content) {
                fullResponse += content;
              }
              
              // 处理 DeepSeek Reasoner 的思考过程
              const reasoningContent = delta.reasoning_content || '';
              if (reasoningContent) {
                fullReasoningContent += reasoningContent;
              }
              
              // 调用回调函数处理每个数据块
              if (onChunk && (content || reasoningContent)) {
                onChunk(content, fullResponse, reasoningContent, fullReasoningContent);
              }
            } catch (error) {
              console.warn('解析流式响应数据失败:', error, data);
            }
          }
        }
      });
      
      response.data.on('end', () => {
        if (buffer.trim()) {
          try {
            if (buffer.startsWith('data: ')) {
              const data = buffer.slice(6);
              if (data !== '[DONE]') {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta || {};
                
                const content = delta.content || '';
                if (content) {
                  fullResponse += content;
                }
                
                const reasoningContent = delta.reasoning_content || '';
                if (reasoningContent) {
                  fullReasoningContent += reasoningContent;
                }
                
                if (onChunk && (content || reasoningContent)) {
                  onChunk(content, fullResponse, reasoningContent, fullReasoningContent);
                }
              }
            }
          } catch (error) {
            console.warn('解析流式响应结束数据失败:', error);
          }
        }
        resolve({ response: fullResponse, reasoning: fullReasoningContent });
      });
      
      response.data.on('error', (error) => {
        console.error('流式响应错误:', error);
        reject(new Error('流式响应失败: ' + error.message));
      });
    });
  } catch (error) {
    console.error('DeepSeek API流式调用失败:', error);
    
    // 提取详细错误信息
    let errorMsg = 'DeepSeek API流式调用失败';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        errorMsg = `API Key 无效或已过期 (${data?.error?.message || 'Unauthorized'})`;
      } else if (status === 429) {
        errorMsg = `API 调用频率超限，请稍后重试 (${data?.error?.message || 'Rate Limited'})`;
      } else if (status === 500) {
        errorMsg = `DeepSeek 服务器错误 (${data?.error?.message || 'Internal Server Error'})`;
      } else {
        errorMsg = data?.error?.message || `HTTP ${status} 错误`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = '无法连接到 DeepSeek API 服务器';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg = 'DeepSeek API 请求超时';
    }
    
    throw new Error(errorMsg);
  }
}

// 调用Qwen API（普通输出，不支持流式）
async function callQwenApi(prompt, apiKey) {
  try {
    const config = MODEL_CONFIG['qwen'];
    
    const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Qwen API调用失败:', error);
    
    // 提取详细错误信息
    let errorMsg = 'Qwen API调用失败';
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        errorMsg = `API Key 无效或已过期 (${data?.error?.message || data?.message || 'Unauthorized'})`;
      } else if (status === 429) {
        errorMsg = `API 调用频率超限，请稍后重试 (${data?.error?.message || 'Rate Limited'})`;
      } else if (status === 500) {
        errorMsg = `Qwen 服务器错误 (${data?.error?.message || 'Internal Server Error'})`;
      } else {
        errorMsg = data?.error?.message || data?.message || `HTTP ${status} 错误`;
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = '无法连接到 Qwen API 服务器';
    } else if (error.code === 'ETIMEDOUT') {
      errorMsg = 'Qwen API 请求超时';
    }
    
    throw new Error(errorMsg);
  }
}

// 生成AI提示词
function generatePrompt(content, input, mode, availableTools = [], messages = []) {
  let prompt = '';
  
  // 检测是否是工具调用后的后续请求（避免重复发送论文内容）
  const isToolFollowUp = input.startsWith('工具 "') || input.startsWith('工具执行结果');
  
  const toolsDescription = availableTools.length > 0 ? `
您可以使用的学术写作工具：
${availableTools.map(tool => `- ${tool.name}: ${tool.description}
  参数要求: ${JSON.stringify(tool.parameters)}`).join('\n\n')}

工具使用指南：
• 搜索工具：用于查找相关文献和研究背景
• 下载工具：用于获取论文全文以便详细阅读
• 阅读工具：用于读取已下载PDF论文的文本内容
• 文件工具：用于查看和编辑论文内容（仅在撰写模式可用）
• 资源工具：用于管理参考文献、图片和数据文件

工具调用格式（JSON格式）：
TOOL_CALL: {
  "tool_name": "工具名称",
  "parameters": { "参数名": "参数值" }
}

⚠️ 【硬性规则 - 必须严格遵守】⚠️
1. 每次回复中【最多只能调用一个工具】，绝对禁止在同一回复中调用多个工具
2. 如果需要调用工具，输出 TOOL_CALL 后【立即停止】，不要继续输出任何内容
3. 工具调用后，系统会返回执行结果，你再基于结果继续回答或调用下一个工具
4. 如果需要执行多个操作，请分步进行：先调用第一个工具 → 等待结果 → 再调用下一个工具

正确示例：
用户：搜索关于深度学习的论文并下载第一篇
助手回复1：我来帮您搜索相关论文。
TOOL_CALL: {"tool_name": "search_papers", "parameters": {"query": "deep learning"}}
[停止，等待工具结果]

助手回复2（收到搜索结果后）：找到了相关论文，现在为您下载第一篇。
TOOL_CALL: {"tool_name": "download_paper", "parameters": {"arxiv_id": "2401.xxxxx"}}
[停止，等待工具结果]

错误示例（禁止）：
TOOL_CALL: {"tool_name": "search_papers", ...}
TOOL_CALL: {"tool_name": "download_paper", ...}  ← 禁止！不能连续调用多个工具

其他说明：
1. 文件编辑工具仅在撰写模式下可用
2. 论文搜索、下载和阅读工具在所有模式下都可用
` : '';
  
  // 完整对话历史
  const conversationHistory = messages && messages.length > 0 ? `
对话上下文：
${messages.map((msg, index) => {
  const role = msg.role === 'user' ? '👤 用户' : '🤖 助手';
  return `${role}: ${msg.content}`;
}).join('\n\n')}
` : '';
  
  // 根据是否为工具后续请求，决定是否包含论文内容（避免重复）
  const contentSection = isToolFollowUp 
    ? `（论文内容已在首次请求中提供，如需查看可使用 view_file 工具）` 
    : `当前论文内容：
${content}`;

  switch (mode) {
    case 'discuss':
      prompt = `作为一名专业的学术论文写作助手，我将与您深入讨论以下学术内容。

${toolsDescription}

${conversationHistory}

讨论主题：${input}

${contentSection}

讨论要求：
1. 提供专业的学术见解和深度分析
2. 基于现有内容提出建设性改进建议
3. 保持讨论的学术严谨性和逻辑性
4. 如有需要，可以使用工具搜索相关文献支持观点
5. 请勿直接修改论文内容，仅提供讨论和建议

请以专业的学术讨论方式回应，确保回答具有深度、逻辑性和实用性。`;
      break;
    case 'write':
      prompt = `作为一名专业的学术论文写作助手，我将根据您的需求对以下论文内容进行撰写或修改。

${toolsDescription}

${conversationHistory}

修改需求：${input}

${contentSection}

写作/修改要求：
1. 严格按照学术写作规范进行操作
2. 保持论文的逻辑连贯性和结构完整性
3. 确保语言表达准确、专业、简洁
4. 适当使用学术术语和规范表达
5. 如需参考资料，请先搜索相关文献
6. 可以多次使用工具查看和修改内容

输出要求：
- 提供完整修改后的论文内容
- 如果有重大结构调整，请简要说明修改思路
- 保持原有的格式标记（如LaTeX标记）
- 确保引用格式正确（如需要）

请直接提供优化后的完整论文内容：`;
      break;
    default:
      prompt = `请处理以下学术论文内容：

${contentSection}

用户需求：${input}

请按照学术写作规范进行处理，确保内容专业、逻辑清晰。`;
  }
  
  return prompt;
}

module.exports = {
  callDeepSeekApi,
  callDeepSeekApiStream,
  callQwenApi,
  generatePrompt
};
