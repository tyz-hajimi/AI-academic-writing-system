/**
 * Agent路由模块
 */

const express = require('express');
const router = express.Router();

const { callDeepSeekApi, callDeepSeekApiStream, callQwenApi, generatePrompt } = require('../aiApi.cjs');
const { AVAILABLE_TOOLS, parseToolCalls, extractContentBeforeToolCall } = require('../tools/index.cjs');
const { getContent, storeContent } = require('../contentCache.cjs');

/**
 * 获取论文内容：优先使用 contentId 从缓存获取，否则使用直接传入的 content
 */
function resolveContent(contentId, content) {
  if (contentId) {
    const cached = getContent(contentId);
    if (cached) {
      console.log(`[Agent] 使用缓存内容: ${contentId} (${(cached.length / 1024).toFixed(1)} KB)`);
      return cached;
    }
    console.log(`[Agent] 缓存内容未找到: ${contentId}，使用直接传入的内容`);
  }
  return content || '';
}

// Agent API（普通请求，用于 Qwen）
router.post('/', async (req, res) => {
  const { content, contentId, input, mode, model, apiKey, messages } = req.body;
  
  try {
    if (!apiKey) {
      throw new Error('API Key不能为空');
    }
    
    // 解析论文内容（支持 contentId 或直接 content）
    const resolvedContent = resolveContent(contentId, content);
    
    // 生成提示词，传入工具列表
    const prompt = generatePrompt(resolvedContent, input, mode, AVAILABLE_TOOLS, messages);
    
    let response;
    
    // 根据模型选择调用不同的API
    switch (model) {
      case 'deepseek':
        response = await callDeepSeekApi(prompt, apiKey, 'deepseek-chat');
        break;
      case 'deepseek-reasoner':
        response = await callDeepSeekApi(prompt, apiKey, 'deepseek-reasoner');
        break;
      case 'qwen':
        response = await callQwenApi(prompt, apiKey);
        break;
      default:
        throw new Error('不支持的模型');
    }
    
    // 解析响应中的工具调用（只取第一个）
    const toolCalls = parseToolCalls(response);
    
    // 如果有工具调用，截断工具调用后的内容
    let finalResponse = response;
    if (toolCalls.length > 0) {
      finalResponse = extractContentBeforeToolCall(response);
      console.log(`[Agent] 检测到工具调用: ${toolCalls[0].tool_name}，已截断响应`);
    }
    
    res.json({
      success: true,
      data: {
        response: finalResponse,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined
      }
    });
  } catch (error) {
    console.error('Agent API处理失败:', error);
    
    // 提取更详细的错误信息
    let errorMessage = '处理失败';
    let statusCode = 500;
    
    if (error.response) {
      // API返回的错误
      errorMessage = error.response.data?.error?.message || error.message || 'API调用失败';
      statusCode = error.response.status || 500;
    } else if (error.request) {
      // 网络错误
      errorMessage = '无法连接到AI服务，请检查网络连接';
      statusCode = 503;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Agent流式API（用于 DeepSeek 和 DeepSeek Reasoner）
router.post('/stream', async (req, res) => {
  const { content, contentId, input, mode, model, apiKey, messages } = req.body;
  
  try {
    if (!apiKey) {
      throw new Error('API Key不能为空');
    }
    
    // 解析论文内容（支持 contentId 或直接 content）
    const resolvedContent = resolveContent(contentId, content);
    
    // 生成提示词，传入工具列表
    const prompt = generatePrompt(resolvedContent, input, mode, AVAILABLE_TOOLS, messages);
    
    // 设置响应头为SSE格式
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 发送初始消息
    res.write(`data: ${JSON.stringify({ type: 'start', model: model })}\n\n`);
    
    let fullResponse = '';
    let fullReasoning = '';
    let toolCalls = [];
    
    // DeepSeek 模型使用流式响应
    if (model === 'deepseek' || model === 'deepseek-reasoner') {
      const actualModel = model === 'deepseek' ? 'deepseek-chat' : 'deepseek-reasoner';
      
      const result = await callDeepSeekApiStream(
        prompt, 
        apiKey, 
        actualModel, 
        (content, currentFullResponse, reasoningContent, currentFullReasoning) => {
          fullResponse = currentFullResponse;
          fullReasoning = currentFullReasoning;
          
          // 发送内容块
          const eventData = { 
            type: 'chunk', 
            content: content,
            full_response: currentFullResponse
          };
          
          // 如果是 reasoner 模型，也发送思考过程
          if (model === 'deepseek-reasoner' && reasoningContent) {
            eventData.reasoning_content = reasoningContent;
            eventData.full_reasoning = currentFullReasoning;
          }
          
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        }
      );
      
      fullResponse = result.response;
      fullReasoning = result.reasoning || '';
    } else {
      // 其他模型不应该调用流式接口，返回错误
      throw new Error('该模型不支持流式输出，请使用普通接口');
    }
    
    // 解析响应中的工具调用（只取第一个）
    toolCalls = parseToolCalls(fullResponse);
    
    // 如果有工具调用，截断工具调用后的内容
    let finalResponse = fullResponse;
    if (toolCalls.length > 0) {
      finalResponse = extractContentBeforeToolCall(fullResponse);
      console.log(`[Agent Stream] 检测到工具调用: ${toolCalls[0].tool_name}，已截断响应`);
    }
    
    // 发送完成消息
    const completeData = { 
      type: 'complete', 
      full_response: finalResponse,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
    
    // 如果有思考过程，也包含在完成消息中
    if (fullReasoning) {
      completeData.full_reasoning = fullReasoning;
    }
    
    res.write(`data: ${JSON.stringify(completeData)}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Agent流式API处理失败:', error);
    
    // 提取更详细的错误信息
    let errorMessage = '处理失败';
    
    if (error.response) {
      // API返回的错误
      errorMessage = error.response.data?.error?.message || error.message || 'API调用失败';
    } else if (error.request) {
      // 网络错误
      errorMessage = '无法连接到AI服务，请检查网络连接';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // 发送错误消息
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: errorMessage
    })}\n\n`);
    
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

module.exports = router;
