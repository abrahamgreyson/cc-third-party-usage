# AI API Usage Monitor

## What This Is

A high-performance single-file CLI tool (`usage.mjs`) that queries Kimi and GLM API usage with intelligent CC Switch proxy detection. Primarily designed for Claude Code statusLine integration to display real-time usage monitoring, while also supporting manual queries and automated monitoring scenarios.

## Core Value

Seamlessly surface AI API usage data even when behind CC Switch proxy, with zero-configuration auto-detection and cache-optimized for frequent status bar refreshes.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Query Kimi API usage via `/v1/usages` endpoint
- [ ] Query GLM API usage via `/api/monitor/usage/quota/limit` endpoint
- [ ] CC Switch proxy penetration: detect localhost/127.0.0.1 in `ANTHROPIC_BASE_URL` or `BASE_URL`
- [ ] Read CC Switch SQLite database (`~/.cc-switch/cc-switch.db`) to extract real API credentials
- [ ] Auto-detect provider type based on baseUrl domain (kimi.com, bigmodel.cn)
- [ ] Normalize usage data to standard format: `{ total, used, remaining, percent, reset_display }`
- [ ] Implement 60-second cache (configurable) at `~/.cc-switch/usage_cache.json`
- [ ] Default concise output format optimized for statusLine
- [ ] Support `--template` flag for custom output format
- [ ] Full compatibility with both Bun and Node.js runtimes
- [ ] Graceful error handling with clear error messages when penetration fails

### Out of Scope

- **Real-time WebSocket monitoring** — polling-based approach sufficient for statusLine refresh patterns
- **OAuth authentication flows** — API key-based auth only
- **Multiple provider aggregation** — single provider per invocation
- **Persistent database storage** — lightweight JSON cache only
- **Windows CC Switch paths** — assume Unix-like paths (`~/.cc-switch/`)

## Context

**Technical Environment:**
- Target: Claude Code statusLine integration (frequent invocations during UI refresh)
- Runtimes: Bun (primary) and Node.js (compatible)
- CC Switch: Local proxy that routes Claude API calls through alternative providers
- Database: SQLite-based configuration storage in `~/.cc-switch/cc-switch.db`

**User Workflow:**
1. User runs Claude Code with CC Switch proxy enabled
2. StatusLine refresh triggers `usage.mjs` invocation
3. Tool detects proxy, penetrates to real provider config
4. Queries actual provider API (Kimi/GLM) for usage data
5. Returns normalized, cached result for display

**Known Technical Details:**
- **Kimi API Response:** `{ usage: [...], limits: [...] }` with duration=300 for 5-minute windows
- **GLM API Response:** `{ data: { limits: [...] } }` with `TIME_LIMIT` type entries
- **CC Switch Database Schema:** `provider` table with `settings_config` JSON field containing `apiKey` and `baseUrl`
- **Environment Variables:** `ANTHROPIC_BASE_URL`, `BASE_URL`, `ANTHROPIC_AUTH_TOKEN`

## Constraints

- **Single File:** Must be implemented as `usage.mjs` (ESM format) — no multi-file architectures
- **Runtime Compatibility:** Must work identically on Bun and Node.js without transpilation
- **Performance:** StatusLine invocations must complete within 2 seconds (cache helps)
- **SQLite Access:** Use Bun's built-in `bun:sqlite` or Node's `node:sqlite` (no external dependencies)
- **Error Handling:** Failed CC Switch penetration must exit with error (no silent fallback)
- **Cache Duration:** Default 60 seconds, user-configurable via CLI flag

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-file architecture | Simplicity for statusLine integration, easy distribution | — Pending |
| 60-second default cache | Balance between freshness and API rate limit conservation | — Pending |
| Auto-detect provider | Zero-configuration UX, domain-based detection is reliable | — Pending |
| Error on penetration failure | Fail-fast principle: user should know config is broken | — Pending |
| Template engine over multiple formats | Flexibility without bloat, statusLine needs simple strings | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after initialization*
