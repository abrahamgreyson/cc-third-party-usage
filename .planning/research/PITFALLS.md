# Pitfalls Research

**Domain:** Single-file CLI tool with cross-runtime compatibility (Bun/Node.js)
**Researched:** 2026-03-31
**Confidence:** MEDIUM (Mix of official docs, community discussions, and domain expertise)

## Critical Pitfalls

### Pitfall 1: SQLite Module Incompatibility Between Runtimes

**What goes wrong:**
Code written using Node.js 22+ `node:sqlite` module fails when running under Bun runtime, or vice versa. The application crashes with module not found errors or unexpected API behavior.

**Why it happens:**
Bun uses its own `bun:sqlite` module while Node.js 22+ uses `node:sqlite`. These are **not interchangeable** - Bun does not fully support `node:sqlite` (there's an open GitHub issue #20412 requesting this). Developers assume cross-runtime compatibility extends to built-in modules.

**How to avoid:**
Use conditional imports based on runtime detection:
```javascript
const sqlite = process.isBun
  ? await import('bun:sqlite')
  : await import('node:sqlite');
```
Or use a third-party library like `better-sqlite3` that works in both runtimes (though Bun's native `bun:sqlite` is 3-6x faster).

**Warning signs:**
- Tests pass in one runtime but fail in another
- "Cannot find module 'bun:sqlite'" or "Cannot find module 'node:sqlite'" errors
- Code works locally (with one runtime) but fails in production (with different runtime)

**Phase to address:**
Phase 1 (Core Infrastructure) - Must establish runtime abstraction layer early

**Sources:**
- [GitHub Issue: Support node:sqlite in Bun](https://github.com/oven-sh/bun/issues/20412)
- [Bun SQLite Documentation](https://bun.com/docs/runtime/sqlite)
- [Node.js node:sqlite in Bun Context](https://bun.com/reference/node/sqlite)

---

### Pitfall 2: SQLite Database Locking Under Concurrent Access

**What goes wrong:**
Application crashes with "SQLITE_BUSY" or "database is locked" errors when multiple invocations try to access the CC Switch database simultaneously. StatusLine refreshes can trigger rapid concurrent reads.

**Why it happens:**
SQLite uses file-based locking. Multiple CLI invocations create separate processes, each opening their own database connection. Without proper configuration, writers block readers and vice versa. The default busy timeout is often too short (5 seconds or less).

**How to avoid:**
1. **Enable WAL mode** for better concurrency:
   ```sql
   PRAGMA journal_mode = WAL;
   ```
2. **Set appropriate busy timeout** (30+ seconds):
   ```sql
   PRAGMA busy_timeout = 30000;
   ```
3. **Use IMMEDIATE transactions** for writes:
   ```sql
   BEGIN IMMEDIATE;
   -- write operations
   COMMIT;
   ```
4. **Keep transactions short** - commit quickly

**Warning signs:**
- Intermittent "database is locked" errors
- Errors occur more frequently during rapid statusLine refreshes
- Problem worsens when multiple Claude Code instances run simultaneously

**Phase to address:**
Phase 1 (Core Infrastructure) - Database access layer must handle this from the start

**Sources:**
- [SQLite Write-Ahead Logging](https://sqlite.org/wal.html)
- [SQLite Concurrent Writes and Locking](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [Reddit: SQLite Locked with WAL Mode](https://www.reddit.com/r/golang/comments/1exk981/sqlite_database_is_locked_with_wal_mode/)

---

### Pitfall 3: JSON Cache Race Conditions

**What goes wrong:**
Cache file becomes corrupted, empty, or contains partial JSON when multiple CLI invocations read/write simultaneously. Application crashes with JSON parse errors or returns stale/incorrect data.

**Why it happens:**
File writes are not atomic by default. Process A reads cache, Process B writes cache, Process A writes based on stale data = lost update. Or Process A reads while Process B is mid-write = partial/corrupted read.

**How to avoid:**
Use **atomic file operations**:
1. Write to temporary file first
2. Rename temp file to cache file (rename is atomic on Unix systems)
```javascript
const tempPath = cachePath + '.tmp';
await fs.writeFile(tempPath, JSON.stringify(data));
await fs.rename(tempPath, cachePath); // Atomic operation
```

Alternative: Use SQLite for caching instead of JSON (handles concurrency better).

**Warning signs:**
- Intermittent "Unexpected token" JSON parse errors
- Cache occasionally returns empty or corrupted data
- Problem occurs more frequently with rapid successive invocations

**Phase to address:**
Phase 1 (Core Infrastructure) - Cache layer must be concurrency-safe from the start

**Sources:**
- General file locking patterns (proper-lockfile, fs-extra atomic writes)
- SQLite as alternative for concurrent access

---

### Pitfall 4: HTTP API Timeout Configuration Mistakes

**What goes wrong:**
CLI tool hangs indefinitely on network requests, or times out too quickly on slow connections. Users think the tool is broken when it's actually waiting for a response.

**Why it happens:**
- No timeout configured (infinite wait)
- Timeout too short (network latency varies)
- Not distinguishing between connection timeout vs read timeout
- Retrying without exponential backoff creates thundering herd

**How to avoid:**
1. **Always set timeouts** (connection + read):
   ```javascript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 10000);
   const response = await fetch(url, { signal: controller.signal });
   clearTimeout(timeout);
   ```

2. **Use exponential backoff for retries**:
   ```javascript
   const retry = async (fn, maxRetries = 3) => {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (err) {
         if (i === maxRetries - 1) throw err;
         await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
       }
     }
   };
   ```

3. **Respect Retry-After headers** (especially for 429 rate limit errors)

4. **Don't retry 4xx errors** (except 429) - they won't succeed on retry

**Warning signs:**
- CLI occasionally hangs without output
- "ETIMEDOUT" or "ECONNRESET" errors
- Excessive API rate limit errors (429s)

**Phase to address:**
Phase 2 (API Integration) - HTTP client setup must include timeout/retry strategy

**Sources:**
- [Error Handling Through Timeout and Retries](https://docs.commercetools.com/api/error-handling)
- [Best Practices for API Error Handling](https://zuplo.com/learning-center/best-practices-for-api-error-handling/)
- [Best Practice: Implementing Retry Logic](https://api4ai/blog/best-practice-implementing-retry-logic-in-http-api-clients)

---

### Pitfall 5: Process Exit Before Async Operations Complete

**What goes wrong:**
CLI exits with code 0 (success) but cache wasn't written, or exits before HTTP request completes, or exits with error but shows success message first.

**Why it happens:**
Using `process.exit()` immediately terminates the process, cutting off pending async operations (file writes, network requests, database commits). The exit happens before the event loop empties.

**How to avoid:**
1. **Never use process.exit() in normal flow** - let the program exit naturally
2. **Use process.exitCode = 1** instead of `process.exit(1)` to set exit code without forcing immediate exit
3. **Wait for operations to complete**:
   ```javascript
   // Bad
   await fetch(url);
   process.exit(0); // May exit before response processed

   // Good
   const response = await fetch(url);
   const data = await response.json();
   await saveCache(data);
   process.exitCode = 0; // Exit naturally
   ```

4. **For error cases**, throw an error or use a top-level try/catch:
   ```javascript
   try {
     await main();
   } catch (err) {
     console.error(err.message);
     process.exitCode = 1;
   }
   ```

**Warning signs:**
- Cache sometimes not written despite success message
- Database operations occasionally incomplete
- Race conditions between output and exit

**Phase to address:**
Phase 1 (Core Infrastructure) - Main entry point architecture must handle async flow correctly

**Sources:**
- [Avoid process.exit() in Node.js](https://humanwhocodes.com/blog/2014/02/04/maintainable-node-js-javascript-avoid-process-exit/)
- [Node.js Process Exit Strategies](https://leapcell.io/blog/nodejs-process-exit-strategies)
- [Error Handling in CLI Tools](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9)

---

### Pitfall 6: Missing or Incorrect CLI Exit Codes

**What goes wrong:**
Tool always exits with code 0, even on errors. Scripting and automation can't detect failures. StatusLine integration can't differentiate success from failure.

**Why it happens:**
Developers forget to set exit codes, or use `process.exit()` incorrectly (see Pitfall 5), or throw errors that aren't caught at the top level, resulting in exit code 1 but with ugly stack traces.

**How to avoid:**
1. **Use semantic exit codes**:
   - 0: Success
   - 1: General error
   - 2: Misuse of command (invalid args)
   - Custom codes for specific error types

2. **Top-level error handler with clean messages**:
   ```javascript
   try {
     await main();
     process.exitCode = 0;
   } catch (err) {
     if (err instanceof UserError) {
       console.error(`Error: ${err.message}`);
       process.exitCode = err.exitCode || 1;
     } else {
       console.error('Unexpected error:', err);
       process.exitCode = 1;
     }
   }
   ```

3. **Suppress stack traces for expected errors** (user-facing CLI should show clean messages)

**Warning signs:**
- `echo $?` always shows 0
- CI/CD pipelines don't fail when tool fails
- Error messages include full stack traces

**Phase to address:**
Phase 1 (Core Infrastructure) - Error handling architecture must be established early

**Sources:**
- [Node.js Exit Codes](https://www.geeksforgeeks.org/node-js/node-js-exit-codes/)
- [urfave/cli Exit Codes](https://cli.urfave.org/v2/examples/exit-codes/)
- [Reddit: Exit Code for CLI Applications](https://www.reddit.com/r/bash/comments/1kt9n4c/exit_code_for_cli_applications/)

---

### Pitfall 7: Cross-Runtime API Differences Beyond SQLite

**What goes wrong:**
Code works in Node.js but fails in Bun (or vice versa) due to subtle API differences in fetch, path handling, environment variables, or other built-in modules.

**Why it happens:**
While Bun aims for 100% Node.js compatibility, it's not perfect. Edge cases exist, especially with:
- `fetch` implementation differences (headers, streaming)
- Path handling (Windows vs Unix)
- Environment variable edge cases
- Error object properties
- Buffer vs ArrayBuffer handling

**How to avoid:**
1. **Test in both runtimes** from day one
2. **Use runtime-agnostic libraries** where possible
3. **Abstract runtime-specific code** behind a common interface
4. **Check for feature existence** rather than runtime:
   ```javascript
   // Bad
   if (process.isBun) { ... }

   // Better
   if (typeof Bun !== 'undefined') { ... }

   // Best
   if (globalThis.fetch) { ... }
   ```

**Warning signs:**
- Tests pass in one runtime, fail in another
- Subtle differences in error messages or behavior
- Platform-specific bugs (macOS vs Linux)

**Phase to address:**
Phase 1 (Core Infrastructure) - Establish testing in both runtimes immediately

**Sources:**
- [Bun Node.js Compatibility](https://bun.com/docs/runtime/nodejs-compat)
- [Bun vs Node.js Comparison](https://refine.dev/blog/bun-js-vs-node/)
- [Bun 1.2 Improves Node Compatibility](https://www.infoq.com/news/2025/04/bun-12-node-compat-postgres/)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip WAL mode for SQLite | Simpler setup | Database locking errors under concurrent access | Never - single-process tools only |
| Use synchronous file operations | Simpler code flow | Blocks event loop, poor performance | Only during startup before async operations begin |
| Skip error handling for "impossible" errors | Less code to write | Cryptic failures, hard debugging | Never - handle all errors gracefully |
| Hard-code cache duration | Faster to implement | Users can't tune for their needs | MVP only, add flag before production |
| Use `console.log` for all output | Quick and easy | Can't separate stdout/stderr, hard to parse | Never - use `console.error` for errors, `console.log` for data |
| Skip input validation | Less code | Cryptic errors downstream, security risks | Never - validate early, fail fast |
| Ignore rate limit headers | Simpler code | 429 errors, API bans | Never - always respect Retry-After |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Kimi API | Assume response format never changes | Version API client, validate response schema, handle missing fields gracefully |
| GLM API | Treat all errors the same | Distinguish between auth errors (fail fast), rate limits (retry with backoff), and network errors (retry) |
| CC Switch DB | Assume database always exists and is valid | Check existence, validate schema, handle missing/corrupted database gracefully |
| Environment Variables | Assume variables are set | Check existence, provide defaults or clear error messages |
| File System | Assume directories exist | Create directories with `{ recursive: true }`, handle permission errors |
| HTTP APIs | Retry all errors equally | Retry only idempotent methods (GET, PUT) and specific status codes (429, 503) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Large JSON cache files | Slow reads/writes, memory pressure | Limit cache size, use streaming JSON parser, switch to SQLite | Cache > 10MB |
| No cache invalidation | Stale data, API rate limit exhaustion | TTL-based expiration, size limits, LRU eviction | Cache grows unbounded |
| Synchronous SQLite queries | Blocking event loop, slow response times | Use async/await properly, keep transactions short | Query time > 100ms |
| Verbose logging on every invocation | Disk I/O bottleneck, large log files | Log levels (debug/info/error), log rotation | > 100 invocations/minute |
| No request pooling | Connection overhead, slow API calls | Reuse connections, use HTTP keep-alive | > 10 API calls/invocation |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Log API keys in error messages | Credential exposure in logs | Mask sensitive values before logging |
| Store API keys in cache file | Other users can read credentials | Don't cache credentials, only cache usage data |
| Execute database queries without validation | SQL injection (unlikely but possible) | Use parameterized queries, validate inputs |
| Trust environment variables blindly | Injection attacks via env vars | Validate and sanitize all external input |
| Write cache with world-readable permissions | Other users can access usage data | Set restrictive file permissions (0600) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cryptic error messages | Users can't debug problems | Provide actionable error messages with suggestions |
| No progress indication for slow operations | Users think tool is hung | Show spinner or status updates for operations > 1s |
| Verbose output by default | Hard to parse in scripts | Default to concise, use `--verbose` flag for details |
| Assume default runtime | Wrong runtime used, unexpected errors | Detect runtime, warn if different from expected |
| No `--help` flag | Users can't discover features | Implement comprehensive help with examples |
| Exit without message | Users don't know what happened | Always print result or status before exit |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Cross-Runtime Compatibility:** Often tested in one runtime only — verify both Bun AND Node.js work identically
- [ ] **Cache Invalidation:** Often missing TTL check — verify old cache entries are actually invalidated
- [ ] **Error Exit Codes:** Often always returns 0 — verify `echo $?` shows non-zero on errors
- [ ] **Concurrent Access:** Often tested sequentially only — verify multiple simultaneous invocations work
- [ ] **CC Switch Detection:** Often works with localhost but fails with 127.0.0.1 — verify both patterns detected
- [ ] **API Error Handling:** Often handles happy path only — verify rate limits, timeouts, auth errors handled
- [ ] **Template Engine:** Often broken edge cases — verify custom templates work with missing/undefined values
- [ ] **Cache Directory:** Often assumes directory exists — verify cache directory created if missing

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SQLite module incompatibility | LOW | Install compatible module, add runtime detection |
| Database locked errors | MEDIUM | Enable WAL mode, increase timeout, reduce concurrent access |
| Cache corruption | LOW | Delete cache file, let tool recreate it |
| Missing exit codes | LOW | Add top-level error handler, set exitCode |
| Process exit before completion | MEDIUM | Remove process.exit(), use natural exit, await all operations |
| Cross-runtime API differences | MEDIUM | Add runtime detection, abstract differences, test both |
| Cache race conditions | MEDIUM | Implement atomic writes, add file locking, or switch to SQLite |
| HTTP timeout issues | LOW | Add timeout configuration, implement retry logic |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SQLite module incompatibility | Phase 1 (Core Infrastructure) | Run tests in both Bun and Node.js |
| Database locked errors | Phase 1 (Core Infrastructure) | Test concurrent invocations (5+ simultaneous) |
| JSON cache race conditions | Phase 1 (Core Infrastructure) | Test rapid sequential invocations |
| Process exit before completion | Phase 1 (Core Infrastructure) | Verify cache written after exit |
| Missing exit codes | Phase 1 (Core Infrastructure) | Test `echo $?` after success and error |
| Cross-runtime API differences | Phase 1 (Core Infrastructure) | Comprehensive test suite in both runtimes |
| HTTP timeout configuration | Phase 2 (API Integration) | Test with slow/unreliable network, verify retry logic |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SQLite Access | Database locked under concurrent access | Enable WAL mode, set busy_timeout, use IMMEDIATE transactions |
| Cache Implementation | Race conditions in JSON cache | Use atomic file writes (write to temp, rename) |
| HTTP Client | Timeouts and retry storms | Set reasonable timeouts, exponential backoff, respect Retry-After |
| Error Handling | Missing exit codes, stack traces in output | Top-level error handler with clean messages, semantic exit codes |
| CC Switch Detection | Only detects localhost, misses 127.0.0.1 | Test both patterns, use URL parsing not string matching |
| Template Engine | Broken with missing/undefined values | Validate template rendering with edge cases |
| Cross-Runtime Testing | Only tested in one runtime | CI/CD runs tests in both Bun and Node.js |

## Sources

### Cross-Runtime Compatibility
- [Bun vs Node.js Comparison](https://refine.dev/blog/bun-js-vs-node/) - Refine, updated 2024-08-12
- [Bun Node.js Compatibility Docs](https://bun.com/docs/runtime/nodejs-compat) - Official Bun documentation
- [Bun 1.2 Improves Node Compatibility](https://www.infoq.com/news/2025/04/bun-12-node-compat-postgres/) - InfoQ, 2025-04
- [GitHub Issue: Support node:sqlite](https://github.com/oven-sh/bun/issues/20412) - Bun GitHub repository

### SQLite
- [Bun SQLite Documentation](https://bun.com/docs/runtime/sqlite) - Official Bun SQLite guide
- [Node.js node:sqlite Reference](https://bun.com/reference/node/sqlite) - Node.js SQLite in Bun context
- [SQLite Write-Ahead Logging](https://sqlite.org/wal.html) - Official SQLite WAL documentation
- [SQLite Concurrent Writes](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/) - Blog post on locking issues
- [SQLite Forum: Database Locking](https://sqlite.org/forum/forumpost/4350638e78869137) - Community discussion

### Error Handling & Exit Codes
- [Error Handling in CLI Tools](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9) - Medium, practical patterns
- [Avoid process.exit()](https://humanwhocodes.com/blog/2014/02/04/maintainable-node-js-javascript-avoid-process-exit/) - Human Who Codes
- [Node.js Exit Codes](https://www.geeksforgeeks.org/node-js/node-js-exit-codes/) - GeeksforGeeks
- [Node.js Process Exit Strategies](https://leapcell.io/blog/nodejs-process-exit-strategies) - Leapcell blog

### HTTP & API Integration
- [Error Handling Through Timeout and Retries](https://docs.commercetools.com/api/error-handling) - commercetools API docs
- [Best Practices for API Error Handling](https://zuplo.com/learning-center/best-practices-for-api-error-handling/) - Zuplo
- [Best Practice: Implementing Retry Logic](https://api4ai/blog/best-practice-implementing-retry-logic-in-http-api-clients) - api4ai

### Caching & Concurrency
- Cache invalidation research from [Codex CLI internals](https://www.infoq.com/news/2026/02/codex-agent-loop/) - InfoQ, 2026-02
- General file locking patterns from proper-lockfile and fs-extra documentation

---
*Pitfalls research for: Single-file CLI tool with cross-runtime compatibility*
*Researched: 2026-03-31*
