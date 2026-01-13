# DeepSeek和Qwen APIkey接入方案

## 一、需求分析
需要为学术论文智能写作系统添加DeepSeek和Qwen的APIkey接入功能，实现真实大模型调用，取消模拟功能。

## 二、技术方案

### 1. 前端部分

#### 1.1 新增APIkey配置界面
- 在右侧Agent面板添加模型选择和APIkey配置功能
- 支持切换不同模型（DeepSeek、Qwen）
- 提供APIkey输入和保存功能

#### 1.2 修改AgentChat组件
- 添加模型选择下拉菜单
- 添加APIkey输入框（带加密存储）
- 修改请求格式，包含模型类型

#### 1.3 更新agentService.ts
- 支持发送模型类型和APIkey到后端
- 增强错误处理机制

### 2. 后端部分

#### 2.1 修改server.js
- 移除模拟响应功能
- 实现DeepSeek API调用逻辑
- 实现Qwen API调用逻辑
- 支持根据请求选择不同模型

#### 2.2 环境变量配置
- 添加.env文件支持
- 支持从环境变量读取APIkey
- 优先级：请求APIkey > 环境变量APIkey

### 3. 安全考虑
- APIkey在前端加密存储（localStorage + 简单加密）
- 后端APIkey不返回给前端
- 实现请求限流和安全验证

## 三、实现步骤

### 1. 前端实现
- [ ] 修改AgentChat组件，添加模型选择和APIkey配置
- [ ] 更新agentService.ts，支持模型类型和APIkey传递
- [ ] 实现APIkey的本地存储和加密

### 2. 后端实现
- [ ] 安装必要依赖（dotenv、axios等）
- [ ] 修改server.js，移除模拟响应，添加模型调用逻辑
- [ ] 实现DeepSeek API调用
- [ ] 实现Qwen API调用
- [ ] 添加环境变量支持

### 3. 测试与优化
- [ ] 测试不同模型的调用效果
- [ ] 优化错误处理机制
- [ ] 测试APIkey安全存储

## 四、核心代码设计

### 1. 前端模型选择界面
```tsx
// AgentChat组件中添加
<select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
  <option value="deepseek">DeepSeek</option>
  <option value="qwen">Qwen</option>
</select>
<input
  type="password"
  placeholder="输入APIkey"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
/>
<button onClick={saveApiKey}>保存APIkey</button>
```

### 2. 后端模型调用
```javascript
// 模型调用函数
async function callModel(model, apiKey, prompt) {
  switch(model) {
    case 'deepseek':
      return callDeepSeek(apiKey, prompt);
    case 'qwen':
      return callQwen(apiKey, prompt);
    default:
      throw new Error(`不支持的模型类型: ${model}`);
  }
}

// DeepSeek API调用
async function callDeepSeek(apiKey, prompt) {
  // DeepSeek API调用逻辑
}

// Qwen API调用
async function callQwen(apiKey, prompt) {
  // Qwen API调用逻辑
}
```

## 五、预期效果
- 用户可以在界面上选择使用DeepSeek或Qwen模型
- 支持输入和保存APIkey
- 系统根据选择的模型调用相应的API
- APIkey安全存储，不被泄露
- 提供友好的错误提示

这个方案将使系统支持真实大模型调用，提升写作辅助的质量和效果，取消了模拟功能。