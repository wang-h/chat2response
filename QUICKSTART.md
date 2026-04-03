# Chat2Response v2.0 快速开始

## 1. 安装

```bash
cd ~/chat2response-v2
npm install
npm run build
```

## 2. 配置环境变量

```bash
# 编辑 .env 文件
vim .env
```

```bash
# DeepSeek (推荐)
DEEPSEEK_API_KEY=sk-your-key
DEFAULT_PROVIDER=deepseek

# 或 GLM
GLM_API_KEY=your-glm-key
DEFAULT_PROVIDER=glm

# 或 Kimi
KIMI_API_KEY=your-kimi-key
DEFAULT_PROVIDER=kimi

# 或 MiniMax
MINIMAX_API_KEY=your-minimax-key
DEFAULT_PROVIDER=minimax
```

## 3. 启动服务器

```bash
npm start
```

你应该看到：
```
╔════════════════════════════════════════════════════════╗
║           Chat2Response v2.0.0                         ║
║  OpenAI Responses API → Chat Completions Bridge        ║
╠════════════════════════════════════════════════════════╣
║  Server: http://localhost:3456                         ║
║  Health: http://localhost:3456/health                  ║
...
```

## 4. 配置 Codex

编辑 `~/.codex/config.toml`：

```toml
model = "deepseek-chat"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:3456/v1"
env_key = "DEEPSEEK_API_KEY"
```

## 5. 测试

```bash
# 测试 health 端点
curl http://localhost:3456/health

# 测试 Responses API
curl -X POST http://localhost:3456/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "input": "Hello, how are you?",
    "stream": true
  }'
```

## 6. 使用 Codex

```bash
codex
```

选择 `local` provider，开始使用！

## 调试

```bash
# 开启调试模式
DEBUG=true npm start
```

## 切换提供商

### 方式 1: 环境变量
```bash
DEFAULT_PROVIDER=glm npm start
```

### 方式 2: 请求头
```bash
curl -X POST http://localhost:3456/v1/responses \
  -H "X-Provider: kimi" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 方式 3: 多个 Codex 配置
```toml
[model_providers.deepseek]
name = "DeepSeek"
base_url = "http://localhost:3456/v1"
env_key = "DEEPSEEK_API_KEY"

[model_providers.glm]
name = "GLM"
base_url = "http://localhost:3456/v1"
env_key = "GLM_API_KEY"
```

## 故障排除

### 端口被占用
```bash
lsof -ti:3456 | xargs kill -9
npm start
```

### 流式响应断开
- 检查 DEBUG=true 输出
- 确认提供商 API 正常
- 检查 API Key 是否有效

### Tool Calling 错误
- GLM 不支持工具调用，会自动降级
- 其他提供商确保模型支持 function calling

## 项目结构

```
chat2response-v2/
├── src/
│   ├── types.ts           # 类型定义
│   ├── converter.ts       # 核心转换逻辑 (Streaming 事件序列)
│   ├── providers/         # 提供商配置
│   └── app.ts             # Express 应用
├── dist/                  # 编译输出
├── test-streaming.js      # 测试脚本
├── .env                   # 环境变量
└── README.md              # 完整文档
```

## Streaming 事件序列

本代理严格遵循 OpenAI Responses API 规范：

```
data: {"type":"response.created",...}
data: {"type":"response.in_progress",...}
data: {"type":"response.output_item.added",...}
data: {"type":"response.content_part.added",...}
data: {"type":"response.output_text.delta","delta":"Hello"}
data: {"type":"response.output_text.delta","delta":" world"}
data: {"type":"response.output_text.done",...}
data: {"type":"response.content_part.done",...}
data: {"type":"response.output_item.done",...}
data: {"type":"response.completed",...}
data: [DONE]
```

## 参考

- 基于 [devproxy](https://github.com/daydaychen/devproxy) (Go) 的 streaming 事件逻辑
- 参考 OpenAI Responses API 官方文档
