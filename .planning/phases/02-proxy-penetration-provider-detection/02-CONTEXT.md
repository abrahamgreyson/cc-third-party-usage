# Phase 02: Proxy Penetration & Provider Detection - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement automatic credential extraction from CC Switch proxy and provider type detection. This phase delivers:
- CC Switch proxy detection via environment variable inspection
- SQLite database credential extraction from CC Switch configuration
- Provider type auto-detection based on baseUrl domain
- Environment variable fallback for non-proxy usage

**What this phase does NOT include:**
- API request/response handling (Phase 03)
- Usage data normalization (Phase 03)
- Caching layer (Phase 04)
- CLI interface (Phase 05)

</domain>

<decisions>
## Implementation Decisions

### Proxy Detection
- **D-01:** Check only standard environment variables: `ANTHROPIC_BASE_URL` and `BASE_URL`
  - Rationale: Simpler and more reliable. CC Switch uses these standard variables.
  - Implementation: Check if either variable contains localhost addresses

- **D-02:** Support complete local address list: `localhost`, `127.0.0.1`, `0.0.0.0`
  - Rationale: Covers common local address patterns without over-engineering
  - Implementation: Simple string matching for these three patterns

### Credential Extraction
- **D-03:** Use fixed database path: `~/.cc-switch/cc-switch.db`
  - Rationale: CC Switch standard path, simple and reliable
  - No environment variable configuration needed

- **D-04:** Extract credentials from `providers` table
  - Table: `providers` (plural, not `provider`)
  - Field: `settings_config` (TEXT, contains JSON)
  - JSON path: `settings_config.env.ANTHROPIC_AUTH_TOKEN` → apiKey
  - JSON path: `settings_config.env.ANTHROPIC_BASE_URL` → baseUrl
  - Query: `SELECT settings_config FROM providers WHERE id = 'default'`
  - Rationale: Based on actual CC Switch database structure analysis

### Provider Detection
- **D-05:** Domain-based provider detection
  - `kimi.com` → Kimi provider
  - `bigmodel.cn` → GLM provider (Mainland China)
  - Any other domain → Throw `ConfigError` (unsupported provider)
  - Rationale: Simple substring matching on baseUrl domain
  - Note: Only support Kimi and GLM (Mainland China), not ZAI (overseas)

### Error Handling
- **D-06:** Fail-fast strategy for proxy credential extraction
  - Database unreadable → Throw `ConfigError`
  - JSON parsing fails → Throw `ConfigError`
  - Required fields missing (`env.ANTHROPIC_AUTH_TOKEN` or `env.ANTHROPIC_BASE_URL`) → Throw `ConfigError`
  - Rationale: Aligns with project constraint: "Failed CC Switch penetration must exit with error"
  - No silent fallback to environment variables when proxy detected

- **D-07:** Environment variable fallback for non-proxy usage
  - When no proxy detected (no localhost in BASE_URL):
  - Read `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` environment variable
  - No baseUrl needed (direct API access)
  - Rationale: Simple direct authentication for users without CC Switch

### Claude's Discretion
- Implementation details for database query execution
- JSON parsing error message wording
- Exact string matching vs regex for domain detection
- Whether to validate API key format before returning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full requirements list (PROXY-01~05, PROV-01~03)
- `.planning/STATE.md` — Current project state, Phase 01 completion status

### Prior Phase Context
- `.planning/phases/01-core-infrastructure/01-discussion-log.md` — Runtime detection, error handling patterns
- Phase 01 established:
  - `openDatabase(dbPath)` function for SQLite access
  - `ConfigError` class for configuration errors (exit code 2)
  - WAL mode + 10s busy timeout for concurrent access

### External References
- None — All context captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `openDatabase(dbPath)` — Opens SQLite with WAL mode and busy timeout (Phase 01)
- `ConfigError` — Error class for configuration failures with exit code 2 (Phase 01)
- `detectRuntime()` — Runtime detection for bun:sqlite vs node:sqlite (Phase 01)
- `loadDatabaseModule()` — Conditional SQLite module loading (Phase 01)

### Established Patterns
- **Database access pattern:** Always call `await loadDatabaseModule()` before `openDatabase()`
- **Error handling:** Use `ConfigError` with actionable message for all configuration failures
- **JSON parsing:** Use try-catch with clear error messages on parse failure

### Integration Points
- New proxy detection functions will be called from main entry point
- Credential extraction happens before API client initialization (Phase 03)
- Provider detection determines which API endpoint to use (Phase 03)

</code_context>

<specifics>
## Specific Ideas

**CC Switch Database Structure** (from actual database inspection):
```sql
Table: providers
Columns: id (TEXT PRIMARY KEY), name, settings_config (TEXT)

Example row:
id: "default"
name: "GLM - cc"
settings_config: {
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "94cee9bc72834245bc11a08eac066320.nQlg9MTHDqjDlcVe",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    ...
  },
  ...
}
```

**Provider Detection Examples:**
- `https://api.kimi.com/coding/` → Kimi
- `https://open.bigmodel.cn/api/anthropic` → GLM
- `https://ark.cn-beijing.volces.com/api/coding` → ERROR (unsupported)

**Environment Variable Fallback:**
- With proxy: Extract from database
- Without proxy: Read `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` from process.env

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All proxy penetration and provider detection concerns addressed.

</deferred>

---

*Phase: 02-proxy-penetration-provider-detection*
*Context gathered: 2026-04-01*
