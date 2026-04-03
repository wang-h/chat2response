# Chat2Response v2.0

**OpenAI Responses API → Chat Completions Bridge**

让 Codex 0.118+ 能够使用国内大模型（智谱 GLM、Kimi、DeepSeek、MiniMax）的代理服务器。

## 特性

- ✅ **完整的 Streaming 事件序列** - 严格遵循 OpenAI Responses API 规范
  - `response.created` → `response.output_item.added` → `response.content_part.added` → `response.output_text.delta` → `response.output_text.done` → `response.content_part.done` → `response.output_item.done` → `response.completed` → `[DONE]`
- ✅ **Tool Call 转换** - 自动将 `web_search` 等内置工具转换为标准函数调用
- ✅ **多提供商支持** - GLM、Kimi、DeepSeek、MiniMax
- ✅ **Streaming & Non-streaming** - 支持流式和非流式响应
- ✅ **自动降级** - GLM 不支持工具调用时自动移除 tools

## 快速开始

### 1. 安装依赖

```bash
cd chat2response-v2
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Keys
```

```bash
GLM_API_KEY=your_glm_key
KIMI_API_KEY=your_kimi_key
DEEPSEEK_API_KEY=your_deepseek_key
MINIMAX_API_KEY=your_minimax_key
DEFAULT_PROVIDER=deepseek
```

### 3. 启动服务器

```bash
npm run build
npm start

# 或开发模式
npm run dev
```

### 4. 配置 Codex

编辑 `~/.codex/config.toml`：

```toml
model = "deepseek-chat"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:3456/v1"
env_key = "DEEPSEEK_API_KEY"
```

## API 端点

| 端点 | 描述 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /v1/models` | 列出可用模型 |
| `POST /v1/responses` | **主要** - Responses API → Chat Completions |
| `POST /v1/chat/completions` | 透传 - 用于测试 |

## 选择提供商

### 方式 1: 环境变量（默认）
```bash
DEFAULT_PROVIDER=glm npm start
```

### 方式 2: 请求头
```bash
curl -X POST http://localhost:3456/v1/responses \
  -H "Content-Type: application/json" \
  -H "X-Provider: deepseek" \
  -d '{"model":"deepseek-chat","input":"Hello"}'
```

### 方式 3: Codex 配置
```toml
[model_providers.glm]
name = "GLM"
base_url = "http://localhost:3456/v1"
env_key = "GLM_API_KEY"
```

## 提供商支持情况

| 提供商 | 模型示例 | 工具调用 | Streaming | 备注 |
|--------|----------|----------|-----------|------|
| GLM | glm-4.6 | ❌ | ✅ | 自动移除 tools |
| Kimi | kimi-k2-0711-preview | ✅ | ✅ | - |
| DeepSeek | deepseek-chat | ✅ | ✅ | **推荐** |
| MiniMax | abab6.5s-chat | ✅ | ✅ | - |

## Streaming 事件序列

本代理严格遵循 OpenAI Responses API 的 streaming 事件规范：

```
data: {"type":"response.created",...}
data: {"type":"response.in_progress",...}
data: {"type":"response.output_item.added",...}
data: {"type":"response.content_part.added",...}
data: {"type":"response.output_text.delta","delta":"Hello"...}
data: {"type":"response.output_text.delta","delta":" world"...}
data: {"type":"response.output_text.done",...}
data: {"type":"response.content_part.done",...}
data: {"type":"response.output_item.done",...}
data: {"type":"response.completed",...}
data: [DONE]
```

## 调试

```bash
DEBUG=true npm start
```

## 项目结构

```
chat2response-v2/
├── src/
│   ├── types.ts           # TypeScript 类型定义
│   ├── converter.ts       # 核心转换逻辑
│   ├── providers/
│   │   └── index.ts       # 提供商配置
│   └── app.ts             # Express 应用
├── package.json
├── tsconfig.json
└── README.md
```

## 技术细节

### Request 转换 (Responses → Chat Completions)

1. `input` → `messages`
2. `instructions` → `system` message
3. `tools` → OpenAI function format
4. `tool_choice` → 透传

### Response 转换 (Chat Completions → Responses)

1. 生成完整的 streaming 事件序列
2. 积累 text delta 生成 `output_text.done`
3. 包装 response object 包含 usage

## 相关项目

- [devproxy](https://github.com/daydaychen/devproxy) (Go) - 灵感来源，MITM 代理方案
- [aiproxy](https://github.com/labring/aiproxy) (Go) - 多协议 AI 网关

## License

MIT
