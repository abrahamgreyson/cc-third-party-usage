# Phase 02: Proxy Penetration & Provider Detection - Discussion Log

gt **Audit trail only.** Do not use as input to planning, research, or or execution agents.
Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 02-proxy-penetration-provider-detection
**Areas discussed:** 代理检测逻辑, 凭证提取策略, 提供商检测规则, 错误处理策略

---

## 代理检测逻辑

| Option | Description | Selected |
|--------|-------------|----------|
| 仅标准环境变量 | 只检查 ANTHROPIC_BASE_URL 和 BASE_URL | ✓ |
| 扩展检查 | 额外检查 ANTHROPIC_API_KEY 中是否有 localhost | |
| 数据库存在性验证 | 检测环境变量 + 尝试直接连接 CC Switch 数据库路径 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 完整本地地址列表 | 检查是否包含 localhost、 127.0.0.1, 0.0.0.0 | ✓ |
| 最小化列表 | 只检查 localhost 和 127.0.0.1 | |
| 正则表达式模式 | 使用正则匹配任何本地回环地址 | |

**User's choice:** 仅标准环境变量 + 完整本地地址列表
**Notes:** 磀保简单直接,覆盖常见的本地地址模式

---

## 凭证提取策略

### 数据库路径确定

| Option | Description | Selected |
|--------|-------------|----------|
| 固定路径 | 使用 ~/.cc-switch/cc-switch.db | ✓ |
| 环境变量可配置 | 允许通过 CC_SWITCH_DB 环境变量自定义路径 | |

**User's choice:** 固定路径
**Notes:** CC Switch 标准路径,简单可靠

### JSON 结构解析

**实际 JSON 结构** (from database inspection):
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "xxx",
    "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding/",
    ...
  }
}
```

**User's choice:** 嵌套结构 - 从 `settings_config.env.ANTHROPIC_AUTH_TOKEN` 和 `settings_config.env.ANTHROPIC_BASE_URL` 提取
**Notes:** 必须从 `env` 对象中提取,因为 CC Switch 会劫持环境变量

---

## 提供商检测规则

### 提供商识别方法

**Reference:** 用户提供了参考实现: https://github.com/zai-org/zai-coding-plugins/blob/main/plugins/glm-plan-usage/skills/usage-query-skill/scripts/query-usage.mjs

**实际提供商配置** (from database):
- `https://api.kimi.com/coding/` → Kimi
- `https://open.bigmodel.cn/api/anthropic` → GLM (中国大陆)
- `https://ark.cn-beijing.volces.com/api/coding` → Volce (不支持)

| Option | Description | Selected |
|--------|-------------|----------|
| 域名包含匹配 | 基于 baseUrl 域名包含关系: kimi.com → Kimi, bigmodel.cn → GLM | ✓ |
| 域名映射表 | 维护域名→提供商的映射表,支持多个域名模式 | |
| 正则表达式 | 从 baseUrl 提取域名,再进行正则匹配 | |

**User's choice:** 域名包含匹配
**Notes:** 简单可靠。注意: 只支持 Kimi 和 GLM (中国大陆),不支持海外 ZAI

**支持的提供商:**
- `kimi.com` → Kimi provider
- `bigmodel.cn` → GLM provider
- 其他 → `ConfigError` (不支持)

---

## 错误处理策略

### 失败处理

| Option | Description | Selected |
|--------|-------------|----------|
| 快速失败 | 数据库不可读/JSON 解析失败/字段缺失时直接抛出 ConfigError 并退出 | ✓ |
| 回退到环境变量 | 尝试回退到环境变量中的凭证,如果也没有则报错 | |

**User's choice:** 快速失败
**Notes:** 符合项目约束: "Failed CC Switch penetration must exit with error"

### 无代理情况处理

| Option | Description | Selected |
|--------|-------------|----------|
| 环境变量回退 | 从 ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN 环境变量读取, 无需 baseUrl | ✓ |
| 要求 BASE_URL | 也检查 ANTHROPIC_BASE_URL 环境变量,如果没有则报错 | |

**User's choice:** 环境变量回退
**Notes:** 简单直接,适合非代理场景

---

## Claude's Discretion

(None - all decisions were user-driven)

---

*Phase: 02-proxy-penetration-provider-detection*
*Discussion completed: 2026-04-01*
