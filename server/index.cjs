/**
 * 学术论文写作系统 - 服务器主入口
 * 
 * 模块结构:
 * - config.cjs: 配置常量
 * - storage.cjs: 文件系统持久化存储
 * - pdfUtils.cjs: PDF处理工具
 * - aiApi.cjs: AI API调用（DeepSeek、Qwen）
 * - tools.cjs: 工具定义和执行
 * - routes/resources.cjs: 资源管理路由
 * - routes/tools.cjs: 工具路由
 * - routes/agent.cjs: Agent路由
 */

const express = require('express');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 导入配置和模块
const { PORT, STORAGE_DIR } = require('./config.cjs');
const { initializeStorage } = require('./storage.cjs');

// 导入路由
const resourcesRouter = require('./routes/resources.cjs');
const toolsRouter = require('./routes/toolsRouter.cjs');
const agentRouter = require('./routes/agent.cjs');

// 创建Express应用
const app = express();

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 添加CORS中间件
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// 注册路由
app.use('/api/resources', resourcesRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/agent', agentRouter);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

// 请求日志记录和统计
const requestLogs = [];
const MAX_LOGS = 100;
const requestStats = {
  total: 0,
  byPath: {},
  byMethod: {},
  errors: 0,
  lastMinute: [],
  startTime: Date.now()
};

// 清理过期的每分钟统计
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60000;
  requestStats.lastMinute = requestStats.lastMinute.filter(t => t > oneMinuteAgo);
}, 5000);

app.use((req, res, next) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  // 记录请求开始（排除监控页面）
  if (req.path !== '/' && req.path !== '/favicon.ico') {
    console.log(`\n[${new Date().toISOString()}] 📥 ${req.method} ${req.path}`);
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // 排除监控页面自身的请求
    if (req.path === '/' || req.path === '/favicon.ico') {
      return;
    }
    
    // 保存完整请求体（用于查看详情）
    let fullBody = null;
    let bodySummary = '';
    if (req.body && Object.keys(req.body).length > 0) {
      // 深拷贝并处理敏感信息
      fullBody = JSON.parse(JSON.stringify(req.body));
      
      // 隐藏 API Key
      if (fullBody.apiKey) {
        fullBody.apiKey = fullBody.apiKey.substring(0, 10) + '...[已隐藏]';
      }
      
      // 截断过长的内容字段用于摘要显示
      const keys = Object.keys(req.body);
      bodySummary = keys.map(k => {
        if (k === 'apiKey') return 'apiKey: [已隐藏]';
        if (k === 'content' && req.body[k]?.length > 100) return `content: [${req.body[k].length}字符]`;
        if (k === 'messages') return `messages: [${req.body[k]?.length || 0}条]`;
        const val = req.body[k];
        if (typeof val === 'string' && val.length > 80) {
          return `${k}: "${val.substring(0, 80)}..."`;
        } else if (typeof val === 'object') {
          return `${k}: ${JSON.stringify(val).substring(0, 50)}`;
        }
        return `${k}: ${val}`;
      }).join(', ');
    }
    
    const log = {
      id: requestId,
      time: new Date().toISOString(),
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '',
      bodySummary: bodySummary,
      bodyFull: fullBody,  // 完整请求体
      status: res.statusCode,
      duration: duration,
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: (req.headers['user-agent'] || '').substring(0, 100)
    };
    
    // 更新统计
    requestStats.total++;
    requestStats.byPath[req.path] = (requestStats.byPath[req.path] || 0) + 1;
    requestStats.byMethod[req.method] = (requestStats.byMethod[req.method] || 0) + 1;
    requestStats.lastMinute.push(Date.now());
    if (res.statusCode >= 400) requestStats.errors++;
    
    // 添加日志
    requestLogs.unshift(log);
    if (requestLogs.length > MAX_LOGS) requestLogs.pop();
    
    // 控制台输出
    const statusIcon = res.statusCode < 400 ? '✅' : '❌';
    console.log(`[${log.time.split('T')[1].split('.')[0]}] ${statusIcon} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    if (bodySummary) {
      console.log(`    📦 ${bodySummary}`);
    }
    
    // 警告：请求过于频繁
    if (requestStats.lastMinute.length > 60) {
      console.warn(`⚠️ 警告: 每分钟请求数过高: ${requestStats.lastMinute.length} 次`);
    }
  });
  next();
});

// 服务器状态监控页面
app.get('/', (req, res) => {
  const { localStorage } = require('./storage.cjs');
  
  // 获取资源统计
  const getResourceCount = (type) => {
    try {
      const data = localStorage.getItem(`academic_writing_${type}`);
      return data ? JSON.parse(data).length : 0;
    } catch { return 0; }
  };
  
  const stats = {
    pdfs: getResourceCount('pdfs'),
    references: getResourceCount('references'),
    images: getResourceCount('images'),
    notes: getResourceCount('notes')
  };
  
  const uptime = process.uptime();
  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>学术写作助手 - 服务器状态</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 40px;
      background: linear-gradient(90deg, #c9a961, #f0d78c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      background: linear-gradient(135deg, #2d5a3d, #1e8449);
      border-radius: 20px;
      font-weight: bold;
      margin-bottom: 30px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.4); }
      50% { box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(10px);
    }
    .card h2 {
      font-size: 1.2rem;
      color: #c9a961;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat-item {
      background: rgba(255, 255, 255, 0.03);
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 1.8rem; font-weight: bold; color: #c9a961; }
    .stat-label { font-size: 0.85rem; color: #888; margin-top: 4px; }
    .route-list { list-style: none; }
    .route-list li {
      padding: 8px 12px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .method {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
      margin-right: 8px;
    }
    .method.get { background: #2ecc71; color: #000; }
    .method.post { background: #3498db; color: #fff; }
    .method.put { background: #f39c12; color: #000; }
    .method.delete { background: #e74c3c; color: #fff; }
    .log-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .log-table th, .log-table td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .log-table th { color: #c9a961; }
    .status-ok { color: #2ecc71; }
    .status-error { color: #e74c3c; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .info-label { color: #888; }
    .refresh-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 15px 25px;
      background: linear-gradient(135deg, #c9a961, #a88a4e);
      color: #000;
      border: none;
      border-radius: 30px;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(201, 169, 97, 0.3);
    }
    .refresh-btn:hover { transform: scale(1.05); }
    .log-row:hover { background: rgba(201, 169, 97, 0.1) !important; }
    .log-row:hover td { color: #fff; }
    .detail-row pre { color: #2ecc71; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📚 学术写作助手</h1>
    <div style="text-align: center;">
      <span class="status-badge">🟢 服务运行中</span>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2>📊 服务器信息</h2>
        <div class="info-row"><span class="info-label">端口</span><span>${PORT}</span></div>
        <div class="info-row"><span class="info-label">运行时间</span><span>${uptimeStr}</span></div>
        <div class="info-row"><span class="info-label">Node.js</span><span>${process.version}</span></div>
        <div class="info-row"><span class="info-label">内存使用</span><span>${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB</span></div>
        <div class="info-row"><span class="info-label">存储目录</span><span style="font-size:0.8rem">${STORAGE_DIR}</span></div>
      </div>
      
      <div class="card">
        <h2>📈 请求统计</h2>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-value">${requestStats.total}</div><div class="stat-label">总请求数</div></div>
          <div class="stat-item"><div class="stat-value" style="color: ${requestStats.lastMinute.length > 30 ? '#e74c3c' : '#2ecc71'}">${requestStats.lastMinute.length}</div><div class="stat-label">每分钟请求</div></div>
          <div class="stat-item"><div class="stat-value" style="color: #e74c3c">${requestStats.errors}</div><div class="stat-label">错误数</div></div>
          <div class="stat-item"><div class="stat-value">${stats.pdfs}</div><div class="stat-label">PDF论文</div></div>
        </div>
      </div>
      
      <div class="card">
        <h2>🔥 热门路径</h2>
        <ul class="route-list">
          ${Object.entries(requestStats.byPath)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([path, count]) => `<li><span style="color:#c9a961;margin-right:10px">${count}次</span>${path}</li>`)
            .join('') || '<li>暂无数据</li>'}
        </ul>
      </div>
      
      <div class="card">
        <h2>📁 资源统计</h2>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-value">${stats.pdfs}</div><div class="stat-label">PDF论文</div></div>
          <div class="stat-item"><div class="stat-value">${stats.references}</div><div class="stat-label">参考文献</div></div>
          <div class="stat-item"><div class="stat-value">${stats.images}</div><div class="stat-label">图片</div></div>
          <div class="stat-item"><div class="stat-value">${stats.notes}</div><div class="stat-label">笔记</div></div>
        </div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 20px;">
      <h2>📝 详细请求日志 (最新 ${Math.min(requestLogs.length, 30)} 条) <span style="font-size:0.8rem;color:#888">点击行查看完整内容</span></h2>
      <div style="overflow-x: auto;">
        <table class="log-table">
          <thead>
            <tr>
              <th style="width:80px">时间</th>
              <th style="width:60px">方法</th>
              <th>路径</th>
              <th>请求摘要</th>
              <th style="width:50px">状态</th>
              <th style="width:60px">耗时</th>
            </tr>
          </thead>
          <tbody>
            ${requestLogs.slice(0, 30).map((log, index) => `
              <tr class="log-row" onclick="toggleDetail(${index})" style="cursor:pointer">
                <td style="white-space:nowrap">${log.time.split('T')[1].split('.')[0]}</td>
                <td><span class="method ${log.method.toLowerCase()}">${log.method}</span></td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">${log.path}</td>
                <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;font-size:0.8rem;color:#aaa">${log.bodySummary || '-'}</td>
                <td class="${log.status < 400 ? 'status-ok' : 'status-error'}">${log.status}</td>
                <td>${log.duration}ms</td>
              </tr>
              <tr class="detail-row" id="detail-${index}" style="display:none">
                <td colspan="6" style="background:rgba(0,0,0,0.3);padding:15px">
                  <div style="font-family:monospace;font-size:0.85rem">
                    <div style="margin-bottom:10px">
                      <strong style="color:#c9a961">📍 完整路径:</strong> 
                      <span style="color:#2ecc71">${log.path}${log.query ? '?' + log.query : ''}</span>
                    </div>
                    <div style="margin-bottom:10px">
                      <strong style="color:#c9a961">🌐 来源:</strong> 
                      <span>${log.ip}</span>
                      <span style="margin-left:20px;color:#888">${log.userAgent || 'Unknown'}</span>
                    </div>
                    <div>
                      <strong style="color:#c9a961">📦 请求体 (完整):</strong>
                      <pre style="background:rgba(0,0,0,0.4);padding:12px;border-radius:8px;margin-top:8px;overflow-x:auto;max-height:400px;overflow-y:auto;white-space:pre-wrap;word-break:break-all">${log.bodyFull ? JSON.stringify(log.bodyFull, null, 2) : '无请求体'}</pre>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2>🔗 API 路由</h2>
        <ul class="route-list">
          <li><span class="method get">GET</span>/api/health</li>
          <li><span class="method get">GET</span>/api/tools</li>
          <li><span class="method post">POST</span>/api/tools/execute</li>
          <li><span class="method post">POST</span>/api/agent</li>
          <li><span class="method post">POST</span>/api/agent/stream</li>
          <li><span class="method get">GET</span>/api/resources/:type</li>
          <li><span class="method post">POST</span>/api/resources/:type</li>
        </ul>
      </div>
      
      <div class="card">
        <h2>🛠️ 可用工具</h2>
        <ul class="route-list">
          <li>📚 search_papers - 搜索论文</li>
          <li>⬇️ download_paper - 下载论文</li>
          <li>📖 read_pdf_content - 读取PDF</li>
          <li>👁️ view_file - 查看文件</li>
          <li>✏️ edit_file - 编辑文件</li>
          <li>🔍 search_in_file - 搜索文件</li>
          <li>📋 list_resources - 资源列表</li>
        </ul>
      </div>
    </div>
  </div>
  
  <button class="refresh-btn" onclick="location.reload()">🔄 刷新</button>
  
  <script>
    // 展开/收起详情
    function toggleDetail(index) {
      const detail = document.getElementById('detail-' + index);
      if (detail.style.display === 'none') {
        // 关闭其他展开的详情
        document.querySelectorAll('.detail-row').forEach(row => row.style.display = 'none');
        detail.style.display = 'table-row';
        // 暂停自动刷新
        clearTimeout(window.refreshTimer);
        document.querySelector('.refresh-btn').textContent = '🔄 已暂停(点击刷新)';
      } else {
        detail.style.display = 'none';
        // 恢复自动刷新
        startAutoRefresh();
      }
    }
    
    // 自动刷新
    function startAutoRefresh() {
      window.countdown = 10;
      const btn = document.querySelector('.refresh-btn');
      
      clearInterval(window.countdownTimer);
      window.countdownTimer = setInterval(() => {
        window.countdown--;
        if (window.countdown > 0) {
          btn.textContent = '🔄 ' + window.countdown + 's';
        }
      }, 1000);
      
      clearTimeout(window.refreshTimer);
      window.refreshTimer = setTimeout(() => location.reload(), 10000);
    }
    
    startAutoRefresh();
  </script>
</body>
</html>
  `;
  
  res.type('html').send(html);
});

// 初始化存储并启动服务器
initializeStorage();

const server = app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`存储目录: ${STORAGE_DIR}`);
  console.log('\n已注册的路由:');
  console.log('  - GET/POST /api/resources/:type');
  console.log('  - PUT/DELETE /api/resources/:type/:id');
  console.log('  - POST /api/resources/:type/:id/insert');
  console.log('  - GET /api/tools');
  console.log('  - POST /api/tools/execute');
  console.log('  - POST /api/agent');
  console.log('  - POST /api/agent/stream');
  console.log('  - GET /api/health');
});

module.exports = app;
