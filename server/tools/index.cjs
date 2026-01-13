/**
 * 工具模块统一导出
 */

const { AVAILABLE_TOOLS, RESOURCE_TYPES, generateInsertContent, extractArxivId } = require('./toolDefinitions.cjs');
const { executeTool } = require('./toolExecutor.cjs');
const { parseToolCalls, removeToolCallsFromResponse, extractContentBeforeToolCall, hasToolCall } = require('./toolParser.cjs');

module.exports = {
  // 工具定义
  AVAILABLE_TOOLS,
  RESOURCE_TYPES,
  generateInsertContent,
  extractArxivId,
  
  // 工具执行
  executeTool,
  
  // 工具解析
  parseToolCalls,
  removeToolCallsFromResponse,
  extractContentBeforeToolCall,
  hasToolCall
};
