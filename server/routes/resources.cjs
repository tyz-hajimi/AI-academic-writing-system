/**
 * 资源管理路由模块
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();

const { localStorage } = require('../storage.cjs');
const { generateInsertContent } = require('../tools/index.cjs');

const VALID_RESOURCE_TYPES = ['references', 'images', 'pdfs', 'datafiles', 'codesnippets', 'notes'];

// 资源管理API - 获取资源列表
router.get('/:type', (req, res) => {
  const { type } = req.params;
  
  if (!VALID_RESOURCE_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: '无效的资源类型'
    });
  }
  
  const storedData = localStorage.getItem(`academic_writing_${type}`);
  const resources = storedData ? JSON.parse(storedData) : [];
  
  res.json({
    success: true,
    data: {
      type,
      resources,
      count: resources.length
    }
  });
});

// 资源管理API - 添加资源（统一逻辑：检查是否已存在）
router.post('/:type', (req, res) => {
  const { type } = req.params;
  const { resource_data } = req.body;
  
  if (!VALID_RESOURCE_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: '无效的资源类型'
    });
  }
  
  if (!resource_data || typeof resource_data !== 'object') {
    return res.status(400).json({
      success: false,
      error: '资源数据不能为空'
    });
  }
  
  const storedData = localStorage.getItem(`academic_writing_${type}`);
  let resources = [];
  if (storedData) {
    try {
      resources = JSON.parse(storedData);
    } catch (e) {
      resources = [];
    }
  }
  
  // 生成唯一ID
  if (!resource_data.id) {
    resource_data.id = randomUUID();
  } else {
    // 检查ID是否已存在
    const existingIndex = resources.findIndex(r => r.id === resource_data.id);
    if (existingIndex !== -1) {
      // 如果ID已存在，更新资源而不是添加
      resources[existingIndex] = resource_data;
      localStorage.setItem(`academic_writing_${type}`, JSON.stringify(resources));
      
      return res.json({
        success: true,
        data: {
          message: `成功更新${type}资源`,
          resource_id: resource_data.id,
          resource_type: type,
          resource_data,
          updated: true
        }
      });
    }
  }
  
  // 对于PDF，检查是否已存在同名文件
  if (type === 'pdfs' && resource_data.name) {
    const existingIndex = resources.findIndex(r => r.name === resource_data.name);
    if (existingIndex !== -1) {
      // 更新已存在的PDF资源
      resources[existingIndex] = resource_data;
      localStorage.setItem(`academic_writing_${type}`, JSON.stringify(resources));
      
      return res.json({
        success: true,
        data: {
          message: `成功更新${type}资源`,
          resource_id: resource_data.id,
          resource_type: type,
          resource_data,
          updated: true
        }
      });
    }
  }
  
  // 添加新资源
  resources.push(resource_data);
  localStorage.setItem(`academic_writing_${type}`, JSON.stringify(resources));
  
  res.json({
    success: true,
    data: {
      message: `成功添加${type}资源`,
      resource_id: resource_data.id,
      resource_type: type,
      resource_data,
      updated: false
    }
  });
});

// 资源管理API - 更新资源
router.put('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const { resource_data } = req.body;
  
  if (!VALID_RESOURCE_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: '无效的资源类型'
    });
  }
  
  if (!resource_data || typeof resource_data !== 'object') {
    return res.status(400).json({
      success: false,
      error: '资源数据不能为空'
    });
  }
  
  const storedData = localStorage.getItem(`academic_writing_${type}`);
  if (!storedData) {
    return res.status(404).json({
      success: false,
      error: '未找到该类型的资源'
    });
  }
  
  let resources = [];
  try {
    resources = JSON.parse(storedData);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: '资源数据解析失败'
    });
  }
  
  const index = resources.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: '未找到指定的资源'
    });
  }
  
  // 确保ID不变
  resource_data.id = id;
  
  // 更新资源
  resources[index] = resource_data;
  localStorage.setItem(`academic_writing_${type}`, JSON.stringify(resources));
  
  res.json({
    success: true,
    data: {
      message: '成功更新资源',
      resource_id: id,
      resource_type: type,
      resource_data
    }
  });
});

// 资源管理API - 删除资源
router.delete('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  
  if (!VALID_RESOURCE_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: '无效的资源类型'
    });
  }
  
  const storedData = localStorage.getItem(`academic_writing_${type}`);
  if (!storedData) {
    return res.status(404).json({
      success: false,
      error: '未找到该类型的资源'
    });
  }
  
  let resources = [];
  try {
    resources = JSON.parse(storedData);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: '资源数据解析失败'
    });
  }
  
  const index = resources.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: '未找到指定的资源'
    });
  }
  
  resources.splice(index, 1);
  localStorage.setItem(`academic_writing_${type}`, JSON.stringify(resources));
  
  res.json({
    success: true,
    data: {
      message: '成功删除资源',
      resource_id: id
    }
  });
});

// 资源管理API - 生成资源引用（使用统一的引用生成函数）
router.post('/:type/:id/insert', (req, res) => {
  const { type, id } = req.params;
  const { insert_format = 'latex' } = req.body;
  
  if (!VALID_RESOURCE_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      error: '无效的资源类型'
    });
  }
  
  const storedData = localStorage.getItem(`academic_writing_${type}`);
  if (!storedData) {
    return res.status(404).json({
      success: false,
      error: '未找到该类型的资源'
    });
  }
  
  let resources = [];
  try {
    resources = JSON.parse(storedData);
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: '资源数据解析失败'
    });
  }
  
  const resource = resources.find(r => r.id === id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      error: '未找到指定的资源'
    });
  }
  
  // 使用统一的引用生成函数
  const insertContent = generateInsertContent(resource, type, insert_format);
  
  res.json({
    success: true,
    data: {
      message: '成功生成资源引用',
      resource_type: type,
      resource_id: id,
      resource_name: resource.name || resource.title,
      insert_content: insertContent,
      insert_format
    }
  });
});

module.exports = router;
