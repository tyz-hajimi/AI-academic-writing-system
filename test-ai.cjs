/**
 * AI 对话功能测试脚本
 * 
 * 使用方法:
 *   node test-ai.cjs [模型] [API密钥]
 * 
 * 示例:
 *   node test-ai.cjs deepseek sk-xxx
 *   node test-ai.cjs qwen sk-xxx
 *   node test-ai.cjs deepseek-reasoner sk-xxx
 */

const http = require('http');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(colors.bright + colors.cyan, `  ${title}`);
  console.log('='.repeat(60));
}

// 测试健康检查
async function testHealth() {
  logSection('测试 1: 健康检查');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/health',
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            log(colors.green, '✅ 健康检查通过');
            log(colors.blue, `   服务器时间: ${json.data.timestamp}`);
            resolve(true);
          } else {
            log(colors.red, '❌ 健康检查失败:', json);
            resolve(false);
          }
        } catch (e) {
          log(colors.red, '❌ 解析响应失败:', e.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      log(colors.red, '❌ 连接失败:', e.message);
      log(colors.yellow, '💡 请确保后端服务器正在运行: node server/index.cjs');
      resolve(false);
    });
    
    req.end();
  });
}

// 测试普通请求 (Qwen)
async function testNormalRequest(apiKey) {
  logSection('测试 2: 普通请求 (Qwen)');
  
  if (!apiKey) {
    log(colors.yellow, '⏭️ 跳过: 未提供 Qwen API Key');
    return null;
  }
  
  const requestBody = JSON.stringify({
    content: '这是一篇关于人工智能的论文草稿。',
    input: '你好，请简单介绍一下你自己。',
    mode: 'discuss',
    model: 'qwen',
    apiKey: apiKey,
    messages: []
  });
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - startTime;
        
        try {
          const json = JSON.parse(data);
          if (json.success) {
            log(colors.green, `✅ Qwen 普通请求成功 (耗时: ${elapsed}ms)`);
            log(colors.blue, `   响应长度: ${json.data.response.length} 字符`);
            log(colors.blue, `   响应预览: ${json.data.response.substring(0, 100)}...`);
            resolve(true);
          } else {
            log(colors.red, `❌ Qwen 请求失败: ${json.error}`);
            resolve(false);
          }
        } catch (e) {
          log(colors.red, '❌ 解析响应失败:', e.message);
          log(colors.yellow, '   原始响应:', data.substring(0, 200));
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      log(colors.red, '❌ 请求失败:', e.message);
      resolve(false);
    });
    
    req.write(requestBody);
    req.end();
  });
}

// 测试流式请求 (DeepSeek)
async function testStreamRequest(model, apiKey) {
  const modelName = model === 'deepseek-reasoner' ? 'DeepSeek Reasoner' : 'DeepSeek';
  logSection(`测试 3: 流式请求 (${modelName})`);
  
  if (!apiKey) {
    log(colors.yellow, `⏭️ 跳过: 未提供 DeepSeek API Key`);
    return null;
  }
  
  const requestBody = JSON.stringify({
    content: '这是一篇关于人工智能的论文草稿。',
    input: '你好，请用一句话介绍人工智能。',
    mode: 'discuss',
    model: model,
    apiKey: apiKey,
    messages: []
  });
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let fullResponse = '';
    let fullReasoning = '';
    let chunkCount = 0;
    
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/agent/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (res) => {
      log(colors.blue, `   连接建立, 状态码: ${res.statusCode}`);
      
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }
            
            try {
              const event = JSON.parse(data);
              
              if (event.type === 'start') {
                log(colors.cyan, `   🚀 流式开始, 模型: ${event.model}`);
              } else if (event.type === 'chunk') {
                chunkCount++;
                if (event.content) {
                  fullResponse = event.full_response || '';
                }
                if (event.reasoning_content) {
                  fullReasoning = event.full_reasoning || '';
                }
                // 每10个chunk显示一次进度
                if (chunkCount % 10 === 0) {
                  process.stdout.write(colors.yellow + '.' + colors.reset);
                }
              } else if (event.type === 'complete') {
                const elapsed = Date.now() - startTime;
                console.log(); // 换行
                log(colors.green, `✅ ${modelName} 流式请求成功 (耗时: ${elapsed}ms)`);
                log(colors.blue, `   数据块数量: ${chunkCount}`);
                log(colors.blue, `   响应长度: ${event.full_response?.length || 0} 字符`);
                
                if (event.full_reasoning) {
                  log(colors.yellow, `   🧠 思考过程: ${event.full_reasoning.length} 字符`);
                  log(colors.yellow, `   思考预览: ${event.full_reasoning.substring(0, 100)}...`);
                }
                
                log(colors.blue, `   响应预览: ${(event.full_response || '').substring(0, 100)}...`);
                
                if (event.tool_calls && event.tool_calls.length > 0) {
                  log(colors.cyan, `   🔧 工具调用: ${event.tool_calls.length} 个`);
                }
                
                resolve(true);
              } else if (event.type === 'error') {
                console.log(); // 换行
                log(colors.red, `❌ 流式错误: ${event.error}`);
                resolve(false);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
      
      res.on('end', () => {
        if (chunkCount === 0) {
          log(colors.red, '❌ 未收到任何数据块');
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      log(colors.red, '❌ 流式请求失败:', e.message);
      resolve(false);
    });
    
    log(colors.blue, '   发送请求中...');
    req.write(requestBody);
    req.end();
  });
}

// 测试工具列表
async function testToolsList() {
  logSection('测试 4: 获取工具列表');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/tools',
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data.tools) {
            log(colors.green, `✅ 获取工具列表成功`);
            log(colors.blue, `   可用工具数量: ${json.data.tools.length}`);
            json.data.tools.forEach(tool => {
              log(colors.cyan, `   - ${tool.name}: ${tool.description.substring(0, 40)}...`);
            });
            resolve(true);
          } else {
            log(colors.red, '❌ 获取工具列表失败:', json);
            resolve(false);
          }
        } catch (e) {
          log(colors.red, '❌ 解析响应失败:', e.message);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      log(colors.red, '❌ 请求失败:', e.message);
      resolve(false);
    });
    
    req.end();
  });
}

// 主函数
async function main() {
  console.log('\n');
  log(colors.bright + colors.cyan, '╔════════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.cyan, '║          AI 对话功能测试脚本                               ║');
  log(colors.bright + colors.cyan, '╚════════════════════════════════════════════════════════════╝');
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const model = args[0] || 'deepseek';
  const apiKey = args[1] || '';
  
  log(colors.yellow, `\n📋 测试配置:`);
  log(colors.blue, `   模型: ${model}`);
  log(colors.blue, `   API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : '未提供'}`);
  
  if (!apiKey) {
    log(colors.yellow, '\n⚠️ 未提供 API Key，将只测试基础连接');
    log(colors.yellow, '   使用方法: node test-ai.cjs <模型> <API密钥>');
    log(colors.yellow, '   示例: node test-ai.cjs deepseek sk-xxxxxxxx');
  }
  
  const results = {
    health: false,
    tools: false,
    normal: null,
    stream: null,
  };
  
  // 运行测试
  results.health = await testHealth();
  
  if (!results.health) {
    log(colors.red, '\n❌ 服务器未运行，终止测试');
    process.exit(1);
  }
  
  results.tools = await testToolsList();
  
  if (apiKey) {
    if (model === 'qwen') {
      results.normal = await testNormalRequest(apiKey);
    } else {
      results.stream = await testStreamRequest(model, apiKey);
    }
  }
  
  // 显示测试结果汇总
  logSection('测试结果汇总');
  
  const statusIcon = (result) => {
    if (result === null) return colors.yellow + '⏭️ 跳过' + colors.reset;
    return result ? colors.green + '✅ 通过' + colors.reset : colors.red + '❌ 失败' + colors.reset;
  };
  
  console.log(`   健康检查:     ${statusIcon(results.health)}`);
  console.log(`   工具列表:     ${statusIcon(results.tools)}`);
  console.log(`   普通请求:     ${statusIcon(results.normal)}`);
  console.log(`   流式请求:     ${statusIcon(results.stream)}`);
  
  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;
  const skipped = Object.values(results).filter(r => r === null).length;
  
  console.log('\n' + '-'.repeat(40));
  log(colors.bright, `   总计: ${passed} 通过, ${failed} 失败, ${skipped} 跳过`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
