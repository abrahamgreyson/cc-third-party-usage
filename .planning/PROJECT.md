# AI API Usage Monitor

## What This Is

A high-performance single-file CLI tool (`usage.mjs`) that queries Kimi and GLM API usage with intelligent CC Switch proxy detection. Primarily designed for Claude Code statusLine integration to display real-time usage monitoring, while also supporting manual queries and automated monitoring scenarios.

## Core Value

Seamlessly surface AI API usage data even when behind CC Switch proxy, with zero-configuration auto-detection and cache-optimized for frequent status bar refreshes.

## Current State

**Version:** v1.0.0 (Shipped 2026-04-02)
**Status:** Production Ready
**Runtime Support:** Bun 1.3.10+, Node.js 22.5.0+

### Shipped Features

✅ **Cross-Runtime Foundation**
- Single-file ESM architecture (usage.mjs)
- Zero external dependencies (except Commander.js 14.0.3)
- Runtime detection and conditional SQLite imports
- Fail-fast error handling with semantic exit codes

✅ **CC Switch Proxy Auto-Penetration**
- Automatic credential extraction from `~/.cc-switch/cc-switch.db`
- Provider auto-detection (Kimi, GLM)
- Environment variable fallback for non-proxy users

✅ **Unified API Integration**
- Kimi API usage query via `/coding/v1/usages`
- GLM API usage query via `/api/monitor/usage/quota/limit`
- Multi-window quota parsing
- Human-readable time formatting ("2小时30分钟")

✅ **Intelligent Caching**
- 60-second TTL (configurable)
- Atomic write-then-rename pattern
- System temp directory location
- Fail-open strategy

✅ **Flexible CLI Interface**
- Default concise output optimized for statusLine
- JSON output via `--json`
- Custom templates via `--template`
- Debugging via `--verbose`
- Help and version flags

### Test Coverage

**226 tests passing** across all 5 phases:
- Phase 1: 67 tests (runtime, database, HTTP)
- Phase 2: 44 tests (proxy, provider, credentials)
- Phase 3: 46 tests (API, normalization)
- Phase 4: 23 tests (caching)
- Phase 5: 46 tests (CLI, output)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd cc-third-party-usage

# Run with Bun (recommended)
bun run usage.mjs

# Run with Node.js
node usage.mjs

# Build standalone executable (Bun only)
bun build usage.mjs --compile --outfile cc-usage
```

### Usage

```bash
# Default output (statusLine-optimized)
bun usage.mjs
# Output: Kimi: 45.2% | 2h30m

# JSON output
bun usage.mjs --json

# Custom template
bun usage.mjs --template '{provider}: {used}/{total} ({percent}%)'

# Verbose mode
bun usage.mjs --verbose

# Custom cache duration
bun usage.mjs --cache-duration 120
```

## Next Milestone Goals

**v1.1 - Enhanced Usability** (Planned)

Potential enhancements:
- Additional provider support (beyond Kimi/GLM)
- Configuration file support (YAML/JSON)
- Usage history export (CSV/JSON)
- Watch mode for continuous monitoring
- Multiple output format presets

## Requirements

### Validated

All v1.0 requirements have been validated and archived:
- ✅ 47/47 requirements satisfied
- ✅ 226 automated tests passing
- ✅ Cross-runtime compatibility verified
- ✅ Production deployment tested

See [v1.0 Requirements Archive](milestones/v1.0-REQUIREMENTS.md) for complete details.

### Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time WebSocket monitoring | Polling-based approach sufficient for statusLine refresh patterns |
| OAuth authentication flows | API key-based auth only; OAuth violates single-file constraint |
| Multiple provider aggregation | Single provider per invocation; different quota systems |
| Persistent database storage | Lightweight JSON cache only |
| Windows CC Switch paths | Unix-only (macOS/Linux) |
| Built-in alerting/threshold notifications | External monitoring tools can parse JSON output |
| Rate limit enforcement | Tool's job is monitoring, not throttling |
| Web dashboard/UI | Violates single-file CLI constraint |
| Graceful degradation | Fail-fast principle: users must see real errors |

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
- **SQLite Access:** Use Bun's `bun:sqlite` or Node's `node:sqlite` (no external dependencies)
- **Error Handling:** Failed CC Switch penetration must exit with error (no silent fallback)
- **Cache Duration:** Default 60 seconds, user-configurable via CLI flag

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-file architecture | Simplicity for statusLine integration, easy distribution | ✅ Shipped - usage.mjs is 5,402 LOC |
| 60-second default cache | Balance between freshness and API rate limit conservation | ✅ Shipped - configurable via --cache-duration |
| Auto-detect provider | Zero-configuration UX, domain-based detection is reliable | ✅ Shipped - detectProvider() for kimi.com, bigmodel.cn |
| Error on penetration failure | Fail-fast principle: user should know config is broken | ✅ Shipped - ConfigError with exit code 2 |
| Template engine over multiple formats | Flexibility without bloat, statusLine needs simple strings | ✅ Shipped - --template with bare + window-prefixed placeholders |

## Evolution

**v1.0 → v1.1 Preparation:**

This document evolves at phase transitions and milestone boundaries.

**After v1.0 milestone completion (2026-04-02):**
1. ✅ All v1.0 requirements moved to Validated section
2. ✅ Current State section updated with shipped version
3. ✅ Next Milestone Goals section added
4. ✅ Out of Scope reasoning audited and confirmed
5. ✅ Context updated with current state

---

*Last updated: 2026-04-02 after v1.0 milestone completion*
