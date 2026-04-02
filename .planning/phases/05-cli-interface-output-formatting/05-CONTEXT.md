# Phase 05: CLI Interface & Output Formatting - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement CLI entry point with argument parsing and flexible output formatting for usage.mjs. This phase delivers:
- Commander.js-based CLI argument parsing (--json, --template, --verbose, --cache-duration, --help, --version)
- Default statusLine-optimized output format
- Template-based custom output with placeholder substitution
- JSON output with complete nested structure
- Verbose debug output for troubleshooting
- Proper stdout/stderr separation
- Phase 3 backport: expand parsers to capture multi-window quota data

**What this phase does NOT include:**
- API integration changes beyond multi-window parser expansion
- Caching layer changes
- New provider support

</domain>

<decisions>
## Implementation Decisions

### Phase 3 Backport: Multi-Window Quota Data

**D-01:** Expand Phase 3 parsers to capture all quota windows
- Kimi API returns: `usage` (overall quota) + `limits[]` (5-hour window, 300 minutes)
- GLM API returns: `limits[]` with `TIME_LIMIT` (5-hour window) + `TOKENS_LIMIT` (weekly/token limit)
- Current `parseKimiResponse` and `parseGLMResponse` only capture `limits[0]` — must capture all
- New normalized data structure:
```javascript
{
  provider: 'kimi' | 'glm',
  quotas: [
    {
      window: '5h' | 'weekly' | 'overall',
      type: 'TIME_LIMIT' | 'TOKENS_LIMIT' | 'usage',
      total: number | null,      // null if not provided by API
      used: number | null,
      remaining: number | null,
      percent: number,
      reset_display: string,     // human-readable ("2h50m")
      reset_timestamp: number | null  // original timestamp for JSON output
    }
  ],
  fetchedAt: string  // ISO timestamp
}
```
- Rationale: APIs return multiple quota windows, statusLine needs the most relevant one, --json needs all

**D-02:** Preserve backward compatibility for caching
- `getCachedUsageData()` return type changes from flat to nested
- Cache file structure updates to match new format
- Existing cache files become invalid (acceptable — TTL is 60s)

### Default Output Format

**D-03:** Compact statusLine format
- Pattern: `{Provider}: {percent}% | {reset_display}`
- Example: `Kimi: 45.2% | 2h30m`
- Shows the most relevant quota window (shortest reset time or closest to exhaustion)
- Provider name from `provider` field (uppercase first letter: "Kimi", "GLM")
- Rationale: User confirmed this format. Concise enough for statusLine, informative enough to be useful

**D-04:** Reset time display format for statusLine
- Use compact format: `2h30m`, `45m15s`, `3d12h`
- NOT Chinese format ("2小时30分") for default — too long for statusLine
- The existing `reset_display` (Chinese format) is preserved for --template access
- A new compact formatter function needed for default output
- Rationale: statusLine space is limited, compact format preferred

**D-05:** Multi-window default display strategy
- Default output shows ONE quota window: the one with shortest reset time (most urgent)
- Full multi-window data available via --json and --template
- Rationale: statusLine is too small for multiple windows. User can use --template for custom layouts

### Template Engine

**D-06:** Simple placeholder replacement only
- Syntax: `{placeholder}` replaced with value
- Placeholders: `{provider}`, `{5h_percent}`, `{5h_reset}`, `{5h_used}`, `{5h_total}`, `{5h_remaining}`, `{weekly_percent}`, `{weekly_reset}`, etc.
- Unknown placeholders kept as-is (no error)
- Rationale: Simple, predictable, zero parsing complexity. Users can construct any format they need

**D-07:** Window-prefixed placeholder naming
- Pattern: `{window_field}` where window = `5h`, `weekly`, `overall` and field = `percent`, `reset`, `used`, `total`, `remaining`
- Example: `--template '{provider}: {5h_percent}% (resets {5h_reset})'`
- Rationale: Flat namespace is simpler than nested dot notation for simple replacement

### JSON Output

**D-08:** Complete nested structure
```json
{
  "provider": "glm",
  "quotas": [
    {
      "window": "5h",
      "type": "TIME_LIMIT",
      "total": 1000,
      "used": 64,
      "remaining": 936,
      "percent": 6.4,
      "reset": "2h50m",
      "resetTimestamp": 1776304584997
    },
    {
      "window": "weekly",
      "type": "TOKENS_LIMIT",
      "percent": 15,
      "reset": "3d12h",
      "resetTimestamp": 1774954129256
    }
  ],
  "fetchedAt": "2026-04-02T10:30:00Z"
}
```
- All quota windows included
- Both human-readable (`reset`) and machine-readable (`resetTimestamp`) formats
- `fetchedAt` for cache staleness checking
- Rationale: Machine-readable output should be complete, not lossy

### Verbose Output

**D-09:** Three-section verbose output
- **Cache status:** HIT/MISS, cache file path, remaining TTL
- **API call details:** request duration (ms), retry count, final URL
- **Provider detection:** detected provider name, credentials source (CC Switch DB / environment variables)
- All verbose output goes to stderr (not mixed with data output on stdout)
- Rationale: User selected these three areas. Sufficient for debugging without overwhelming

**D-10:** Verbose output format
- One-line-per-fact style, prefixed with `[debug]`
- Example:
```
[debug] Cache: MISS (no cache file)
[debug] Provider: glm (from CC Switch database)
[debug] API call: 847ms, 0 retries, https://open.bigmodel.cn/api/monitor/usage/quota/limit
```
- Rationale: Easy to read, easy to grep, doesn't interfere with pipe operations

### CLI Interface

**D-11:** Commander.js for argument parsing
- As specified in CLAUDE.md technology stack (Commander.js 14.0.3)
- This is the ONLY external dependency
- Flags: --json, --template <string>, --verbose, --cache-duration <seconds>, --help, --version
- Rationale: Already decided in project tech stack

**D-12:** Entry point behavior
- When run directly: parse args → get cached usage data → format output → write to stdout
- When imported as module: all functions exported (existing behavior preserved)
- Detection: `process.argv[1]` contains script name → run as CLI
- Rationale: Dual-mode utility. Module imports for testing, CLI for statusLine

**D-13:** --version flag shows VERSION constant
- Output: `usage.mjs v1.0.0`
- Exit code 0

**D-14:** stdout/stderr separation
- All data output (default, --json, --template) → stdout
- All error messages and verbose output → stderr
- Rationale: Standard CLI convention (OUT-05), enables piping

### Claude's Discretion

- Exact error message wording for CLI errors
- Commander.js program configuration details (description, option definitions)
- Compact reset time formatter implementation (hours/minutes/seconds breakdown)
- Whether to add `--quiet` flag (currently not in requirements)
- Test coverage boundaries for CLI entry point
- How to select "most relevant" quota window for default display (shortest reset vs highest usage)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints (2s response time, single-file, Commander.js)
- `.planning/REQUIREMENTS.md` — Full requirements list (OUT-01~05, CLI-01~07)
- `.planning/STATE.md` — Current project state, Phase 04 completion

### Prior Phase Context
- `.planning/phases/03-api-integration-&-data-normalization/03-CONTEXT.md` — API integration, data normalization, parser decisions
- `.planning/phases/04-caching-layer/04-CONTEXT.md` — Cache layer, getCachedUsageData() interface
- Phase 03 established:
  - `parseKimiResponse()` and `parseGLMResponse()` — NEED MODIFICATION for multi-window
  - `getUsageData()` returns flat structure — NEED UPDATE for nested structure
  - `normalizeUsageData()` — NEED UPDATE for multi-quota normalization
- Phase 04 established:
  - `getCachedUsageData(cacheDuration, provider)` — main data entry point
  - Cache file structure — NEED UPDATE for new nested format

### Code References
- `usage.mjs` — Complete implementation:
  - Line 5: `VERSION = '1.0.0'`
  - Line 18: `DEFAULT_CONFIG = { cacheDuration: 60, ... }`
  - Line 92: `handleError(error)` — stderr output + exit codes
  - Line 1140: `getCacheFilePath(provider)` — cache file path in temp dir
  - Line 1209: `getCachedUsageData()` — cache-first data fetching
  - Line 1238-1240: `///// CLI Interface /////` and `///// Entry Point /////` — empty placeholder sections
  - Line 1241-1286: Export block — all functions exported
  - Line 1004: `parseKimiResponse()` — needs multi-window expansion
  - Line 1068: `parseGLMResponse()` — needs multi-window expansion
  - Line 943: `normalizeUsageData()` — needs multi-quota normalization
  - Line 972: `getUsageData()` — needs updated return structure

### External References
- Commander.js documentation — https://github.com/tj/commander.js
- Node.js process.stdout/stderr — standard stream separation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handleError(error)`: Error handler with stderr output and exit codes — use for all CLI errors
- `VERSION` / `DESCRIPTION` constants: Already defined, use for --version and --help
- `DEFAULT_CONFIG`: Contains cacheDuration, timeout, etc. — CLI flags override these
- `getCachedUsageData()`: Main data entry point — CLI calls this to get usage data
- All existing functions already exported — testable as modules

### Established Patterns
- **Error handling:** `handleError()` for all errors, stderr output, semantic exit codes
- **Data flow:** `getCachedUsageData()` → `getUsageData()` → `queryProviderAPI()` → provider-specific parsers
- **Module exports:** All functions exported for testing, CLI entry point detects `process.argv[1]`

### Integration Points
- New CLI entry point in `///// CLI Interface /////` section (line 1238)
- Calls `getCachedUsageData(cacheDuration)` with user-provided or default cache duration
- Output formatter reads data structure and renders to stdout
- Verbose logger writes to stderr alongside data output

</code_context>

<specifics>
## Specific Ideas

**Kimi API Response Structure (actual):**
```json
{
  "user": { "userId": "...", "region": "REGION_CN", "membership": { "level": "LEVEL_BASIC" } },
  "usage": { "limit": "100", "remaining": "100", "resetTime": "2026-04-06T03:33:46.648544Z" },
  "limits": [{ "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" }, "detail": { "limit": "100", "remaining": "100", "resetTime": "..." } }],
  "parallel": { "limit": "10" }
}
```
- `usage`: Overall quota (limit/remaining/resetTime) — appears to be the main quota
- `limits[0]`: 5-hour window (300 minutes) with detail.limit/remaining/resetTime
- Both are string values ("100"), need parseInt

**GLM API Response Structure (actual):**
```json
{
  "code": 200, "msg": "操作成功",
  "data": {
    "limits": [
      {
        "type": "TIME_LIMIT", "unit": 5, "number": 1,
        "usage": 1000, "currentValue": 64, "remaining": 936,
        "percentage": 6, "nextResetTime": 1776304584997,
        "usageDetails": [{ "modelCode": "search-prime", "usage": 36 }, { "modelCode": "web-reader", "usage": 28 }]
      },
      {
        "type": "TOKENS_LIMIT", "unit": 3, "number": 5,
        "percentage": 15, "nextResetTime": 1774954129256
      }
    ],
    "level": "pro"
  }
}
```
- `TIME_LIMIT`: 5-hour window with usage/currentValue/remaining/percentage/nextResetTime
- `TOKENS_LIMIT`: Token-based limit with percentage/nextResetTime
- `usageDetails`: Per-model breakdown (search-prime, web-reader, zread)
- `level`: Subscription level ("pro")

**Default Output Examples:**
```
Kimi: 45.2% | 2h30m
GLM: 6.4% | 4h15m
```

**Verbose Output Example:**
```
[debug] Cache: MISS (expired, /tmp/cc-usage-glm-cache.json)
[debug] Provider: glm (from CC Switch database)
[debug] API call: 847ms, 0 retries, https://open.bigmodel.cn/api/monitor/usage/quota/limit
```

**Template Example:**
```
usage.mjs --template '{provider}: {5h_percent}% used, resets in {5h_reset}'
→ GLM: 6.4% used, resets in 4h15m
```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Multi-window data capture is a backport to Phase 3 parsers, not new capability.

</deferred>

---

*Phase: 05-cli-interface-output-formatting*
*Context gathered: 2026-04-02*
