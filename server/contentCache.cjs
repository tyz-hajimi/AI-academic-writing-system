/**
 * 论文内容缓存模块
 * 将论文内容存储在后端，前端只需发送内容ID
 */

const crypto = require('crypto');

// 内容缓存 Map: contentId -> { content, hash, lastAccess, createTime }
const contentCache = new Map();

// 配置
const CACHE_MAX_SIZE = 50;  // 最多缓存50篇论文
const CACHE_TTL = 2 * 60 * 60 * 1000;  // 2小时过期

/**
 * 生成内容哈希
 */
function generateHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
}

/**
 * 生成内容ID
 */
function generateContentId() {
  return `content_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

/**
 * 存储论文内容
 * @param {string} content - 论文内容
 * @returns {{ contentId: string, isNew: boolean, size: number }}
 */
function storeContent(content) {
  if (!content || typeof content !== 'string') {
    return { contentId: null, isNew: false, size: 0 };
  }

  const hash = generateHash(content);
  
  // 检查是否已存在相同内容（通过哈希去重）
  for (const [id, cached] of contentCache.entries()) {
    if (cached.hash === hash) {
      // 更新访问时间
      cached.lastAccess = Date.now();
      console.log(`[ContentCache] 内容已存在，复用 ID: ${id} (${(cached.content.length / 1024).toFixed(1)} KB)`);
      return { contentId: id, isNew: false, size: cached.content.length };
    }
  }

  // 清理过期缓存
  cleanExpiredCache();

  // 如果缓存满了，删除最旧的
  if (contentCache.size >= CACHE_MAX_SIZE) {
    let oldestId = null;
    let oldestTime = Infinity;
    for (const [id, cached] of contentCache.entries()) {
      if (cached.lastAccess < oldestTime) {
        oldestTime = cached.lastAccess;
        oldestId = id;
      }
    }
    if (oldestId) {
      contentCache.delete(oldestId);
      console.log(`[ContentCache] 缓存已满，删除最旧: ${oldestId}`);
    }
  }

  // 存储新内容
  const contentId = generateContentId();
  contentCache.set(contentId, {
    content,
    hash,
    createTime: Date.now(),
    lastAccess: Date.now()
  });

  console.log(`[ContentCache] 存储新内容: ${contentId} (${(content.length / 1024).toFixed(1)} KB)`);
  return { contentId, isNew: true, size: content.length };
}

/**
 * 获取论文内容
 * @param {string} contentId - 内容ID
 * @returns {string|null}
 */
function getContent(contentId) {
  if (!contentId) return null;

  const cached = contentCache.get(contentId);
  if (!cached) {
    console.log(`[ContentCache] 未找到内容: ${contentId}`);
    return null;
  }

  // 检查是否过期
  if (Date.now() - cached.lastAccess > CACHE_TTL) {
    contentCache.delete(contentId);
    console.log(`[ContentCache] 内容已过期: ${contentId}`);
    return null;
  }

  // 更新访问时间
  cached.lastAccess = Date.now();
  return cached.content;
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, cached] of contentCache.entries()) {
    if (now - cached.lastAccess > CACHE_TTL) {
      contentCache.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[ContentCache] 清理了 ${cleaned} 个过期缓存`);
  }
}

/**
 * 获取缓存统计
 */
function getCacheStats() {
  const stats = {
    count: contentCache.size,
    maxSize: CACHE_MAX_SIZE,
    items: []
  };

  let totalSize = 0;
  for (const [id, cached] of contentCache.entries()) {
    const size = cached.content.length;
    totalSize += size;
    stats.items.push({
      id,
      size: `${(size / 1024).toFixed(1)} KB`,
      age: `${Math.round((Date.now() - cached.createTime) / 1000 / 60)} 分钟`
    });
  }
  stats.totalSize = `${(totalSize / 1024 / 1024).toFixed(2)} MB`;

  return stats;
}

/**
 * 清空缓存
 */
function clearCache() {
  contentCache.clear();
  console.log('[ContentCache] 缓存已清空');
}

module.exports = {
  storeContent,
  getContent,
  getCacheStats,
  clearCache
};
