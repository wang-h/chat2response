# Chat2Response

**OpenAI Responses API → Chat Completions Bridge**

A proxy server that enables OpenAI Codex 0.118+ to work with Chinese LLM providers (GLM, Kimi, DeepSeek, MiniMax) that only support the Chat Completions API.

## The Problem

OpenAI Codex 0.118+ **completely removed** Chat Completions support and now **only** works with the Responses API. However, most Chinese LLM providers (GLM, Kimi, DeepSeek, MiniMax) only support the Chat Completions API.

**This project bridges that gap.**

## Features

- ✅ **Full Streaming Event Sequence** - Strictly follows OpenAI Responses API specification
  - `response.created` → `response.in_progress` → `response.output_item.added` → `response.content_part.added` → `response.output_text.delta` → `response.output_text.done` → `response.content_part.done` → `response.output_item.done` → `response.completed` → `[DONE]`
- ✅ **Desktop App** - Native Windows and macOS app with menu bar and system tray
- ✅ **Tool Call Transformation** - Automatically converts `web_search`, `code_interpreter`, `file_search` to standard function calls
- ✅ **Multi-Provider Support** - GLM, Kimi, DeepSeek, MiniMax
- ✅ **Streaming & Non-streaming** - Supports both modes
- ✅ **Automatic Fallbacks** - Removes tools for providers that don't support them (GLM)
- ✅ **Reasoning Model Support** - Handles `reasoning_content` from models like GLM-5

## Quick Start

### Option 1: Desktop App (Recommended)

Cross-platform desktop application with GUI for easy configuration.

#### 1. Download

Download the installer for your system from [Releases](https://github.com/wang-h/chat2response/releases):

| System | Package | Description |
|--------|---------|-------------|
| macOS Apple Silicon | `Chat2Response-2.0.0-arm64.dmg` | M1/M2/M3 Mac |
| macOS Intel | `Chat2Response-2.0.0-x64.dmg` | Intel Mac |
| Windows | `Chat2Response-2.0.0.exe` | 64-bit Windows |

#### 2. Install

**macOS Installation:**

1. Download the `.dmg` file
2. Double-click to open, drag **Chat2Response** to the **Applications** folder
   ```
   ┌─────────────────────────┐
   │  Chat2Response.app    ➡️ │
   │     ↓ Drag to           │
   │  Applications folder    │
   └─────────────────────────┘
   ```
3. Open from **Launchpad** or **Applications** folder
4. If you see "Cannot open" warning, go to **System Settings > Privacy & Security** and click "Open Anyway"

**Windows Installation:**

1. Download the `.exe` installer
2. Double-click to run the setup wizard
3. Choose installation location (default is fine)
4. Complete installation and launch Chat2Response from Start Menu

#### 2. Configure API Keys

Open the app and enter at least one API Key:
- GLM API Key (optional)
- DeepSeek API Key (recommended)
- Kimi API Key (optional)
- MiniMax API Key (optional)

#### 3. Start Server

Click "Start Server" button and wait for the status to show "Running".

**Keyboard Shortcuts:**
- `Cmd/Ctrl + S` - Start/Stop server
- `Cmd/Ctrl + ,` - Open preferences
- `Cmd/Ctrl + Q` - Quit application

**Menu Bar Features:**
- **Server Menu**: Start/stop server, open config directory
- **Help Menu**: GitHub repository, report issues, documentation

#### 4. Configure Codex

Copy the displayed Codex configuration and add it to `~/.codex/config.toml`.

### Option 2: Command Line

For developers or users who prefer CLI.

#### 1. Install

```bash
git clone https://github.com/wang-h/chat2response.git
cd chat2response
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your API keys
```

```bash
# Required: At least one provider API key
GLM_API_KEY=your_glm_api_key
KIMI_API_KEY=your_kimi_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
MINIMAX_API_KEY=your_minimax_api_key

# Optional: Set default provider
DEFAULT_PROVIDER=deepseek
```

### 3. Start the Server

```bash
npm run build
npm start

# Or development mode with debug logs
DEBUG=true npm start
```

### 4. Configure Codex

Edit `~/.codex/config.toml`:

```toml
model = "deepseek-chat"
model_provider = "local"

[model_providers.local]
name = "Chat2Response"
base_url = "http://localhost:3456/v1"
env_key = "DEEPSEEK_API_KEY"
```

### 5. Use Codex

```bash
codex
```

Select the `local` provider and start coding!

## Supported Providers

| Provider | Default Model | Tools | Streaming | Notes |
|----------|--------------|-------|-----------|-------|
| **GLM** | glm-5 | ❌ | ✅ | Reasoning model, tools auto-removed |
| **Kimi** | kimi-coding | ✅ | ✅ | Requires Kimi for Coding API key |
| **DeepSeek** | deepseek-chat | ✅ | ✅ | **Recommended** - Full feature support |
| **MiniMax** | minimax-2.7 | ✅ | ✅ | Check model availability for your key |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /v1/models` | List available models |
| `POST /v1/responses` | **Main** - Converts Responses API to Chat Completions |
| `POST /v1/chat/completions` | Pass-through for testing |

## Switching Providers

### Method 1: Environment Variable (Default)
```bash
DEFAULT_PROVIDER=glm npm start
```

### Method 2: Request Header
```bash
curl -X POST http://localhost:3456/v1/responses \
  -H "Content-Type: application/json" \
  -H "X-Provider: deepseek" \
  -d '{"model":"deepseek-chat","input":"Hello"}'
```

### Method 3: Multiple Codex Configurations
```toml
[model_providers.glm]
name = "GLM"
base_url = "http://localhost:3456/v1"
env_key = "GLM_API_KEY"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "http://localhost:3456/v1"
env_key = "DEEPSEEK_API_KEY"
```

## Streaming Event Sequence

This proxy strictly follows the OpenAI Responses API streaming event specification:

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

## Troubleshooting

### Port Already in Use
```bash
lsof -ti:3456 | xargs kill -9
npm start
```

### Stream Disconnects
- Enable debug mode: `DEBUG=true npm start`
- Check provider API status
- Verify API key is valid

### Kimi Authentication Error
Your API key might be a **Kimi for Coding** restricted key that only works with official clients (Kimi CLI, Claude Code, etc.).

### MiniMax Model Not Supported
Your API key may not have access to the default model. Check your MiniMax console for available models.

## How It Works

### Request Conversion (Responses → Chat Completions)

1. `input` → `messages`
2. `instructions` → `system` message  
3. `tools` → OpenAI function format (with transformation for built-in tools)
4. `tool_choice` → passed through

### Response Conversion (Chat Completions → Responses)

1. Generates complete streaming event sequence
2. Accumulates text deltas to create `output_text.done`
3. Wraps response object with usage stats
4. Handles `reasoning_content` from reasoning models

## Acknowledgments

This project was created with **Kimi Code** (kimi-coding), an AI coding assistant by Moonshot AI.

Inspired by:
- [devproxy](https://github.com/daydaychen/devproxy) (Go) - MITM proxy approach
- [aiproxy](https://github.com/labring/aiproxy) (Go) - Multi-protocol AI gateway

## Contributing

Please see [CONTRIBUTORS.md](./CONTRIBUTORS.md) for the list of contributors.

## License

MIT License - see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 Chat2Response Contributors
