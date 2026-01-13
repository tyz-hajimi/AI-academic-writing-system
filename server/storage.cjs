/**
 * 存储模块 - 文件系统持久化和兼容localStorage接口
 */

const fs = require('fs-extra');
const { join } = require('path');
const { STORAGE_DIR, RESOURCE_TYPES } = require('./config.cjs');

// 确保存储目录存在
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 获取资源存储文件路径
function getStoragePath(type) {
  return join(STORAGE_DIR, `${type}.json`);
}

// 从文件加载资源
function loadResourcesFromFile(type) {
  const filePath = getStoragePath(type);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`[存储] 读取资源文件失败 (${type}):`, error);
      return [];
    }
  }
  return [];
}

// 保存资源到文件
function saveResourcesToFile(type, resources) {
  const filePath = getStoragePath(type);
  try {
    fs.writeFileSync(filePath, JSON.stringify(resources, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`[存储] 保存资源文件失败 (${type}):`, error);
    return false;
  }
}

// 内存存储（用于快速访问，启动时从文件加载）
const memoryStorage = new Map();

// 初始化：从文件加载所有资源到内存
function initializeStorage() {
  console.log('[存储] 初始化存储系统...');
  RESOURCE_TYPES.forEach(type => {
    const resources = loadResourcesFromFile(type);
    memoryStorage.set(`academic_writing_${type}`, JSON.stringify(resources));
    console.log(`[存储] 已加载 ${type}: ${resources.length} 个资源`);
  });
  console.log('[存储] 存储系统初始化完成');
}

// 兼容localStorage接口的存储系统（带持久化）
const localStorage = {
  getItem: (key) => {
    // 优先从内存读取
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key);
    }
    // 如果内存中没有，尝试从文件加载
    const type = key.replace('academic_writing_', '');
    if (RESOURCE_TYPES.includes(type)) {
      const resources = loadResourcesFromFile(type);
      const jsonData = JSON.stringify(resources);
      memoryStorage.set(key, jsonData);
      return jsonData;
    }
    return null;
  },
  setItem: (key, value) => {
    // 保存到内存
    memoryStorage.set(key, value);
    // 持久化到文件
    const type = key.replace('academic_writing_', '');
    if (RESOURCE_TYPES.includes(type)) {
      try {
        const resources = JSON.parse(value);
        saveResourcesToFile(type, resources);
      } catch (error) {
        console.error(`[存储] 持久化失败 (${key}):`, error);
      }
    }
  },
  removeItem: (key) => {
    memoryStorage.delete(key);
    // 删除文件
    const type = key.replace('academic_writing_', '');
    if (RESOURCE_TYPES.includes(type)) {
      const filePath = getStoragePath(type);
      if (fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, '[]', 'utf-8');
        } catch (error) {
          console.error(`[存储] 清空文件失败 (${key}):`, error);
        }
      }
    }
  },
  clear: () => {
    memoryStorage.clear();
    RESOURCE_TYPES.forEach(type => {
      const filePath = getStoragePath(type);
      if (fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, '[]', 'utf-8');
        } catch (error) {
          console.error(`[存储] 清空文件失败 (${type}):`, error);
        }
      }
    });
  }
};

module.exports = {
  localStorage,
  initializeStorage,
  getStoragePath,
  loadResourcesFromFile,
  saveResourcesToFile
};
