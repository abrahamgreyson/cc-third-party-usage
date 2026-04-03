# CC Third Party Usage Monitor

**[English](./README.md)** | **[中文](./README.zh-CN.md)**

> 在 Claude Code 状态栏中监控第三方 AI 模型（Kimi / GLM）API 用量的 CLI 工具

[![npm version](https://img.shields.io/npm/v/cc-third-party-usage.svg)](https://www.npmjs.com/package/cc-third-party-usage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![demo](./demo.png)

## ✨ 特性

- **多服务商支持** — 同时支持 Kimi（月之暗面）和 GLM（智谱 AI）API 用量监控
- **自动配置** — 自动从环境变量或本地代理检测 API 凭据，零配置即可使用
- **即时响应** — 同步读取缓存，30ms 内输出结果；API 请求在后台独立进程异步完成
- **灵活输出** — 支持默认精简格式、JSON、自定义模板等多种输出方式

## 📦 安装与使用

### 全局安装（推荐）

**为什么不建议使用 npx/bunx？** `npx`/`bunx` 每次调用都需要 1-2 秒进行包解析和锁文件管理。对于要求快速响应的工具（如带有执行超时的状态栏集成），这一开销会导致超时问题。全局安装可彻底消除此开销。

```bash
# 使用 npm
npm install -g cc-third-party-usage

# 使用 Bun（更快）
bun install -g cc-third-party-usage

# 安装后即可在任何地方运行（30ms 响应）
cc-third-party-usage
```

### 一次性使用（npx/bunx）

> ⚠️ **不推荐通过 npx/bunx 运行。** 每次调用额外增加 1-2 秒开销，请使用全局安装。

```bash
# 使用 npx
npx cc-third-party-usage

# 使用 bunx（稍快）
bunx cc-third-party-usage

# 附带参数
npx cc-third-party-usage --json
```

### 从源码运行

```bash
git clone https://github.com/abrahamgreyson/cc-third-party-usage.git
cd cc-third-party-usage

# 最快方式（Node 约 30ms，Bun 约 18ms）
node dist/usage.js
bun dist/usage.js
```

## ⚡ 性能

| 方式 | 响应时间 | 说明 |
|------|---------|------|
| `node dist/usage.js` | **~30ms** | 直接执行文件，最快 |
| `bun dist/usage.js` | **~18ms** | Bun 运行时，更快 |
| `cc-third-party-usage`（全局安装） | **~900ms** | Node 启动 + SQLite 初始化 |
| `bunx cc-third-party-usage` | **~1100ms** | 每次都需要包解析 |
| `npx cc-third-party-usage` | **~2500ms** | 最慢，npm 解析开销最大 |

本工具采用**即时响应架构**：同步读取缓存数据后立即输出退出，同时启动独立的守护进程在后台获取最新 API 数据供下次调用使用。脚本本身执行始终在 30ms 以内——上表中的时间差异完全来自运行时的启动开销。

## 🚀 集成

### Claude Code 原生状态栏

在 Claude Code 设置文件（`~/.claude/settings.json`）中添加：

```json
{
  "statusLine": {
    "command": "cc-third-party-usage"
  }
}
```

如需最快响应，可先克隆并构建，然后使用绝对路径：

```bash
git clone https://github.com/abrahamgreyson/cc-third-party-usage.git
cd cc-third-party-usage && bun run build
```

```json
{
  "statusLine": {
    "command": "node /path/to/cc-third-party-usage/dist/usage.js"
  }
}
```

### ccstatusline 集成

在 [ccstatusline](https://github.com/sirmalloc/ccstatusline) 中作为 Custom Command 组件使用：

1. 添加一个 **Custom Command** 组件
2. 设置命令：`cc-third-party-usage`（需全局安装）
3. 或设置命令：`node /path/to/cc-third-party-usage/dist/usage.js`（最快）
4. 设置超时：**3000**（毫秒，在组件编辑器中按 `t` 键）

### 命令行使用

```bash
# 首先设置环境变量（或通过本地代理配置）
export ANTHROPIC_BASE_URL=https://api.kimi.com
export ANTHROPIC_API_KEY=your-api-key

# 默认输出（为状态栏优化）
cc-third-party-usage
# 输出：Kimi: 45.2% used | 2h30m left

# JSON 输出
cc-third-party-usage --json

# 自定义模板
cc-third-party-usage --template "{provider}: {used}/{total} ({percent}%)"

# 详细模式（调试用）
cc-third-party-usage --verbose

# 自定义缓存时长（默认 60 秒）
cc-third-party-usage --cache-duration 120

# 帮助信息
cc-third-party-usage --help

# 版本号
cc-third-party-usage --version
```

## 📋 输出格式

### 默认格式（状态栏优化）

```
Kimi: 45.2% used | 2h30m left
```

### JSON 输出（`--json`）

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

### 自定义模板（`--template`）

支持的占位符：
- `{provider}` — 服务商名称（Kimi/GLM）
- `{total}` — 总配额（最短窗口）
- `{used}` — 已用配额（最短窗口）
- `{remaining}` — 剩余配额（最短窗口）
- `{percent}` — 用量百分比（最短窗口）
- `{reset}` — 重置时间（最短窗口）
- `{5h_total}`, `{5h_used}` 等 — 指定窗口的值

示例：
```bash
cc-third-party-usage --template "{provider}: {used}/{total}"
# 输出：Kimi: 45/100

cc-third-party-usage --template "{percent}% used, {remaining} remaining"
# 输出：45.2% used, 55 remaining
```

## 🔧 配置

### 环境变量

工具会自动检测 API 凭据，优先级如下：
1. **本地代理数据库**（当 `ANTHROPIC_BASE_URL` 指向 localhost 时）— 适用于代理用户
2. **环境变量**（回退方案）：
   - `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_BASE_URL` 或 `BASE_URL`

### 支持的服务商

| 服务商 | API 地址 | 说明 |
|--------|---------|------|
| **Kimi** | api.kimi.com | 月之暗面 |
| **GLM** | open.bigmodel.cn | 智谱 AI |

### 缓存位置

缓存文件存储在系统临时目录：
- **macOS/Linux**：`/tmp/cc-usage-cache/cc-usage-{provider}-cache.json`
- **TTL**：60 秒（可通过 `--cache-duration` 配置）

## 🛠️ 系统要求

- **运行时**：Bun 1.3.10+ 或 Node.js 22.5.0+
- **API 密钥**：Kimi 或 GLM API 密钥（通过环境变量或代理配置）

## 🗺️ 路线图

**v1.0（当前版本）**
- 跨运行时的核心基础设施
- Kimi 与 GLM API 集成
- 自动凭据检测
- 智能缓存层
- 灵活的 CLI 接口

**v1.1（规划中）**
- 更多服务商支持
- 配置文件支持（YAML/JSON）
- 用量历史导出（CSV/JSON）
- 持续监控模式

## 📝 许可证

MIT 许可证 — 详见 [LICENSE](LICENSE)。

## 📮 链接

- [GitHub 仓库](https://github.com/abrahamgreyson/cc-third-party-usage)
- [npm 包](https://www.npmjs.com/package/cc-third-party-usage)
- [问题追踪](https://github.com/abrahamgreyson/cc-third-party-usage/issues)
