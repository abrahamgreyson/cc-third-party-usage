# CC Third Party Usage Monitor

> Cross-runtime CLI tool for monitoring Kimi and GLM API usage with CC Switch proxy auto-penetration

[![npm version](https://badge.fury.io/js/cc-third-party-usage.svg)](https://badge.fury.io/js/cc-third-party-usage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- **Zero-Configuration** - Auto-detects CC Switch proxy and extracts credentials from `~/.cc-switch/cc-switch.db`
- **Cross-Runtime** - Works on Bun 1.3.10+ and Node.js 22.5.0+
- **Intelligent Caching** - 60s TTL with atomic writes, optimized for statusLine refresh
- **Flexible Output** - Default concise format, JSON, or custom templates
- **Multi-Provider** - Supports Kimi (Moonshot) and GLM (Zhipu AI) APIs

## 📦 Installation

### From npm

```bash
npm install -g cc-third-party-usage
```

### From Bun

```bash
bun install -g cc-third-party-usage
```

### From Source

```bash
git clone https://github.com/abrahamgreyson/cc-third-party-usage.git
cd cc-third-party-usage

# Using Bun (recommended)
bun usage.mjs

# Using Node.js
node usage.mjs
```

## 🚀 Quick Start

### Claude Code statusLine Integration

Add to your Claude Code settings:

```json
{
  "statusLine": {
    "command": "cc-usage"
  }
}
```

Or with full path:

```json
{
  "statusLine": {
    "command": "bun /path/to/cc-third-party-usage/usage.mjs"
  }
}
```

### CLI Usage

```bash
# Default output (optimized for statusLine)
cc-usage
# Output: Kimi: 45.2% | 2h30m

# JSON output
cc-usage --json

# Custom template
cc-usage --template "{provider}: {used}/{total} ({percent}%)"

# Verbose mode (debugging)
cc-usage --verbose

# Custom cache duration (default: 60s)
cc-usage --cache-duration 120

# Help
cc-usage --help

# Version
cc-usage --version
```

## 📋 Output Formats

### Default (statusLine-optimized)

```
Kimi: 45.2% | 2h30m
```

### JSON Output (`--json`)

```json
{
  "provider": "kimi",
  "quotas": [
    {
      "window": "5h",
      "total": 100,
      "used": 45,
      "remaining": 55,
      "percent": 45.2,
      "reset": "2h30m",
      "reset_timestamp": "2026-04-02T12:00:00Z"
    }
  ],
  "fetchedAt": "2026-04-02T10:30:00Z"
}
```

### Custom Templates (`--template`)

Supported placeholders:
- `{provider}` - Provider name (Kimi/GLM)
- `{total}` - Total quota (shortest window)
- `{used}` - Used quota (shortest window)
- `{remaining}` - Remaining quota (shortest window)
- `{percent}` - Usage percentage (shortest window)
- `{reset}` - Reset time (shortest window)
- `{5h_total}`, `{5h_used}`, etc. - Window-specific values

Examples:
```bash
cc-usage --template "{provider}: {used}/{total}"
# Output: Kimi: 45/100

cc-usage --template "{percent}% used, {remaining} remaining"
# Output: 45.2% used, 55 remaining
```

## 🔧 Configuration

### Environment Variables

The tool automatically detects credentials from:
1. **CC Switch proxy** (`~/.cc-switch/cc-switch.db`) - if `ANTHROPIC_BASE_URL` contains `localhost`
2. **Environment variables** (fallback):
   - `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_BASE_URL` or `BASE_URL`

### Cache Location

Cache files are stored in system temp directory:
- **macOS/Linux**: `/tmp/cc-usage-{provider}-cache.json`
- **TTL**: 60 seconds (configurable via `--cache-duration`)

## 🛠️ Requirements

- **Runtime**: Bun 1.3.10+ or Node.js 22.5.0+
- **API Key**: Kimi or GLM API key (via CC Switch or environment variable)

## 📊 Stats

- **5 phases**, 17 plans
- **226 tests** passing
- **47 requirements** satisfied (100%)
- **5,402 LOC**
- **Zero external dependencies** (except Commander.js)

## 🗺️ Roadmap

### v1.0 (Current)
- ✅ Core infrastructure with cross-runtime support
- ✅ CC Switch proxy auto-penetration
- ✅ Unified API integration (Kimi + GLM)
- ✅ Intelligent caching layer
- ✅ Flexible CLI interface

### v1.1 (Planned)
- Additional provider support (beyond Kimi/GLM)
- Configuration file support (YAML/JSON)
- Usage history export (CSV/JSON)
- Watch mode for continuous monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Built with [Claude Code](https://claude.ai/code) using the [Get Shit Done](https://github.com/anthropics/get-shit-done) workflow.

## 📮 Links

- [GitHub Repository](https://github.com/abrahamgreyson/cc-third-party-usage)
- [npm Package](https://www.npmjs.com/package/cc-third-party-usage)
- [Issue Tracker](https://github.com/abrahamgreyson/cc-third-party-usage/issues)

---

**Made with ❤️ by Abraham Greyson**
