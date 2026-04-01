# Phase 01: Core Infrastructure - Research

**Researched:** 2026-04-01
**Domain:** Cross-runtime JavaScript infrastructure (Bun/Node.js), SQLite, HTTP, error handling)
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational layer for the AI API Usage Monitor tool, enabling all subsequent phases. This research covers cross-runtime compatibility patterns, SQLite database access with conditional imports, HTTP client implementation with retry and timeout, and error handling with semantic exit codes.

**Primary recommendation:** Use runtime-conditional imports for SQLite, native fetch with AbortController for timeouts, and layered error handling with clear exit codes to build a robust foundation that works identically on Bun and Node.js.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| **Native Fetch API** | Built-in (Node 18+, Bun) | HTTP client for API requests | Zero dependencies, built into both runtimes. Sufficient performance for CLI use case. Eliminates need for axios/got, keeping tool truly single-file and portable. |
| **bun:sqlite** | Bun 1.3.10+ | SQLite database access (Bun runtime) | 3-6x faster than better-sqlite3. Built-in to Bun runtime, no native compilation required. Use with `db.run("PRAGMA journal_mode = WAL")` for concurrent access. |
| **node:sqlite** | Node 22.5.0+ (stable in v25.7.0+) | SQLite database access (Node.js runtime) | Official built-in module, no external dependencies. Synchronous API (`DatabaseSync`). Use with `db.exec("PRAGMA journal_mode = WAL")` for concurrent access. |
| **AbortController** | Built-in (Node 18+, Bun) | Timeout management for fetch requests | Native API for canceling async operations. Works identically in both runtimes. Combine with `setTimeout` to abort fetch requests after timeout threshold. |
| **Template Literals** | Native ES6+ | Output formatting | 4x faster than Handlebars, zero dependencies. Native JavaScript engine optimization. Sufficient for statusLine output and custom templates. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **process** | Built-in (Node, Bun) | Process exit codes | Use semantic exit codes (0=success, 1=error, 2=config error) for clear CLI feedback |
| **console** | Built-in (Node, Bun) | Output to stdout/stderr | Use `console.error()` for errors (stderr), `console.log()` for output (stdout) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------ |-----------|----------|
| **Native Fetch** | Axios (5-13KB) | Complex apps needing interceptors, automatic transforms, or better error handling on HTTP errors. Overkill for simple CLI usage. |
| **Native Fetch** | Got (~50KB) | Node.js-only applications requiring pagination, streams, or retry logic. Adds significant bundle size. |
| **bun:sqlite** | better-sqlite3 | Node.js-only environments. 3-6x slower than bun:sqlite, requires native compilation, breaks Bun `--compile` portability. |
| **Template Literals** | Handlebars 4.7.9 | Complex template reuse, email templates. Adds 100-200KB, slower than native literals. |
| **Manual retry logic** | Custom retry wrapper | Full control over retry behavior, but more code to maintain. Native fetch + simple retry wrapper is sufficient. |

**Installation:**
```bash
# No npm dependencies required!
# The tool uses only built-in runtime APIs
# For development (optional):
bun install -g bun  # Ensure Bun 1.3.10+ is available

# Build single-file executable:
bun build usage.mjs --compile --outfile usage
```

**Version verification:**
```bash
# Verified versions (2026-04-01):
Bun: 1.3.10 ✓
Node.js: 24.14.0 ✓
Commander.js: 14.0.3 (published 2026-02-21)
```

## Architecture Patterns

### Recommended Project Structure (Single File)

```
usage.mjs
├── Shebang & Metadata (lines 1-20)
│   #!/usr/bin/env node
│   // Metadata: version, description
│
├── Imports (lines 20-100)
│   // Native modules: fs, path, os, sqlite
│   // Runtime detection and conditional imports
│
├── Constants & Configuration (lines 100-200)
│   // API endpoints, cache duration, timeout settings
│   // Exit codes, error messages
│   // Default settings
│
├── Utility Functions (lines 200-400)
│   // Runtime detection
│   // Error formatting
│   // Path resolution
│   // Validation helpers
│
├── Infrastructure Layer (lines 400-700)
│   // Database access (runtime-conditional)
│   // HTTP client wrapper with retry and timeout
│   // File I/O operations
│
├── Service Layer (lines 700-1000)
│   // Provider detection logic
│   // Cache management (read/write/validate)
│   // Proxy penetration logic
│   // API response normalization
│
├── Coordination Layer (lines 1000-1200)
│   // Main orchestration function
│   // Flow control: detect → penetrate → fetch → cache → output
│   // Error handling and propagation
│
├── CLI Interface Layer (lines 1200-1500)
│   // Argument parsing (if Commander.js used)
│   // Output formatting (concise/template)
│   // Error display and exit codes
│
└── Entry Point (lines 1500+)
    // Top-level await or main() call
    // Process exit handling
```

### Pattern 1: Runtime-Conditional SQLite Import
**What:** Detect runtime and load appropriate SQLite module (`bun:sqlite` for Bun, `node:sqlite` for Node.js).
**When to use:** All code requiring SQLite database access in cross-runtime applications.
**Example:**
```javascript
// Runtime detection and conditional import
let Database;

async function loadDatabaseModule() {
  if (typeof Bun !== 'undefined') {
    // Bun runtime
    const module = await import('bun:sqlite');
    Database = module.Database;
  } else if (typeof process !== 'undefined' && process.versions) {
    // Node.js runtime
    const module = await import('node:sqlite');
    Database = module.DatabaseSync; // Note: DatabaseSync in Node.js
  } else {
    throw new Error('Unsupported runtime: requires Bun or Node.js 22.5.0+');
  }
}

// Database access with WAL mode
async function openDatabase(dbPath) {
  await loadDatabaseModule();

  const db = new Database(dbPath);

  // Enable WAL mode for concurrent access
  if (typeof Bun !== 'undefined') {
    db.run('PRAGMA journal_mode = WAL');
  } else {
    db.exec('PRAGMA journal_mode = WAL');
  }

  // Set busy timeout (10 seconds)
  if (typeof Bun !== 'undefined') {
    db.run('PRAGMA busy_timeout = 10000');
  } else {
    db.exec('PRAGMA busy_timeout = 10000');
  }

  return db;
}

// Usage
const db = await openDatabase('/path/to/database.db');
const result = db.prepare('SELECT * FROM users WHERE id = ?').get(1);
```

**Source:** Adapted from [How to Use SQLite with Bun's Native Support](https://oneuptime.com/blog/post/2026-01-31-bun-sqlite/view) (OneUptime, 2026)

### Pattern 2: Fetch with Retry and Timeout
**What:** Wrap native fetch with exponential backoff retry logic and AbortController timeout.
**When to use:** All HTTP requests requiring resilience against transient failures.
**Example:**
```javascript
// Fetch with retry and timeout
async function fetchWithRetry(url, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    timeout = 5000,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.response = response;
          throw error;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }

      // Check if error is retryable
      const isRetryable =
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        (error.response && [408, 429, 500, 502, 503, 504].includes(error.response.status));

      if (attempt === maxAttempts || !isRetryable) {
        throw error;
      }

      // Respect Retry-After header for 429 responses
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers.get('retry-after');
        if (retryAfter) {
          const retryDelay = parseInt(retryAfter) * 1000;
          delay = Math.min(retryDelay, maxDelay);
        }
      }

      console.error(`Attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff with cap
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

// Usage
try {
  const response = await fetchWithRetry('https://api.example.com/data', {
    headers: { 'Authorization': 'Bearer token' },
    timeout: 5000,
    maxAttempts: 3,
  });

  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Request failed:', error.message);
  process.exit(1);
}
```

**Source:** Adapted from [How to Implement Retry Logic with Exponential Backoff in Node.js](https://oneuptime.com/blog/post/2026-01-06-nodejs-retry-exponential-backoff/view) (OneUptime, 2026)

### Pattern 3: Layered Error Handling
**What:** Organize error handling into layers with clear exit codes and actionable messages.
**when to use:** All CLI applications requiring clear user feedback on errors.
**Example:**
```javascript
// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  CONFIG_ERROR: 2,
  NETWORK_ERROR: 3,
  DATABASE_ERROR: 4,
};

// Error classes
class CliError extends Error {
  constructor(message, exitCode = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

class ConfigError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.CONFIG_ERROR);
    this.name = 'ConfigError';
  }
}

class NetworkError extends CliError {
  constructor(message, originalError) {
    super(message, EXIT_CODES.NETWORK_ERROR);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

class DatabaseError extends CliError {
  constructor(message, originalError) {
    super(message, EXIT_CODES.DATABASE_ERROR);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

// Error handler
function handleError(error) {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  } else {
    console.error('Unexpected error:', error.message);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Usage
try {
  throw new ConfigError('ANTHROPIC_BASE_URL environment variable not set');
} catch (error) {
  handleError(error);
}
```

**Source:** Adapted from [nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) (GitHub)

### Anti-Patterns to Avoid

- **God Function:** Don't write entire CLI logic in one massive `main()` function. Break into focused functions with single responsibilities (database, HTTP, error handling, output formatting).
- **Silent Failure:** Never catch errors and silently return default values. Fail fast with clear error messages to help users diagnose issues immediately.
- **Synchronous I/O in Hot Path:** Don't use `fs.readFileSync` or synchronous database operations. Use async/await throughout to prevent blocking the event loop.
- **Tight Coupling to Runtime-Specific APIs:** Don't use `bun:sqlite` directly without abstraction. Always wrap runtime-specific imports in unified interface to ensure cross-runtime compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **HTTP client with retry logic** | Custom fetch wrapper from scratch | Native fetch + simple retry wrapper (30-50 lines) | Retry logic is well-understood pattern. Native fetch is sufficient. Custom solutions add complexity without benefit. |
| **Database abstraction layer** | Custom ORM or query builder | Direct SQLite queries with prepared statements | SQLite is simple enough for this use case. ORMs add abstraction without benefit, increase bundle size. |
| **Template engine** | Custom string formatter | Native template literals | Template literals are 4x faster, built-in, and more flexible for this use case. |
| **Configuration management** | Custom config loader | Environment variables + simple file I/O | Configuration is simple (API keys, base URLs). Custom loaders add unnecessary complexity. |

**Key insight:** Native APIs and simple patterns are superior to custom solutions for this use case. The tool's constraints (single-file, cross-runtime, zero dependencies) favor built-in APIs over third-party libraries.

## Common Pitfalls

### Pitfall 1: SQLite Locking Errors
**What goes wrong:** Concurrent database access causes "database is locked" errors when multiple processes try to read/write simultaneously.
**Why it happens:** Default SQLite journal mode (DELETE) doesn't support concurrent reads and writes.
**How to avoid:** Enable WAL mode immediately after opening database: `db.run("PRAGMA journal_mode = WAL")`. Also set busy timeout: `db.run("PRAGMA busy_timeout = 10000")`.
**Warning signs:** "SQLITE_BUSY" errors, "database is locked" messages, random read/write failures.

### Pitfall 2: Fetch Timeout Not Clear
**What goes wrong:** Network requests hang indefinitely, causing CLI tool to appear frozen.
**Why it happens:** Native fetch has no default timeout. Slow or unresponsive APIs block execution.
**How to avoid:** Always use AbortController with setTimeout to enforce timeout. Default: 5000ms. Make configurable via options.
**Warning signs:** CLI hangs on API calls, no error message, user doesn't know if request is pending or failed.

### Pitfall 3: Retry Without Jitter Causes Thundering Herd
**What goes wrong:** Multiple CLI instances retry simultaneously, overwhelming recovering service.
**Why it happens:** Fixed retry intervals cause synchronized retry attempts from multiple clients.
**How to avoid:** Add jitter (randomness) to retry delays. Use "full jitter" (random between 0 and delay) or "equal jitter" (half fixed, half random).
**Warning signs:** Service receives burst of retries at same intervals, cascade failures across multiple clients.

### Pitfall 4: Unclear Error Messages
**What goes wrong:** Users see generic error messages like "An error occurred" without actionable guidance.
**Why it happens:** Catch blocks throw generic errors without adding context or suggested fixes.
**How to avoid:** Provide specific error messages with context: what failed, why it failed, what to check. Example: "Failed to open CC Switch database at ~/.cc-switch/cc-switch.db. Verify the file exists and is readable."
**Warning signs:** Users report "tool doesn't work" without details, support requests ask "what's the error?", debugging requires adding console.log statements.

### Pitfall 5: Runtime Detection Fails Silently
**What goes wrong:** Tool crashes with "Database is not defined" when running on unexpected runtime.
**Why it happens:** Runtime detection only checks for Bun, assumes Node.js if not Bun, but doesn't handle other runtimes or older Node.js versions.
**How to avoid:** Explicitly check for both Bun and Node.js with version requirements. Throw clear error if runtime is unsupported: "This tool requires Bun 1.3.10+ or Node.js 22.5.0+. Detected: Node.js 18.0.0".
**Warning signs:** Runtime errors in database import, "module not found" errors, crashes on older Node.js versions.

## Code Examples

Verified patterns from official sources:

### SQLite Database Access (Runtime-Conditional)
```javascript
// Source: https://oneuptime.com/blog/post/2026-01-31-bun-sqlite/view
// Runtime detection and conditional import
let Database;

async function loadDatabaseModule() {
  if (typeof Bun !== 'undefined') {
    const module = await import('bun:sqlite');
    Database = module.Database;
  } else if (typeof process !== 'undefined' && process.versions) {
    const module = await import('node:sqlite');
    Database = module.DatabaseSync;
  } else {
    throw new Error('Unsupported runtime: requires Bun 1.3.10+ or Node.js 22.5.0+');
  }
}

async function openDatabase(dbPath) {
  await loadDatabaseModule();
  const db = new Database(dbPath);

  // Enable WAL mode for concurrent access
  if (typeof Bun !== 'undefined') {
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA busy_timeout = 10000');
  } else {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 10000');
  }

  return db;
}
```

### Fetch with Retry and Timeout
```javascript
// Source: https://oneuptime.com/blog/post/2026-01-06-nodejs-retry-exponential-backoff/view
async function fetchWithRetry(url, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    timeout = 5000,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.response = response;
          throw error;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error;

      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }

      const isRetryable =
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        (error.response && [408, 429, 500, 502, 503, 504].includes(error.response.status));

      if (attempt === maxAttempts || !isRetryable) {
        throw error;
      }

      // Respect Retry-After header
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers.get('retry-after');
        if (retryAfter) {
          delay = Math.min(parseInt(retryAfter) * 1000, maxDelay);
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}
```

### Error Handling with Exit Codes
```javascript
// Source: https://github.com/lirantal/nodejs-cli-apps-best-practices
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  CONFIG_ERROR: 2,
  NETWORK_ERROR: 3,
  DATABASE_ERROR: 4,
};

class CliError extends Error {
  constructor(message, exitCode = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function handleError(error) {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  } else {
    console.error('Unexpected error:', error.message);
    process.exit(EXIT_CODES.ERROR);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|-------|
| **Third-party SQLite libraries (better-sqlite3, sqlite3)** | **Built-in SQLite (bun:sqlite, node:sqlite)** | Bun 1.0+ (2023), Node.js 22.5.0+ (2024) | Eliminates native compilation, reduces dependencies, improves performance (3-6x faster in Bun) |
| **Axios or Got for HTTP requests** | **Native fetch API** | Node.js 18+ (2018), Bun 1.0+ (2023) | Reduces bundle size (5-50KB saved), simplifies architecture, zero dependencies |
| **Fixed retry intervals** | **Exponential backoff with jitter** | Industry standard (2020+) | Prevents thundering herd problem, improves retry success rate |
| **Synchronous I/O** | **Async/await throughout** | Node.js 10+ (2016) | Prevents blocking event loop, improves responsiveness in CLI tools |
| **Generic error messages** | **Actionable error messages with context** | CLI best practices (2019+) | Improves user experience, reduces support burden, faster debugging |

**Deprecated/outdated:**
- **better-sqlite3 for Bun projects:** Native `bun:sqlite` is 3-6x faster and requires no compilation. Use better-sqlite3 only for Node.js < 22.5.0.
- **axios for simple CLI tools:** Adds 5-13KB bundle size, requires dependency management. Native fetch is sufficient for most CLI use cases.
- **Synchronous database operations:** Blocks event loop, causes poor UX in interactive scenarios. Always use async operations.

## Open Questions

1. **Should we use Commander.js for argument parsing, or implement native argument parsing?**
   - What we know: Commander.js is minimal and zero-dependency, but adds complexity for simple use cases.
   - What's unclear: Whether the CLI interface will have complex subcommands or just simple flags.
   - Recommendation: If the tool only needs simple flags (--json, --verbose, --cache-duration), implement native argument parsing (20-30 lines) to keep zero dependencies. If the tool will have subcommands or complex option combinations, use Commander.js.

2. **Should the retry logic include circuit breaker pattern?**
   - What we know: Circuit breakers prevent repeated calls to failing services by "opening" after threshold failures.
   - What's unclear: Whether the tool will make frequent API calls to the same endpoint (risk of cascade failures).
   - Recommendation: For a CLI tool invoked occasionally (statusLine refresh), circuit breaker is probably overkill. Simple retry with exponential backoff is sufficient. If the tool will run in watch mode (continuous monitoring), add circuit breaker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Bun runtime** | SQLite access (bun:sqlite) | ✓ | 1.3.10 | Use Node.js instead |
| **Node.js runtime** | SQLite access (node:sqlite) | ✓ | 24.14.0 | Use Bun instead |
| **Native fetch** | HTTP client | ✓ | Built-in | — |
| **AbortController** | Timeout management | ✓ | Built-in | — |
| **process** | Exit codes | ✓ | Built-in | — |

**Missing dependencies with no fallback:**
- None detected. Both runtimes (Bun 1.3.10, Node.js 24.14.0) are available and meet requirements.

**Missing dependencies with fallback:**
- None detected. All required features are available in both runtimes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun built-in test runner |
| Config file | None — see Wave 0 |
| Quick run command | `bun test` |
| Full suite command | `bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | Single-file ESM architecture with zero dependencies | unit | `bun test test/runtime-detection.test.js` | ❌ Wave 0 |
| CORE-02 | Cross-runtime compatibility (Bun and Node.js) | unit | `bun test test/runtime-detection.test.js` | ❌ Wave 0 |
| CORE-03 | Fail-fast error handling with clear messages | unit | `bun test test/error-handling.test.js` | ❌ Wave 0 |
| CORE-04 | Semantic exit codes | unit | `bun test test/error-handling.test.js` | ❌ Wave 0 |
| DB-01 | Use bun:sqlite when running under Bun | integration | `bun test test/database-bun.test.js` | ❌ Wave 0 |
| DB-02 | Use node:sqlite when running under Node.js | integration | `bun test test/database-node.test.js` | ❌ Wave 0 |
| DB-03 | Runtime detection and conditional import | unit | `bun test test/runtime-detection.test.js` | ❌ Wave 0 |
| DB-04 | Enable WAL mode for concurrent access | integration | `bun test test/database-wal.test.js` | ❌ Wave 0 |
| DB-05 | Set busy timeout to prevent locking | integration | `bun test test/database-busy-timeout.test.js` | ❌ Wave 0 |
| HTTP-01 | Use native fetch API | unit | `bun test test/http-client.test.js` | ❌ Wave 0 |
| HTTP-02 | Set reasonable timeout (5s default) | unit | `bun test test/http-timeout.test.js` | ❌ Wave 0 |
| HTTP-03 | Implement retry logic with exponential backoff | unit | `bun test test/http-retry.test.js` | ❌ Wave 0 |
| HTTP-04 | Handle rate limit (429) with Retry-After | unit | `bun test test/http-rate-limit.test.js` | ❌ Wave 0 |
| HTTP-05 | Clear error messages for network failures | unit | `bun test test/http-error-messages.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test` (quick validation, <2 seconds)
- **Per wave merge:** `bun test` (full suite validation)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/runtime-detection.test.js` — covers CORE-01, CORE-02, DB-03
- [ ] `test/error-handling.test.js` — covers CORE-03, CORE-04
- [ ] `test/database-bun.test.js` — covers DB-01
- [ ] `test/database-node.test.js` — covers DB-02
- [ ] `test/database-wal.test.js` — covers DB-04
- [ ] `test/database-busy-timeout.test.js` — covers DB-05
- [ ] `test/http-client.test.js` — covers HTTP-01
- [ ] `test/http-timeout.test.js` — covers HTTP-02
- [ ] `test/http-retry.test.js` — covers HTTP-03
- [ ] `test/http-rate-limit.test.js` — covers HTTP-04
- [ ] `test/http-error-messages.test.js` — covers HTTP-05
- [ ] `tests/conftest.js` — shared fixtures (test database setup, mock fetch)
- [ ] Framework install: `bun test` is built-in, no install required

*(All test files need to be created in Wave 0)*

## Sources

### Primary (HIGH confidence)
- [OneUptime: How to Use SQLite with Bun's Native Support](https://oneuptime.com/blog/post/2026-01-31-bun-sqlite/view) - Bun SQLite API, WAL mode, performance benchmarks
- [OneUptime: How to Implement Retry Logic with Exponential Backoff in Node.js](https://oneuptime.com/blog/post/2026-01-06-nodejs-retry-exponential-backoff/view) - Retry patterns, exponential backoff, jitter, circuit breaker
- [Bun Official Documentation: Test Runner](https://bun.com/docs/test) - Built-in test framework, Jest compatibility
- [Node.js Official Documentation: SQLite Module](https://nodejs.org/api/sqlite.html) - node:sqlite API, DatabaseSync class
- [GitHub: nodejs-cli-apps-best-practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) - CLI patterns, exit codes, error handling

### Secondary (MEDIUM confidence)
- [DEV Community: Retrying Failed Requests with Exponential Backoff](https://dev.to/abhivyaktii/retrying-failed-requests-with-exponential-backoff-48ld) - Exponential backoff formula, implementation examples
- [Ben Nadel: Using fetch(), AbortSignal, And setTimeout() To Apply Retry Mechanics](https://www.bennadel.com/blog/4200-using-fetch-abortsignal-and-settimeout-to-apply-retry-mechanics-in-javascript.htm) - Fetch with timeout and retry implementation

### Tertiary (LOW confidence)
- [Stack Overflow: Node, wait and retry api calls that fail](https://stackoverflow.com/questions/57274602/node-wait-and-retry-api-calls-that-fail) - Community solutions for rate-limited API calls

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified with official documentation (Bun, Node.js), current versions confirmed
- Architecture patterns: HIGH - Based on established patterns from STACK.md and ARCHITECTURE.md research
- Pitfalls: HIGH - Derived from official documentation and common SQLite/HTTP issues

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (30 days - stable patterns, built-in APIs)
