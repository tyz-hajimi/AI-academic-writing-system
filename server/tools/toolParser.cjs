/**
 * 工具解析模块 - 解析AI响应中的工具调用
 * 
 * 重要：每次只解析并返回第一个工具调用
 * 多个工具调用需要通过多次AI响应来完成
 */

const { AVAILABLE_TOOLS } = require('./toolDefinitions.cjs');

// 解析AI响应中的工具调用（只返回第一个）
function parseToolCalls(response) {
  if (!response || typeof response !== 'string') {
    return [];
  }
  
  // 支持多种格式的工具调用
  const patterns = [
    // 格式1: TOOL_CALL: {...}
    /TOOL_CALL:\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/,
    // 格式2: ```json\nTOOL_CALL: {...}\n```
    /```json\s*TOOL_CALL:\s*(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})\s*```/,
    // 格式3: {"tool_name": "...", "parameters": {...}}
    /\{\s*"tool_name"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[^}]*\})\s*\}/
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(response);
    
    if (match) {
      try {
        let toolCall;
        
        // 格式3需要特殊处理
        if (pattern === patterns[2]) {
          toolCall = {
            tool_name: match[1],
            parameters: JSON.parse(match[2])
          };
        } else {
          const jsonStr = match[1].trim();
          toolCall = JSON.parse(jsonStr);
        }
        
        if (toolCall && toolCall.tool_name && toolCall.parameters) {
          const isValidTool = AVAILABLE_TOOLS.some(tool => tool.name === toolCall.tool_name);
          
          if (isValidTool) {
            console.log(`[ToolParser] 解析到工具调用: ${toolCall.tool_name}`);
            // 只返回第一个有效的工具调用
            return [{
              tool_name: toolCall.tool_name,
              parameters: toolCall.parameters
            }];
          } else {
            console.warn(`[ToolParser] 未知的工具名称: ${toolCall.tool_name}`);
          }
        }
      } catch (error) {
        console.warn('[ToolParser] 解析工具调用失败:', error.message);
        
        // 尝试备用解析
        try {
          const jsonStr = match[0]
            .replace(/TOOL_CALL:\s*/, '')
            .replace(/```json\s*/, '')
            .replace(/```\s*$/, '')
            .trim();
          const toolCall = JSON.parse(jsonStr);
          
          if (toolCall.tool_name && toolCall.parameters) {
            const isValidTool = AVAILABLE_TOOLS.some(tool => tool.name === toolCall.tool_name);
            if (isValidTool) {
              console.log(`[ToolParser] 备用解析成功: ${toolCall.tool_name}`);
              return [{
                tool_name: toolCall.tool_name,
                parameters: toolCall.parameters
              }];
            }
          }
        } catch (retryError) {
          console.warn('[ToolParser] 备用解析也失败:', retryError.message);
        }
      }
    }
  }
  
  return [];
}

// 从响应中提取工具调用之前的内容（截断工具调用后的部分）
function extractContentBeforeToolCall(response) {
  if (!response || typeof response !== 'string') {
    return response;
  }
  
  // 查找 TOOL_CALL 的位置
  const toolCallPatterns = [
    /TOOL_CALL:\s*\{/,
    /```json\s*TOOL_CALL:/,
    /\{\s*"tool_name"\s*:/
  ];
  
  let firstToolCallIndex = -1;
  
  for (const pattern of toolCallPatterns) {
    const match = pattern.exec(response);
    if (match) {
      const index = match.index;
      if (firstToolCallIndex === -1 || index < firstToolCallIndex) {
        firstToolCallIndex = index;
      }
    }
  }
  
  if (firstToolCallIndex > 0) {
    // 返回工具调用之前的内容
    return response.substring(0, firstToolCallIndex).trim();
  }
  
  // 如果工具调用在开头，返回空字符串
  if (firstToolCallIndex === 0) {
    return '';
  }
  
  // 没有找到工具调用，返回原内容
  return response;
}

// 从响应中移除工具调用指令（保留工具调用之前的内容）
function removeToolCallsFromResponse(response) {
  return extractContentBeforeToolCall(response);
}

// 检查响应中是否包含工具调用
function hasToolCall(response) {
  if (!response || typeof response !== 'string') {
    return false;
  }
  
  const patterns = [
    /TOOL_CALL:\s*\{/,
    /```json\s*TOOL_CALL:/,
    /\{\s*"tool_name"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:/
  ];
  
  return patterns.some(pattern => pattern.test(response));
}

module.exports = {
  parseToolCalls,
  extractContentBeforeToolCall,
  removeToolCallsFromResponse,
  hasToolCall
};
