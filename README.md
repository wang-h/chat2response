# Chat2Response

**OpenAI Responses API → Chat Completions Bridge**

让 Codex 0.118+ 能够使用国内大模型（智谱 GLM、Kimi、DeepSeek、MiniMax）的代理服务器。

🌐 [English Documentation](./README.en.md) | 中文文档

## 致谢

本项目由 **[Kimi Code](https://kimi.moonshot.cn/)** (kimi-coding) 辅助创建。

Kimi Code 是 [月之暗面](https://www.moonshot.cn/)（Moonshot AI）开发的 AI 编程助手，为项目提供了：
- 架构设计
- 核心代码实现
- 文档编写
- 测试调试

感谢 Kimi Code 对本项目的贡献！

## 特性

- ✅ **完整的 Streaming 事件序列** - 严格遵循 OpenAI Responses API 规范
  - `response.created` → `response.output_item.added` → `response.content_part.added` → `response.output_text.delta` → `response.output_text.done` → `response.content_part.done` → `response.output_item.done` → `response.completed` → `[DONE]`
- ✅ **桌面应用** - Windows 和 macOS 原生应用，支持菜单栏和系统托盘
- ✅ **Tool Call 转换** - 自动将 `web_search` 等内置工具转换为标准函数调用
- ✅ **多提供商支持** - GLM、Kimi、DeepSeek、MiniMax
- ✅ **Streaming & Non-streaming** - 支持流式和非流式响应
- ✅ **自动降级** - GLM 不支持工具调用时自动移除 tools

## 快速开始

### 方式一：桌面应用（推荐）

为 Windows 和 Mac 用户提供图形界面，无需命令行操作。

#### 1. 下载安装包

从 [Releases](https://github.com/wang-h/chat2response/releases) 下载对应系统的安装包：

| 系统 | 安装包 | 说明 |
|------|--------|------|
| macOS Apple Silicon | `Chat2Response-2.0.0-arm64.dmg` | M1/M2/M3 Mac |
| macOS Intel | `Chat2Response-2.0.0-x64.dmg` | Intel Mac |
| Windows | `Chat2Response-2.0.0.exe` | 64位 Windows |

#### 2. 安装应用

**macOS 安装步骤：**

1. 下载 `.dmg` 文件
2. 双击打开，将 **Chat2Response** 拖拽到 **Applications** 文件夹
   ```
   ┌─────────────────────────┐
   │  Chat2Response.app    ➡️ │
   │     ↓ 拖拽到              │
   │  Applications 文件夹     │
   └─────────────────────────┘
   ```
3. 打开 **启动台** 或 **Applications** 文件夹，点击 Chat2Response
4. 如果提示"无法打开"，前往 **系统设置 > 隐私与安全性** > 点击"仍要打开"

**Windows 安装步骤：**

1. 下载 `.exe` 安装程序
2. 双击运行安装向导
3. 选择安装位置（默认即可）
4. 完成安装，从开始菜单启动 Chat2Response

#### 2. 配置 API Keys

打开应用，在界面中填入至少一个 API Key：
- GLM API Key（可选）
- DeepSeek API Key（推荐）
- Kimi API Key（可选）
- MiniMax API Key（可选）

#### 3. 启动服务器

点击"启动服务器"按钮，看到状态变为"运行中"即可。

**快捷键：**
- `Cmd/Ctrl + S` - 启动/停止服务器
- `Cmd/Ctrl + ,` - 打开偏好设置
- `Cmd/Ctrl + Q` - 退出应用

**菜单栏功能：**
- **Server 菜单**：启动/停止服务器、打开配置目录
- **Help 菜单**：GitHub 仓库、问题反馈、使用文档

#### 4. 配置 Codex

复制界面显示的 Codex 配置，添加到 `~/.codex/config.toml`。

### 方式二：命令行版本

适合开发者或喜欢命令行的用户。

#### 1. 安装依赖

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
| GLM | glm-5.1 | ❌ | ✅ | 自动移除 tools |
| Kimi | kimi-coding | ✅ | ✅ | Kimi for Coding 专用 |
| DeepSeek | deepseek-chat | ✅ | ✅ | **推荐** |
| MiniMax | minimax-2.7 | ✅ | ✅ | - |

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

## 贡献者

请查看 [CONTRIBUTORS.md](./CONTRIBUTORS.md) 了解项目贡献者列表。

## License

MIT License - 详见 [LICENSE](./LICENSE)

Copyright (c) 2026 Chat2Response Contributors
