# Phase 04: Caching Layer - Research

**Researched:** 2026-04-02
**Domain:** File-based JSON cache with TTL, atomic writes, cross-runtime compatibility
**Confidence:** HIGH

## Summary

This phase implements a file-based JSON cache layer that wraps the existing `getUsageData()` function from Phase 3. The cache stores normalized usage data in the system temp directory with TTL-based expiration, using the write-then-rename pattern for atomic writes to prevent corruption during concurrent invocations.

The implementation uses only built-in Node.js/Bun APIs: `fs/promises` for file I/O, `os` for temp directory resolution, and `path` for path construction. No external dependencies are needed. The write-then-rename pattern was verified on both Node.js v24.14.0 and Bun 1.3.10 on macOS Darwin 25.3.0 -- both passed atomic write tests.

**Primary recommendation:** Implement four functions: `getCacheFilePath(provider)`, `readCache(filePath, maxAgeMs)`, `writeCache(filePath, data)`, and `getCachedUsageData(provider, cacheDuration)`. All cache failures fail open (return null / swallow errors) since the cache is an optimization, not a requirement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single-provider cache -- overwrite when switching providers
- **D-02:** Flat cache data structure: `{ timestamp, provider, total, used, remaining, percent, reset_display }`
- **D-03:** System temp directory storage via `os.tmpdir()` -- no Home pollution
- **D-04:** Provider-based filename: `cc-usage-${provider}-cache.json`
- **D-05:** Strict TTL expiration: `Date.now() > timestamp + (cacheDuration * 1000)` -- no grace period
- **D-06:** Blocking refresh -- when cache expired/missing, wait for API, return fresh data
- **D-07:** Atomic write with write-then-rename: `cc-usage-${provider}-cache.json.${process.pid}.tmp`
- **D-08:** Fail-open cache degradation -- cache failures never throw, never block tool operation
- **D-09:** Silent cache hit/miss -- no stderr logging, no debug output
- **D-10:** Cache-first flow: read cache -> return if valid -> call getUsageData() -> write cache -> return data
- **D-11:** Cache invalidation on provider switch via different filename -- OS auto-cleanup of temp files

### Claude's Discretion
- Exact error messages for cache write failures (logged to stderr)
- Whether to include process.pid in temp filename or use random UUID
- Unit test coverage boundaries (mock file system vs real temp files)
- Whether to create temp directory if it doesn't exist (defensive coding)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACHE-01 | Implement JSON file cache | File-based JSON cache with `fs/promises` -- verified on both runtimes. Cache path via `os.tmpdir()`. |
| CACHE-02 | Default 60-second cache duration | `DEFAULT_CONFIG.cacheDuration = 60` already exists in usage.mjs. TTL check: `Date.now() > data.timestamp + (cacheDuration * 1000)`. |
| CACHE-03 | Configurable cache duration via `--cache-duration` flag | CLI flag parsing is Phase 5. This phase exposes `cacheDuration` parameter on `getCachedUsageData()`. |
| CACHE-04 | Atomic cache writes (write-then-rename) | POSIX `rename()` verified atomic on same-filesystem on both Node.js and Bun. Write to `.tmp`, then `rename()` to final path. |
| CACHE-05 | Cache includes timestamp, provider, normalized usage data | Cache structure: `{ timestamp, provider, total, used, remaining, percent, reset_display }` -- flat, no metadata wrapper. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fs/promises` | Built-in (Node 18+, Bun) | Async file read/write for cache operations | Zero dependencies, promise-based API, works identically on both runtimes |
| `os` | Built-in | `tmpdir()` for cross-platform temp directory | Returns `/var/folders/.../T` on macOS, `/tmp` on Linux, `%TEMP%` on Windows |
| `path` | Built-in | `join()` for cross-platform path construction | Handles platform-specific path separators |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | -- | -- | No external dependencies needed for caching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file cache | SQLite cache | SQLite already available from Phase 1, but JSON is simpler, faster to read/write for small data, and no schema needed |
| `os.tmpdir()` | `~/.cc-switch/` cache path | `os.tmpdir()` avoids Home directory pollution, OS handles cleanup, but cache lost on reboot (acceptable) |
| `process.pid` temp suffix | `crypto.randomUUID()` temp suffix | PID is simpler and sufficient -- two processes writing simultaneously get different PIDs. UUID adds crypto import for no benefit. |

**Installation:**
```bash
# No npm dependencies required
# All APIs are built into Node.js and Bun runtimes
```

**Version verification:** Built-in APIs -- no package versions to verify. Verified compatibility:
- Node.js v24.14.0: `fs/promises.writeFile`, `fs/promises.rename`, `fs/promises.readFile`, `fs/promises.unlink` all confirmed functional
- Bun 1.3.10: Same APIs confirmed functional
- `os.tmpdir()` returns identical path on both runtimes: `/var/folders/fl/5rxc13rd7l9d_trfz316rkxm0000gn/T`

## Architecture Patterns

### Recommended Project Structure
```
usage.mjs (single file)
├── // Existing sections (lines 1-1173)
├── ///// Caching Layer /////     (NEW -- insert after Data Normalization, before CLI Interface)
│   ├── getCacheFilePath(provider)
│   ├── readCache(filePath, maxAgeMs)
│   ├── writeCache(filePath, data)
│   └── getCachedUsageData(provider, cacheDuration)
├── ///// CLI Interface /////     (Phase 5)
└── ///// Entry Point /////       (Phase 5)
```

### Pattern 1: Cache-First Data Fetching
**What:** Read cache first, return if valid, otherwise fetch from API, write to cache, return data.
**When to use:** Every invocation of the tool -- statusLine refresh or manual query.
**Example:**
```javascript
// Source: CONTEXT.md D-10
async function getCachedUsageData(provider, cacheDuration) {
  const filePath = getCacheFilePath(provider);
  const maxAgeMs = cacheDuration * 1000;

  // Step 1: Try cache read
  const cached = await readCache(filePath, maxAgeMs);
  if (cached) return cached;

  // Step 2: Cache miss -- fetch from API
  const data = await getUsageData();

  // Step 3: Write to cache (fire-and-forget per D-10)
  writeCache(filePath, {
    timestamp: Date.now(),
    provider: data.provider,
    total: data.total,
    used: data.used,
    remaining: data.remaining,
    percent: data.percent,
    reset_display: data.reset_display
  }).catch(() => {}); // Fail-open per D-08

  // Step 4: Return fresh data
  return data;
}
```

### Pattern 2: Atomic Write-Then-Rename
**What:** Write to a temp file, then atomically rename to the target path.
**When to use:** Every cache write operation.
**Example:**
```javascript
// Source: CONTEXT.md D-07
import { writeFile, rename, unlink } from 'fs/promises';

async function writeCache(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify(data));
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if rename fails
    try { await unlink(tempPath); } catch {}
    throw error;
  }
}
```

### Pattern 3: Fail-Open Cache Read
**What:** Return `null` on any cache read failure instead of throwing.
**When to use:** Every cache read operation.
**Example:**
```javascript
// Source: CONTEXT.md D-08
import { readFile } from 'fs/promises';

async function readCache(filePath, maxAgeMs) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Strict TTL per D-05
    const age = Date.now() - data.timestamp;
    if (age > maxAgeMs) return null;

    return data;
  } catch {
    return null; // Fail-open: any error = cache miss
  }
}
```

### Anti-Patterns to Avoid
- **Blocking on cache write:** Cache write should be fire-and-forget. Awaiting write adds latency to every cache miss response. Per D-10, write is non-blocking.
- **Throwing on cache failure:** Cache is optimization, not requirement. Any cache error should degrade gracefully to API call. Per D-08, fail-open.
- **Using synchronous fs methods:** `readFileSync`/`writeFileSync` block the event loop. Use `fs/promises` for async I/O consistent with Phase 1-3 patterns.
- **Adding stderr logging for cache hit/miss:** Per D-09, cache operations are silent. Debug logging is Phase 5's responsibility.
- **Using file locks:** The write-then-rename pattern eliminates the need for advisory file locks, which are unreliable across platforms and add complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom lock file mechanism | `fs.promises.writeFile` + `fs.promises.rename` | POSIX `rename()` is atomic on same-filesystem. Lock files add race conditions, cleanup complexity, and platform-specific behavior. |
| Temp directory resolution | Hardcoded `/tmp` or `~/tmp` | `os.tmpdir()` | Cross-platform: returns correct path on macOS (`/var/folders/.../T`), Linux (`/tmp`), Windows (`%TEMP%`). |
| Path joining | String concatenation with `/` | `path.join()` | Handles platform-specific separators. Works identically on Bun and Node.js. |
| JSON serialization | Custom serialization format | `JSON.stringify()` / `JSON.parse()` | Cache data is simple flat object. No circular references, no special types. JSON.stringify is sufficient. |
| Temp file cleanup | Manual cleanup tracking | Try/catch with `unlink()` on write failure | The temp file only exists for milliseconds between write and rename. On failure, clean up in catch block. OS auto-cleans temp directory eventually. |

**Key insight:** The entire caching layer needs zero external dependencies. The built-in `fs/promises`, `os`, and `path` modules provide everything needed. This aligns with the project's single-file, zero-dependency constraint.

## Common Pitfalls

### Pitfall 1: Non-Atomic Overwrite on Windows
**What goes wrong:** On Windows, `fs.rename()` may fail if the target file already exists and is being read by another process.
**Why it happens:** Windows has mandatory file locking; POSIX has advisory locking.
**How to avoid:** This project targets Unix (macOS/Linux) per REQUIREMENTS.md "Out of Scope: Windows CC Switch paths". The write-then-rename pattern is safe on POSIX systems. If Windows support is ever added, use a retry-with-unlink strategy.
**Warning signs:** `EPERM` or `EACCES` errors on rename.

### Pitfall 2: Stale Temp Files After Crash
**What goes wrong:** If the process crashes between `writeFile` and `rename`, the `.tmp` file remains in the temp directory.
**Why it happens:** The crash prevents the rename/cleanup step.
**How to avoid:** This is benign -- `os.tmpdir()` is periodically cleaned by the OS. The `.tmp` files are small (< 1KB). The `readCache` function ignores them because it reads the final path, not temp paths. No action needed.
**Warning signs:** Accumulation of `.tmp` files in temp directory over very long uptimes.

### Pitfall 3: Race Between Cache Write and Read
**What goes wrong:** Process A writes cache, Process B reads the same instant -- could B see a partial write?
**Why it happens:** Two CLI invocations triggered simultaneously by statusLine refresh.
**How to avoid:** The write-then-rename pattern prevents this. Process A writes to `.tmp` file (not the target), then atomically renames. Process B either sees the old cache (valid) or the new cache (valid). It never sees a partial write because `rename()` is atomic on POSIX.
**Warning signs:** Corrupted JSON in cache file (should never happen with write-then-rename).

### Pitfall 4: Process.pid Collision
**What goes wrong:** Two processes with the same PID writing to the same temp file.
**Why it happens:** PIDs are recycled on Unix. The OS could assign the same PID to a new process.
**How to avoid:** Extremely unlikely for CLI tool usage. The PID collision window is the milliseconds between `writeFile` and `rename`. Even if it happened, the worst case is one process overwrites the other's temp file, and the rename succeeds with the latest data. For extra safety (Claude's discretion), append a random suffix or timestamp.
**Warning signs:** `ENOENT` on rename if another process cleaned up the temp file.

### Pitfall 5: Clock Skew in TTL Calculation
**What goes wrong:** `Date.now()` returns a value that makes a freshly-written cache appear expired.
**Why it happens:** System clock adjusted between write and read.
**How to avoid:** Unlikely in practice for a 60-second TTL. The strict TTL check (`age > maxAgeMs`) is a user decision (D-05). No mitigation needed.
**Warning signs:** Cache always appears expired immediately after write.

## Code Examples

Verified patterns from this environment and CONTEXT.md:

### Cache File Path Construction
```javascript
// Source: CONTEXT.md D-03, D-04
import { tmpdir } from 'os';
import { join } from 'path';

function getCacheFilePath(provider) {
  return join(tmpdir(), `cc-usage-${provider}-cache.json`);
}

// Example output on macOS:
// /var/folders/fl/.../T/cc-usage-kimi-cache.json
// /var/folders/fl/.../T/cc-usage-glm-cache.json
```

### Complete Read Cache with TTL
```javascript
// Source: CONTEXT.md D-05, D-08 + verified on Node.js v24.14.0 and Bun 1.3.10
import { readFile } from 'fs/promises';

async function readCache(filePath, maxAgeMs) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Strict TTL check per D-05
    if (Date.now() - data.timestamp > maxAgeMs) {
      return null; // Expired
    }

    return data;
  } catch {
    return null; // Fail-open per D-08
  }
}
```

### Complete Atomic Write Cache
```javascript
// Source: CONTEXT.md D-07 + verified on this platform
import { writeFile, rename, unlink } from 'fs/promises';

async function writeCache(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    await writeFile(tempPath, JSON.stringify(data));
    await rename(tempPath, filePath); // Atomic on POSIX
  } catch (error) {
    // Clean up temp file on failure
    try { await unlink(tempPath); } catch {}
    // Don't throw -- fail-open per D-08, but let caller decide
    // Caller will use .catch(() => {}) for fire-and-forget
  }
}
```

### Integration with Existing getUsageData()
```javascript
// Source: CONTEXT.md D-10 + existing usage.mjs getUsageData() function

async function getCachedUsageData(provider, cacheDuration = DEFAULT_CONFIG.cacheDuration) {
  const filePath = getCacheFilePath(provider);
  const maxAgeMs = cacheDuration * 1000;

  // Step 1: Try cache
  const cached = await readCache(filePath, maxAgeMs);
  if (cached) return cached;

  // Step 2: Cache miss -- call Phase 3 function
  const data = await getUsageData();

  // Step 3: Write cache (fire-and-forget per D-10)
  writeCache(filePath, {
    timestamp: Date.now(),
    provider: data.provider,
    total: data.total,
    used: data.used,
    remaining: data.remaining,
    percent: data.percent,
    reset_display: data.reset_display
  }).catch(() => {}); // Fail-open per D-08

  // Step 4: Return data immediately
  return data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs` callback API | `fs/promises` promise API | Node.js 10+ | Cleaner async/await code, no callback hell |
| `require('fs')` sync methods | `import { ... } from 'fs/promises'` | Node.js 14+ (stable), ESM | Consistent with project's ESM architecture |
| External caching libraries (node-cache, flat-cache) | Built-in `fs/promises` + JSON | Always available | Zero dependencies, simpler, sufficient for small flat data |

**Deprecated/outdated:**
- `fs.exists()` (deprecated since Node.js v1.0.0) -- use `readFile` with try/catch instead for cache existence check
- `path.exists()` (never existed in Node.js) -- not a real API

## Open Questions

1. **Should `getCachedUsageData` require `provider` parameter?**
   - What we know: `getUsageData()` internally detects the provider and returns it in the response. The cache filename needs the provider name.
   - What's unclear: Can the caller know the provider before calling `getUsageData()`? With CC Switch proxy, the provider is detected from the base URL during credential resolution. Without proxy, there's no base URL.
   - Recommendation: Two approaches: (a) Call `getUsageData()` first to get the provider, then use it for subsequent cache operations. Or (b) Use a generic cache filename like `cc-usage-cache.json` and store the provider inside the cache data. Approach (b) is simpler and aligns with D-01 (single-provider cache, overwrite on switch).

2. **Should cache write be truly fire-and-forget or awaited?**
   - What we know: D-10 says "Cache write is fire-and-forget (don't wait for write to complete)."
   - What's unclear: If the process exits before the write completes (e.g., in a pipeline), the data could be lost.
   - Recommendation: For statusLine use, the process is long-lived enough. Fire-and-forget is acceptable. If needed later, Phase 5 can optionally await the write.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fs/promises` | Cache read/write | Yes | v24.14.0 | -- |
| Bun `fs/promises` | Cache read/write | Yes | v1.3.10 | -- |
| `os.tmpdir()` | Cache location | Yes | Built-in | -- |
| `path.join()` | Path construction | Yes | Built-in | -- |
| `process.pid` | Temp file uniqueness | Yes | Built-in | -- |

**Missing dependencies with no fallback:**
- None -- all required APIs are built into both runtimes.

**Missing dependencies with fallback:**
- None -- no external dependencies needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (`bun:test`) |
| Config file | None -- Bun auto-discovers `*.test.{js,ts}` files |
| Quick run command | `bun test tests/04-caching-layer.test.js` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-01 | JSON file cache created at system temp directory | unit | `bun test tests/04-caching-layer.test.js -t "getCacheFilePath"` | No -- Wave 0 |
| CACHE-01 | Cache file readable after write | integration | `bun test tests/04-caching-layer.test.js -t "writeCache"` | No -- Wave 0 |
| CACHE-02 | Default 60-second TTL works | unit | `bun test tests/04-caching-layer.test.js -t "readCache.*60"` | No -- Wave 0 |
| CACHE-02 | Expired cache returns null | unit | `bun test tests/04-caching-layer.test.js -t "readCache.*expired"` | No -- Wave 0 |
| CACHE-03 | Custom cache duration parameter works | unit | `bun test tests/04-caching-layer.test.js -t "getCachedUsageData.*custom"` | No -- Wave 0 |
| CACHE-04 | Atomic write with write-then-rename | unit | `bun test tests/04-caching-layer.test.js -t "writeCache.*atomic"` | No -- Wave 0 |
| CACHE-04 | Concurrent invocations no corruption | integration | `bun test tests/04-caching-layer.test.js -t "concurrent"` | No -- Wave 0 |
| CACHE-05 | Cache includes timestamp, provider, normalized data | unit | `bun test tests/04-caching-layer.test.js -t "cache structure"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test tests/04-caching-layer.test.js`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/04-caching-layer.test.js` -- covers CACHE-01 through CACHE-05
- [ ] Test fixture helper in `tests/conftest.js` for cache-related temp file management (if needed beyond existing `createTestDatabase`)

## Sources

### Primary (HIGH confidence)
- Node.js v24.14.0 `fs/promises` API -- verified on this machine with live tests
- Bun 1.3.10 `fs/promises` API -- verified on this machine with live tests
- `os.tmpdir()` behavior -- verified on both runtimes, returns `/var/folders/fl/5rxc13rd7l9d_trfz316rkxm0000gn/T`
- POSIX `rename()` atomicity -- verified with live write-then-rename test on both runtimes
- CONTEXT.md decisions D-01 through D-11 -- user-locked decisions

### Secondary (MEDIUM confidence)
- POSIX `rename()` atomicity guarantees on same-filesystem -- [Stack Overflow discussion](https://stackoverflow.com/questions/66780210/is-fs-renamesync-an-atomic-operation-that-is-resistant-to-corruption) confirms POSIX intent
- NFS `rename()` caveats -- [Server Fault discussion](https://serverfault.com/questions/817887/rename-on-nfs-atomicity) notes NFS may not guarantee atomicity (not relevant -- temp directory is local filesystem)

### Tertiary (LOW confidence)
- None -- all findings verified on this machine or from authoritative sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all APIs verified on both runtimes with live tests
- Architecture: HIGH -- patterns are straightforward file I/O, no complex design decisions
- Pitfalls: HIGH -- concurrency and atomicity concerns addressed with proven write-then-rename pattern
- Code examples: HIGH -- all patterns verified on this machine

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- built-in APIs don't change frequently)
