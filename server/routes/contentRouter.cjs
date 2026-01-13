/**
 * 论文内容缓存路由
 */

const express = require('express');
const router = express.Router();
const { storeContent, getContent, getCacheStats, clearCache } = require('../contentCache.cjs');

// 上传/存储论文内容
router.post('/store', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: '内容不能为空'
      });
    }

    const result = storeContent(content);
    
    res.json({
      success: true,
      data: {
        contentId: result.contentId,
        isNew: result.isNew,
        size: result.size,
        sizeFormatted: `${(result.size / 1024).toFixed(1)} KB`
      }
    });
  } catch (error) {
    console.error('存储内容失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取内容（用于调试）
router.get('/get/:contentId', (req, res) => {
  try {
    const { contentId } = req.params;
    const content = getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: '内容不存在或已过期'
      });
    }

    res.json({
      success: true,
      data: {
        contentId,
        content,
        size: content.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取缓存统计
router.get('/stats', (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清空缓存
router.delete('/clear', (req, res) => {
  try {
    clearCache();
    res.json({
      success: true,
      message: '缓存已清空'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
