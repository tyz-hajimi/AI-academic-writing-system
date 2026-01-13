/**
 * 工具路由模块 - 提供工具列表和执行API
 */

const express = require('express');
const router = express.Router();

const { AVAILABLE_TOOLS, executeTool } = require('../tools/index.cjs');

// 获取可用工具列表
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: { tools: AVAILABLE_TOOLS }
  });
});

// 工具调用API
router.post('/execute', async (req, res) => {
  const { tool_name, parameters, editor_content } = req.body;
  
  try {
    console.log(`执行工具调用: ${tool_name}`, parameters);
    
    const result = await executeTool(tool_name, parameters, editor_content);
    
    res.json(result);
  } catch (error) {
    console.error('工具调用失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '工具调用失败'
    });
  }
});

module.exports = router;
