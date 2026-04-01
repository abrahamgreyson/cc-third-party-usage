# Requirements: AI API Usage Monitor

**Defined:** 2026-04-01
**Core Value:** Seamlessly surface AI API usage data even when behind CC Switch proxy, with zero-configuration auto-detection and cache-optimized for frequent status bar refreshes.

## v1 Requirements

### Core Infrastructure

- [ ] **CORE-01**: Single-file ESM architecture (`usage.mjs`) with zero external dependencies
- [ ] **CORE-02**: Cross-runtime compatibility (Bun and Node.js) with runtime-conditional SQLite imports
- [ ] **CORE-03**: Fail-fast error handling with clear, actionable error messages
- [ ] **CORE-04**: Semantic exit codes (0=success, 1=error, 2=config error, etc.)

### API Integration

- [ ] **API-01**: Query Kimi API usage via `/v1/usages` endpoint
- [ ] **API-02**: Query GLM API usage via `/api/monitor/usage/quota/limit` endpoint
- [ ] **API-03**: Parse Kimi response format: `{ usage: [...], limits: [...] }` with duration=300 for 5-minute windows
- [ ] **API-04**: Parse GLM response format: `{ data: { limits: [...] } }` with `TIME_LIMIT` type entries
- [ ] **API-05**: Handle API errors with clear error messages (no silent fallback)

### Proxy Penetration (CC Switch)

- [x] **PROXY-01**: Detect localhost/127.0.0.1 in `ANTHROPIC_BASE_URL` or `BASE_URL` environment variables
- [x] **PROXY-02**: Read CC Switch SQLite database at `~/.cc-switch/cc-switch.db`
- [x] **PROXY-03**: Extract real API credentials from `provider` table (`settings_config` JSON field)
- [x] **PROXY-04**: Parse `settings_config` to extract `apiKey` and `baseUrl` (or `ANTHROPIC_AUTH_TOKEN`)
- [x] **PROXY-05**: Fail with clear error if database unreadable or JSON parsing fails (no fallback to env vars)

### Provider Detection

- [x] **PROV-01**: Auto-detect provider type based on baseUrl domain (kimi.com, bigmodel.cn)
- [x] **PROV-02**: Support environment variable authentication when no proxy detected
- [x] **PROV-03**: Route to correct API endpoint based on detected provider

### Data Normalization

- [ ] **NORM-01**: Normalize usage data to standard format: `{ total, used, remaining, percent, reset_display }`
- [ ] **NORM-02**: Calculate percentage: `(used / total) * 100`
- [ ] **NORM-03**: Convert reset time to human-readable format ("X小时X分" or similar)
- [ ] **NORM-04**: Handle both timestamp (GLM) and ISO string (Kimi) reset time formats

### Caching

- [ ] **CACHE-01**: Implement JSON file cache at `~/.cc-switch/usage_cache.json`
- [ ] **CACHE-02**: Default 60-second cache duration
- [ ] **CACHE-03**: Support configurable cache duration via `--cache-duration` flag
- [ ] **CACHE-04**: Atomic cache writes (write to temp file, then rename) to prevent race conditions
- [ ] **CACHE-05**: Cache includes timestamp, provider, and normalized usage data

### Output Formatting

- [ ] **OUT-01**: Default concise output format optimized for statusLine display
- [ ] **OUT-02**: Support `--json` flag for JSON output (machine-readable)
- [ ] **OUT-03**: Support `--template` flag for custom output format with placeholders
- [ ] **OUT-04**: Template placeholders: `{total}`, `{used}`, `{remaining}`, `{percent}`, `{reset}`, `{provider}`
- [ ] **OUT-05**: All output to stdout, errors to stderr (proper CLI conventions)

### CLI Interface

- [ ] **CLI-01**: Zero-configuration: auto-detect everything by default
- [ ] **CLI-02**: Support `--cache-duration <seconds>` flag to customize cache TTL
- [ ] **CLI-03**: Support `--template <string>` flag for custom output
- [ ] **CLI-04**: Support `--json` flag for JSON output
- [ ] **CLI-05**: Support `--verbose` flag for debugging (show cache hits, API calls, etc.)
- [ ] **CLI-06**: Display help with `--help` or `-h`
- [ ] **CLI-07**: Display version with `--version` or `-v`

### Database Integration

- [ ] **DB-01**: Use Bun's `bun:sqlite` when running under Bun runtime
- [ ] **DB-02**: Use Node's `node:sqlite` when running under Node.js runtime
- [ ] **DB-03**: Implement runtime detection and conditional import
- [ ] **DB-04**: Enable WAL mode for concurrent read access
- [ ] **DB-05**: Set busy timeout to prevent locking errors

### HTTP Client

- [ ] **HTTP-01**: Use native `fetch` API (no axios/got dependencies)
- [ ] **HTTP-02**: Set reasonable timeout (5 seconds default)
- [ ] **HTTP-03**: Implement retry logic with exponential backoff (max 3 retries)
- [ ] **HTTP-04**: Handle rate limit (429) responses with Retry-After header support
- [ ] **HTTP-05**: Clear error messages for network failures, timeouts, rate limits

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Monitoring

- **MON-01**: Additional provider support (beyond Kimi/GLM)
- **MON-02**: Configuration file support (YAML/JSON) for persistent settings
- **MON-03**: Usage history export (CSV/JSON) for trend analysis

### Advanced Features

- **ADV-01**: Watch mode for continuous monitoring with live updates
- **ADV-02**: Multiple output format presets (table, detailed, minimal)
- **ADV-03**: Verbose logging by default with `--quiet` flag to suppress

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time WebSocket monitoring | Polling-based approach sufficient for statusLine refresh patterns; WebSocket adds complexity |
| OAuth authentication flows | API key-based auth only; OAuth violates single-file constraint and adds significant code bloat |
| Multiple provider aggregation | Single provider per invocation; different providers have different quota systems/reset times |
| Persistent database storage | Lightweight JSON cache only; SQLite for history adds file management complexity |
| Windows CC Switch paths | Unix-only (macOS/Linux); Windows paths fundamentally different, adds significant conditional logic |
| Built-in alerting/threshold notifications | External monitoring tools can parse JSON output and handle alerting |
| Rate limit enforcement | Tool's job is monitoring, not throttling; enforcement creates false expectations |
| Web dashboard/UI | Violates single-file CLI constraint; JSON output enables external dashboards |
| Graceful degradation | Fail-fast principle: suppress no exceptions, users must see real errors immediately |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CORE-04 | Phase 1 | Pending |
| DB-01 | Phase 1 | Pending |
| DB-02 | Phase 1 | Pending |
| DB-03 | Phase 1 | Pending |
| DB-04 | Phase 1 | Pending |
| DB-05 | Phase 1 | Pending |
| HTTP-01 | Phase 1 | Pending |
| HTTP-02 | Phase 1 | Pending |
| HTTP-03 | Phase 1 | Pending |
| HTTP-04 | Phase 1 | Pending |
| HTTP-05 | Phase 1 | Pending |
| PROXY-01 | Phase 2 | Complete |
| PROXY-02 | Phase 2 | Complete |
| PROXY-03 | Phase 2 | Complete |
| PROXY-04 | Phase 2 | Complete |
| PROXY-05 | Phase 2 | Complete |
| PROV-01 | Phase 2 | Complete |
| PROV-02 | Phase 2 | Complete |
| PROV-03 | Phase 2 | Complete |
| API-01 | Phase 3 | Pending |
| API-02 | Phase 3 | Pending |
| API-03 | Phase 3 | Pending |
| API-04 | Phase 3 | Pending |
| API-05 | Phase 3 | Pending |
| NORM-01 | Phase 3 | Pending |
| NORM-02 | Phase 3 | Pending |
| NORM-03 | Phase 3 | Pending |
| NORM-04 | Phase 3 | Pending |
| CACHE-01 | Phase 4 | Pending |
| CACHE-02 | Phase 4 | Pending |
| CACHE-03 | Phase 4 | Pending |
| CACHE-04 | Phase 4 | Pending |
| CACHE-05 | Phase 4 | Pending |
| OUT-01 | Phase 5 | Pending |
| OUT-02 | Phase 5 | Pending |
| OUT-03 | Phase 5 | Pending |
| OUT-04 | Phase 5 | Pending |
| OUT-05 | Phase 5 | Pending |
| CLI-01 | Phase 5 | Pending |
| CLI-02 | Phase 5 | Pending |
| CLI-03 | Phase 5 | Pending |
| CLI-04 | Phase 5 | Pending |
| CLI-05 | Phase 5 | Pending |
| CLI-06 | Phase 5 | Pending |
| CLI-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-03-31 after roadmap creation*
