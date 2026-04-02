# Phase 04: Caching Layer - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement intelligent cache-first data fetching strategy for fast statusLine refreshes without API rate limit concerns. This phase delivers:
- JSON file cache with TTL (time-to-live) management
- Atomic write operations to prevent race conditions
- Cache-first data fetching with automatic fallback to API
- System temp directory storage (no user Home pollution)

**What this phase does NOT include:**
- API integration (Phase 3 completed)
- CLI argument parsing (Phase 5)
- Output formatting (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### Cache Scope & Structure

**D-01:** Single-provider cache
- Cache file stores only current provider's data
- When user switches providers (Kimi → GLM), old cache is overwritten
- Simple flat file structure, no multi-provider dictionary
- Rationale: Simplicity. Tool monitors one provider at a time, no need for complex structure

**D-02:** Flat cache data structure
```javascript
{
  timestamp: number,      // Unix timestamp in milliseconds (Date.now())
  provider: 'kimi' | 'glm',
  total: number,
  used: number,
  remaining: number,
  percent: number,
  reset_display: string
}
```
- No metadata wrapper, directly store usage data + timestamp + provider
- Rationale: Simple, compact, fast read/write. Sufficient for single-provider use case

### Cache Location & Naming

**D-03:** System temp directory storage
- Use `os.tmpdir()` for cross-platform compatibility
- macOS: `/var/folders/.../T/cc-usage-kimi-cache.json`
- Linux: `/tmp/cc-usage-kimi-cache.json`
- Windows: `%TEMP%\cc-usage-kimi-cache.json`
- Rationale: Doesn't pollute user Home directory, OS auto-cleanup, tool is independent from CC Switch

**D-04:** Provider-based cache filename
- Filename pattern: `cc-usage-${provider}-cache.json`
- Examples: `cc-usage-kimi-cache.json`, `cc-usage-glm-cache.json`
- Cache key is provider name only (no API key hash)
- Rationale: Simple, predictable. When switching accounts within same provider, cache is reused (acceptable trade-off for simplicity)

### Cache Lifecycle

**D-05:** Strict TTL expiration
- Cache is expired when: `Date.now() > timestamp + (cacheDuration * 1000)`
- No grace period for slightly expired cache
- Default cache duration: 60 seconds (from DEFAULT_CONFIG.cacheDuration)
- Rationale: User always gets fresh data within TTL window, predictable behavior

**D-06:** Blocking refresh strategy
- When cache is expired or missing: wait for API response, then return new data
- User always sees latest data (never stale data)
- StatusLine refresh may have slight delay (< 2s per Phase 1 constraint)
- Rationale: Simplicity. No background refresh complexity, user sees current data

### Concurrency & Error Handling

**D-07:** Atomic write with write-then-rename pattern
- Write to temp file: `cc-usage-${provider}-cache.json.${process.pid}.tmp`
- Then atomically rename to final filename
- Prevents race conditions when multiple statusLine refreshes trigger simultaneously
- Rationale: Cross-platform compatible, no file locks needed, prevents partial writes

**D-08:** Fail-open cache degradation
- If cache file is corrupted/unreadable: ignore cache, call API directly
- No error thrown on cache read failure
- Cache write failure: log to stderr but don't fail the operation
- Rationale: Fail-fast principle applies to API/credentials, not cache. Cache is optimization, not requirement

**D-09:** No debug output
- Cache hit/miss is silent (no stderr logging)
- Cache status can be inferred from response time (cache hit is instant, API call takes time)
- Rationale: Clean output. Debug logging can be added in Phase 5 with --verbose flag if needed

### Integration Points

**D-10:** Cache-first data fetching flow
```
1. Read cache file → if exists and valid → return cached data
2. If cache miss/expired → call getUsageData() from Phase 3
3. Write new data to cache (async, non-blocking)
4. Return new data
```
- Cache check is synchronous (fast file read)
- API call is async (may take 1-2 seconds)
- Cache write is fire-and-forget (don't wait for write to complete)

**D-11:** Cache invalidation on provider switch
- When provider changes (Kimi → GLM): new cache file is used (different filename)
- Old cache file remains in temp directory (OS cleans up temp files automatically)
- No explicit cache clearing needed
- Rationale: Simple, no cleanup logic required

### Claude's Discretion

- Exact error messages for cache write failures (logged to stderr)
- Whether to include process.pid in temp filename or use random UUID
- Unit test coverage boundaries (mock file system vs real temp files)
- Whether to create temp directory if it doesn't exist (defensive coding)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints (2s response time for statusLine)
- `.planning/REQUIREMENTS.md` — Full requirements list (CACHE-01~05)
- `.planning/STATE.md` — Current project state, Phase 03 completion status

### Prior Phase Context
- `.planning/phases/03-api-integration-&-data-normalization/03-CONTEXT.md` — API integration, data normalization
- Phase 03 established:
  - `getUsageData()` returns normalized usage data structure
  - Output format: `{ total, used, remaining, percent, reset_display, provider }`
  - Error classes: `ConfigError`, `NetworkError`, `APIError`

### Code References
- `usage.mjs` — Existing infrastructure:
  - `DEFAULT_CONFIG.cacheDuration = 60` (line 19)
  - `getUsageData()` — Main data fetching function (Phase 3)
  - `expandHomePath()` — Path utility (Phase 2, not needed for temp dir)
  - `handleError()` — Error handler with exit codes (Phase 1)

### External References
- Node.js `os.tmpdir()` documentation — https://nodejs.org/api/os.html#ostmpdir
- Node.js `fs.promises` API — https://nodejs.org/api/fs.html#fs_promises_api

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getUsageData()`: Returns normalized usage data
  - Call this when cache is expired/missing
  - Returns: `{ total, used, remaining, percent, reset_display, provider }`
- `DEFAULT_CONFIG.cacheDuration`: Default 60 seconds
  - Use this as default TTL
- `handleError(error)`: Error handler
  - Use for unexpected errors in cache operations
- `ConfigError`, `NetworkError`, `APIError`: Error classes
  - Cache operations should NOT throw these (fail-open strategy)

### Established Patterns
- **Fail-fast vs Fail-open:** API/credential errors fail fast (throw), cache errors fail open (ignore)
- **Async operations:** All I/O operations use async/await (consistent with Phase 1-3)
- **No external dependencies:** Use only built-in Node.js APIs (`fs.promises`, `os`, `path`)

### Integration Points
- Cache layer sits between CLI entry point and `getUsageData()`
- New function: `getCachedUsageData()` — wraps `getUsageData()` with caching
- CLI entry point (Phase 5) will call `getCachedUsageData()` instead of `getUsageData()`

</code_context>

<specifics>
## Specific Ideas

**Cache File Path Example:**
```javascript
import { tmpdir } from 'os';
import { join } from 'path';

function getCacheFilePath(provider) {
  return join(tmpdir(), `cc-usage-${provider}-cache.json`);
}
```

**Cache Write Pattern:**
```javascript
import { writeFile, rename } from 'fs/promises';

async function writeCache(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(data));
  await rename(tempPath, filePath); // Atomic on all platforms
}
```

**Cache Read with TTL Check:**
```javascript
async function readCache(filePath, maxAgeMs) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const age = Date.now() - data.timestamp;
    if (age > maxAgeMs) {
      return null; // Expired
    }

    return data;
  } catch (error) {
    return null; // Cache miss (file not found, corrupted, etc.)
  }
}
```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All caching layer concerns addressed.

</deferred>

---

*Phase: 04-caching-layer*
*Context gathered: 2026-04-02*
