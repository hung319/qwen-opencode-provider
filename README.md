# OpenCode Qwen Plugin

OpenCode plugin for Qwen API - auto-configures models.

## Important

⚠️ **Plugin requires manual provider config** - OpenCode doesn't support auto-registering providers via plugins yet.

Plugin only auto-configures the model list.

## Installation

### Step 1: Add plugin to opencode.json

```json
{
  "plugin": ["qwen-opencode-provider"]
}
```

### Step 2: Add Provider Config

Add this to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["qwen-opencode-provider"],
  "provider": {
    "qwen": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Qwen",
      "options": {
        "baseURL": "https://qwen.aikit.club/v1",
        "apiKey": "YOUR_QWEN_TOKEN"
      },
      "models": {}
    }
  }
}
```

### Get Token

1. Visit https://chat.qwen.ai and login
2. Open Developer Console (F12)
3. Run: `localStorage.getItem('token')`

## Usage

```bash
/connect
# Select: Other
# Enter: qwen

/models
# Select Qwen model
```

## Supported Models

Plugin auto-configures these models:

| Model | Context | Output |
|-------|---------|--------|
| qwen3-max | 262K | 32K |
| qwen3-vl-plus | 262K | 32K |
| qwen3-coder-plus | 1M | 65K |
| qwen3-vl-32b | 131K | 32K |
| qwen3-coder-flash | 262K | 65K |
| qwq-32b | - | - |
| qwen-deep-research | - | - |

## Features

- 👁️ Vision (image analysis)
- 🌐 Web Search
- 🧠 Thinking Mode
- 👨‍💻 Code Generation

## License

MIT
