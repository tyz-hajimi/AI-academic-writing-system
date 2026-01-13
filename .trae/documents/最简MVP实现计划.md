# 最简MVP实现计划

## 一、核心需求
- 三栏主界面：左侧预览、中间编辑、右侧对话
- 循环写作agent功能：支持基本的写作辅助（续写、优化等）

## 二、技术栈选择
- **前端**：React + TypeScript
- **编辑器**：Monaco Editor（VS Code内核，支持LaTeX）
- **状态管理**：React内置状态管理
- **后端**：Node.js + Express（简单实现）

## 三、实现步骤

### 1. 项目初始化
- 创建React + TypeScript项目
- 配置必要的依赖

### 2. 三栏布局实现
- 使用CSS Grid + Flexbox实现响应式三栏布局
- 左侧：PDF预览区域（初始可显示纯文本）
- 中间：Monaco Editor编辑区域
- 右侧：Agent对话区域

### 3. 编辑器集成
- 集成Monaco Editor
- 配置LaTeX语法高亮
- 实现基本的编辑功能

### 4. 循环写作Agent实现
- 实现简单的Agent接口
- 支持基本的写作模式：续写、优化、扩展
- 模拟Agent响应（后续可接入真实大模型）

### 5. 前后端通信
- 实现简单的Express服务器
- 配置API接口
- 实现实时通信（可选，初始可使用HTTP请求）

## 四、文件结构
```
├── src/
│   ├── components/
│   │   ├── ThreePanelLayout.tsx  # 三栏布局组件
│   │   ├── MonacoEditor.tsx      # 编辑器组件
│   │   ├── PreviewPanel.tsx      # 预览面板组件
│   │   └── AgentChat.tsx         # Agent对话组件
│   ├── services/
│   │   └── agentService.ts       # Agent服务调用
│   ├── App.tsx                   # 主应用组件
│   └── index.tsx                 # 入口文件
└── server/
    └── index.ts                   # 后端服务器
```

## 五、核心功能实现

### 1. 三栏布局
```tsx
const ThreePanelLayout: React.FC = () => {
  return (
    <div className="three-panel-layout">
      <PreviewPanel />
      <MonacoEditor />
      <AgentChat />
    </div>
  );
};
```

### 2. Agent对话界面
```tsx
const AgentChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [writingMode, setWritingMode] = useState<'continue' | 'optimize' | 'expand'>('continue');

  const handleSend = async () => {
    // 发送请求到Agent服务
    const response = await agentService.sendRequest({
      input,
      writingMode,
      // 其他上下文信息
    });
    
    // 更新对话记录
    setMessages([...messages, { role: 'user', content: input }, { role: 'agent', content: response }]);
    setInput('');
  };

  return (
    <div className="agent-chat">
      {/* 对话历史 */}
      <div className="chat-history">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      {/* 输入区域 */}
      <div className="chat-input">
        <select value={writingMode} onChange={(e) => setWritingMode(e.target.value as any)}>
          <option value="continue">续写</option>
          <option value="optimize">优化</option>
          <option value="expand">扩展</option>
        </select>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>发送</button>
      </div>
    </div>
  );
};
```

### 3. Agent服务调用
```ts
const agentService = {
  async sendRequest(data: any): Promise<string> {
    // 初始可模拟响应
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`这是Agent的${data.writingMode}响应：${data.input}`);
      }, 1000);
    });
    
    // 后续可接入真实API
    // const response = await fetch('/api/agent', { method: 'POST', body: JSON.stringify(data) });
    // return response.text();
  }
};
```

## 六、预期效果
- 实现三栏式布局，左侧预览、中间编辑、右侧对话
- 中间编辑器支持LaTeX语法高亮和基本编辑功能
- 右侧对话区域支持选择写作模式并与Agent交互
- Agent能够根据用户输入和写作模式返回相应的响应

## 七、后续扩展
- 接入真实大模型API
- 实现PDF实时预览
- 支持更多写作模式
- 优化用户体验

这个最简MVP将为后续功能扩展奠定基础，同时快速验证核心概念的可行性。