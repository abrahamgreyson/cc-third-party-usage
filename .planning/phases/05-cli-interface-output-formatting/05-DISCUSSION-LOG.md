# Phase 05: CLI Interface & Output Formatting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 05-cli-interface-output-formatting
**Areas discussed:** Default output format, Template engine, Verbose output, JSON structure, Multi-window backport

---

## Default Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Provider + 百分比 | 如 'Kimi 45.2%' | |
| Provider + 百分比 + 重置时间 | 如 'Kimi: 45.2% \| 2h30m' | ✓ |
| 仅百分比 | 如 '45.2%' | |
| Provider + 百分比 + 括号重置时间 | 如 'Kimi 45.2% (2h30m)' | |

**User's choice:** Provider + 百分比 + 重置时间 (分隔符格式: `{Provider}: {percent}% | {reset_display}`)
**Notes:** User requested compact English reset time format (e.g., "2h30m") instead of Chinese format ("2小时30分"). User originally wanted model name (e.g., "Kimi-2.5", "GLM-5.1") but confirmed no reliable source exists, chose Provider name only.

## Model Name / Display Name

| Option | Description | Selected |
|--------|-------------|----------|
| Provider + 订阅等级 | 如 'GLM pro' — 来自 API 响应 level/membership | |
| 仅 Provider 名称 | 如 'Kimi', 'GLM' — 当前 provider 字段 | ✓ |
| CC Switch 配置名 | 如 'GLM - cc' — 来自 providers.name | |

**User's choice:** 仅 Provider 名称
**Notes:** User asked about getting model name from Claude Code — explained usage.mjs is standalone script with no access to Claude Code internals. API responses don't include model name either (only subscription levels like "LEVEL_BASIC" / "pro").

## Template Engine

| Option | Description | Selected |
|--------|-------------|----------|
| 简单替换 | 只支持 {placeholder} 替换，如 '{provider}: {percent}%' | ✓ |
| 替换 + 简单条件 | 支持 {?percent>80} 等条件逻辑 | |
| 完整模板引擎 | 循环、条件、格式化函数 | |

**User's choice:** 简单替换
**Notes:** Multi-window data uses window-prefixed placeholders (e.g., `{5h_percent}`, `{weekly_reset}`). Flat namespace, no nesting.

## Verbose Output

| Option | Description | Selected |
|--------|-------------|----------|
| 缓存状态 | HIT/MISS, 文件路径, 剩余 TTL | ✓ |
| API 调用详情 | 请求耗时, 重试次数, 最终 URL | ✓ |
| Provider 检测过程 | 检测到的 provider, credentials 来源 | ✓ |
| 原始 API 响应 | 完整 JSON 响应 | |

**User's choice:** 缓存状态 + API 调用详情 + Provider 检测过程
**Notes:** Raw API response excluded. All verbose output to stderr with `[debug]` prefix.

## JSON Output Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 完整嵌套结构 | provider + quotas 数组 + fetchedAt | ✓ |
| 扁平结构 | 保持当前单一窗口格式 | |

**User's choice:** 完整嵌套结构
**Notes:** Each quota entry includes window name, type, total/used/remaining/percent, both human-readable reset and resetTimestamp. fetchedAt field for cache staleness.

## Multi-Window Quota Handling

| Option | Description | Selected |
|--------|-------------|----------|
| 回溯修改 Phase 3 + Phase 5 展示 | 修改解析器捕获所有窗口数据 | ✓ |
| 仅展示单一主要窗口 | 只展示最关键的窗口 | |

**User's choice:** 回溯修改 Phase 3 + Phase 5 展示
**Notes:** User revealed actual API responses have multiple quota windows (Kimi: usage + limits, GLM: TIME_LIMIT + TOKENS_LIMIT). Current parsers only capture limits[0]. This requires updating parseKimiResponse, parseGLMResponse, normalizeUsageData, getUsageData, and cache structure.

## Claude's Discretion

- Compact reset time formatter implementation
- How to select "most relevant" quota window for default display
- Exact verbose output line format
- Commander.js program configuration details
- Test coverage boundaries

## Deferred Ideas

None — discussion stayed within phase scope.
