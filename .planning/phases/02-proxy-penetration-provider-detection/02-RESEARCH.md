# Phase 02: Proxy Penetration & Provider Detection - Research

**Researched:** 2026-04-01
**Domain:** CC Switch proxy detection, SQLite credential extraction, provider auto-detection
**Confidence:** HIGH

## Summary

Phase 02 implements automatic credential extraction from CC Switch proxy SQLite database and provider type detection based on API endpoint domain. This enables zero-configuration usage for users behind CC Switch proxy while maintaining fallback to standard environment variable authentication for direct API access.

**Primary recommendation:** Use native URL API for domain parsing and JSON.parse for credential extraction. Fail-fast on any proxy database errors (no silent fallback to env vars when proxy is detected). Leverage Phase 01's `openDatabase()` and `ConfigError` infrastructure.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Check only `ANTHROPIC_BASE_URL` and `BASE_URL` environment variables for proxy detection
- **D-02:** Support `localhost`, `127.0.0.1`, `0.0.0.0` as local address patterns
- **D-03:** Use fixed database path: `~/.cc-switch/cc-switch.db`
- **D-04:** Extract credentials from `providers` table, `settings_config` field (JSON), query by `id = 'default'`
- **D-05:** Domain-based provider detection: `kimi.com` → Kimi, `bigmodel.cn` → GLM, others → throw ConfigError
- **D-06:** Fail-fast on proxy credential extraction errors (no fallback to env vars when proxy detected)
- **D-07:** Environment variable fallback for non-proxy usage (read `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`)

### Claude's Discretion

- Implementation details for database query execution
- JSON parsing error message wording
- Exact string matching vs regex for domain detection
- Whether to validate API key format before returning

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROXY-01 | Detect localhost/127.0.0.1 in `ANTHROPIC_BASE_URL` or `BASE_URL` environment variables | Use `process.env` checks, string matching for local addresses |
| PROXY-02 | Read CC Switch SQLite database at `~/.cc-switch/cc-switch.db` | Use Phase 01 `openDatabase()` with expanded path (`~` → home directory) |
| PROXY-03 | Extract real API credentials from `provider` table (`settings_config` JSON field) | Query `SELECT settings_config FROM providers WHERE id = 'default'`, parse JSON |
| PROXY-04 | Parse `settings_config` to extract `apiKey` and `baseUrl` | JSON.parse with try-catch, extract `env.ANTHROPIC_AUTH_TOKEN` and `env.ANTHROPIC_BASE_URL` |
| PROXY-05 | Fail with clear error if database unreadable or JSON parsing fails | Throw `ConfigError` with actionable message, no fallback to env vars |
| PROV-01 | Auto-detect provider type based on baseUrl domain | Use native `URL` API to extract hostname, substring match for domains |
| PROV-02 | Support environment variable authentication when no proxy detected | Read `process.env.ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` |
| PROV-03 | Route to correct API endpoint based on detected provider | Return provider type ('kimi' or 'glm') with credentials for Phase 03 routing |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Native URL API** | Built-in (Node 10+, Bun) | URL parsing and hostname extraction | Zero dependencies, built into both runtimes, standardized WHATWG URL spec. Handles edge cases (ports, IPv6, IDN). |
| **JSON.parse** | Built-in (ES5+) | Parse `settings_config` JSON from database | Native, fastest option, sufficient for this use case. No schema validation needed. |
| **process.env** | Built-in (Node/Bun) | Environment variable access | Standard way to read env vars in both runtimes. No dotenv needed (adds dependency). |
| **os.homedir()** | Built-in (Node/Bun) | Expand `~` in database path | Cross-platform home directory resolution. Works on macOS, Linux, Windows. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Phase 01 infrastructure** | N/A | Reuse existing error classes and database layer | Always — `ConfigError`, `openDatabase()` already implemented and tested |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Native URL API** | Regex hostname extraction | Regex is error-prone (ports, IPv6, edge cases). URL API handles all edge cases correctly. |
| **Native URL API** | `url.parse()` (deprecated) | `url.parse()` is deprecated in Node.js. `URL` class is modern standard. |
| **JSON.parse** | JSON5, jsonc-parser | Adds dependencies for no benefit (CC Switch outputs standard JSON). |
| **os.homedir()** | `process.env.HOME` | `HOME` not set on Windows. `os.homedir()` is cross-platform. |

**Installation:**
```bash
# No additional dependencies required
# All functionality uses built-in runtime APIs
```

**Version verification:** N/A — all features are built-in to supported runtimes (Bun 1.3.10+, Node.js 22.5.0+).

## Architecture Patterns

### Recommended Function Structure
```
usage.mjs
├── Proxy Detection
│   ├── isProxyEnabled() → boolean
│   └── getLocalAddressPatterns() → string[]
├── Credential Extraction
│   ├── getProxyCredentials() → { apiKey, baseUrl }
│   ├── getEnvCredentials() → { apiKey }
│   └── getCredentials() → { apiKey, baseUrl?, provider }
├── Provider Detection
│   ├── detectProvider(baseUrl) → 'kimi' | 'glm'
│   └── validateProvider(provider) → void
└── Database Path Resolution
    └── expandHomePath(path) → string
```

### Pattern 1: Proxy Detection
**What:** Check environment variables for localhost addresses to detect CC Switch proxy
**When to use:** Called first in credential resolution flow
**Example:**
```javascript
// Source: User decision D-01, D-02
function isProxyEnabled() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || process.env.BASE_URL;
  if (!baseUrl) return false;

  const localPatterns = ['localhost', '127.0.0.1', '0.0.0.0'];
  return localPatterns.some(pattern => baseUrl.includes(pattern));
}
```

### Pattern 2: Credential Extraction from CC Switch Database
**What:** Query SQLite database for credentials when proxy is detected
**When to use:** When `isProxyEnabled()` returns true
**Example:**
```javascript
// Source: User decision D-03, D-04
async function getProxyCredentials() {
  const dbPath = expandHomePath('~/.cc-switch/cc-switch.db');
  const db = await openDatabase(dbPath);

  try {
    const result = db.prepare('SELECT settings_config FROM providers WHERE id = ?')
      .get('default');

    if (!result || !result.settings_config) {
      throw new ConfigError(
        'CC Switch database has no default provider configuration. ' +
        'Verify CC Switch is properly configured.'
      );
    }

    const config = JSON.parse(result.settings_config);

    const apiKey = config.env?.ANTHROPIC_AUTH_TOKEN;
    const baseUrl = config.env?.ANTHROPIC_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new ConfigError(
        'CC Switch database missing required credentials. ' +
        'Expected env.ANTHROPIC_AUTH_TOKEN and env.ANTHROPIC_BASE_URL in settings_config.'
      );
    }

    return { apiKey, baseUrl };
  } catch (error) {
    if (error instanceof ConfigError) throw error;

    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Failed to parse CC Switch configuration: ${error.message}. ` +
        'Database may be corrupted. Try reconfiguring CC Switch.'
      );
    }

    throw new ConfigError(
      `Failed to read CC Switch database: ${error.message}. ` +
      `Verify database exists at ${dbPath} and is readable.`
    );
  } finally {
    closeDatabase(db);
  }
}
```

### Pattern 3: Provider Detection from Domain
**What:** Extract domain from baseUrl and map to provider type
**When to use:** After extracting baseUrl from proxy or environment
**Example:**
```javascript
// Source: User decision D-05, MDN Web Docs (URL.hostname)
function detectProvider(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname; // e.g., "api.kimi.com" or "open.bigmodel.cn"

    if (hostname.includes('kimi.com')) {
      return 'kimi';
    }
    if (hostname.includes('bigmodel.cn')) {
      return 'glm';
    }

    throw new ConfigError(
      `Unsupported API provider: ${hostname}. ` +
      'This tool only supports Kimi (kimi.com) and GLM (bigmodel.cn) providers.'
    );
  } catch (error) {
    if (error instanceof ConfigError) throw error;

    throw new ConfigError(
      `Invalid API base URL: ${baseUrl}. ` +
      'URL must be a valid HTTP/HTTPS endpoint.'
    );
  }
}
```

### Pattern 4: Environment Variable Fallback
**What:** Read credentials from environment when no proxy detected
**When to use:** When `isProxyEnabled()` returns false
**Example:**
```javascript
// Source: User decision D-07, Claude API docs
function getEnvCredentials() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

  if (!apiKey) {
    throw new ConfigError(
      'No API credentials found. Set ANTHROPIC_API_KEY environment variable ' +
      'or configure CC Switch proxy for automatic credential detection.'
    );
  }

  return { apiKey };
}
```

### Pattern 5: Unified Credential Resolution
**What:** Single entry point that coordinates proxy detection and credential extraction
**When to use:** Main function entry point before API calls
**Example:**
```javascript
// Source: Requirement PROV-02, PROV-03
async function getCredentials() {
  if (isProxyEnabled()) {
    const { apiKey, baseUrl } = await getProxyCredentials();
    const provider = detectProvider(baseUrl);
    return { apiKey, baseUrl, provider };
  } else {
    const { apiKey } = getEnvCredentials();
    // No baseUrl needed for direct API access (use provider defaults in Phase 03)
    return { apiKey, provider: null }; // Provider detected later from API response or env
  }
}
```

### Anti-Patterns to Avoid

- **Silent fallback to env vars on proxy database errors:** Violates D-06 fail-fast requirement. Users with proxy enabled expect credentials from database, not env vars. Silent fallback causes confusion.
- **Regex for URL parsing:** Error-prone for edge cases (IPv6 literals like `[::1]`, ports, IDN domains). Use native `URL` API.
- **Hardcoded home directory path:** `~` doesn't expand on Windows. Use `os.homedir()`.
- **Not closing database connection:** Resource leak. Always use try-finally to close database.
- **Catching and swallowing JSON.parse errors:** Results in "undefined" errors downstream. Catch and rethrow as `ConfigError` with context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing | Custom regex or string splitting | Native `URL` API | Handles ports, IPv6, IDN, query strings, edge cases correctly. Battle-tested. |
| Home directory resolution | `process.env.HOME || process.env.USERPROFILE` | `os.homedir()` | Cross-platform, handles Windows correctly, built-in. |
| JSON parsing | Custom parser or validator | `JSON.parse()` with try-catch | Native, fast, CC Switch outputs standard JSON. |
| Environment variable access | `dotenv` package | `process.env` directly | Adds dependency for no benefit. Bun/Node both support direct access. |
| SQLite JSON extraction | SQLite JSON functions (`json_extract`) | Query text field, parse in JavaScript | Simpler, more debuggable, works with both bun:sqlite and node:sqlite. |

**Key insight:** Phase 01 already established the infrastructure (error classes, database layer). This phase is pure business logic using built-in APIs. No new dependencies needed.

## Runtime State Inventory

> Phase involves adding new functions, not renaming/migrating existing state. Skip this section.

N/A — Phase 02 is greenfield implementation, not refactor/rename/migration.

## Common Pitfalls

### Pitfall 1: Database Path Expansion on Windows
**What goes wrong:** `~/.cc-switch/cc-switch.db` fails on Windows (no `HOME` env var)
**Why it happens:** `~` is Unix convention, not recognized by Windows paths
**How to avoid:** Use `os.homedir()` to expand `~` cross-platform
**Warning signs:** Tests pass on macOS/Linux but fail on Windows CI

### Pitfall 2: URL Parsing Errors Not Caught
**What goes wrong:** `new URL(invalidString)` throws `TypeError`, crashes process
**Why it happens:** URL constructor throws on invalid URLs (no protocol, malformed)
**How to avoid:** Wrap `new URL()` in try-catch, rethrow as `ConfigError` with actionable message
**Warning signs:** Tool crashes with "TypeError: Invalid URL" instead of clear error message

### Pitfall 3: Missing `settings_config` Fields
**What goes wrong:** `config.env.ANTHROPIC_AUTH_TOKEN` throws "Cannot read property of undefined"
**Why it happens:** Database structure changed, or CC Switch version has different schema
**How to avoid:** Use optional chaining (`config.env?.ANTHROPIC_AUTH_TOKEN`) and check for null/undefined explicitly
**Warning signs:** "Cannot read property 'ANTHROPIC_AUTH_TOKEN' of undefined" error

### Pitfall 4: Database Not Closed on Error
**What goes wrong:** SQLite database file locked, subsequent runs fail with "database is locked"
**Why it happens:** Exception thrown before `db.close()` called
**How to avoid:** Always use try-finally block to close database, even on error
**Warning signs:** Works once, fails on second run with "SQLITE_BUSY" or "database is locked"

### Pitfall 5: Provider Detection False Positives
**What goes wrong:** `hostname.includes('kimi.com')` matches `notkimi.com` or `kimi.com.example.org`
**Why it happens:** Substring matching too broad, doesn't respect domain boundaries
**How to avoid:** Match against known subdomain patterns OR validate domain ends with provider domain. For this use case, substring is acceptable (known providers, controlled environment).
**Warning signs:** Wrong provider detected for similar domain names

### Pitfall 6: Silent Fallback to Environment Variables
**What goes wrong:** Proxy database unreadable, tool silently uses env vars, queries wrong API
**Why it happens:** Catch block returns `getEnvCredentials()` instead of throwing
**How to avoid:** Throw `ConfigError` immediately on proxy database errors. No fallback when proxy detected.
**Warning signs:** User expects GLM credentials from CC Switch but tool uses Kimi key from env var

## Code Examples

Verified patterns from official sources:

### URL Hostname Extraction
```javascript
// Source: MDN Web Docs - URL.hostname
// https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname
const url = new URL('https://api.kimi.com/v1/usages');
console.log(url.hostname); // 'api.kimi.com'

// Handles IPv6, ports, IDN automatically
const url2 = new URL('https://[::1]:8080/path');
console.log(url2.hostname); // '[::1]'

// Invalid URL throws TypeError
try {
  const url3 = new URL('not-a-valid-url');
} catch (error) {
  console.log(error.name); // 'TypeError'
}
```

### Environment Variable Access
```javascript
// Source: Claude API TypeScript SDK docs
// https://platform.claude.com/docs/en/api/sdks/typescript
const apiKey = process.env.ANTHROPIC_API_KEY;

// Also supports ANTHROPIC_AUTH_TOKEN alias
const token = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;

// ANTHROPIC_BASE_URL for proxy/gateway routing
const baseUrl = process.env.ANTHROPIC_BASE_URL;
```

### Cross-Platform Home Directory
```javascript
// Source: Node.js docs - os.homedir()
import { homedir } from 'os';

const dbPath = '~/.cc-switch/cc-switch.db'.replace('~', homedir());
// macOS: '/Users/username/.cc-switch/cc-switch.db'
// Linux: '/home/username/.cc-switch/cc-switch.db'
// Windows: 'C:\\Users\\username\\.cc-switch\\cc-switch.db'
```

### JSON Parsing with Error Handling
```javascript
// Source: JavaScript best practice
try {
  const config = JSON.parse(jsonString);
} catch (error) {
  if (error instanceof SyntaxError) {
    throw new ConfigError(
      `Failed to parse configuration: ${error.message}. ` +
      'JSON may be malformed.'
    );
  }
  throw error;
}
```

### SQLite Query with Prepared Statement
```javascript
// Source: Phase 01 established pattern (database-bun.test.js, database-node.test.js)
const db = await openDatabase(dbPath);
try {
  // Both bun:sqlite and node:sqlite support prepare().get()
  const result = db.prepare('SELECT settings_config FROM providers WHERE id = ?').get('default');

  if (!result) {
    throw new ConfigError('No default provider found in database.');
  }

  return result.settings_config;
} finally {
  closeDatabase(db);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex URL parsing | Native `URL` API | Node.js 10+ (2018) | Eliminates edge case bugs, standardized behavior |
| `url.parse()` (deprecated) | `new URL()` (WHATWG) | Node.js 8+ (2017) | Modern URL standard, works in browser and Node |
| `process.env.HOME` | `os.homedir()` | Node.js 2+ (2014) | Cross-platform home directory resolution |
| SQLite JSON functions | Parse in JavaScript | Always | Simpler, more debuggable, runtime-agnostic |

**Deprecated/outdated:**
- **`url.parse()`:** Deprecated in Node.js. Use `new URL()` instead.
- **`dotenv` for CLI tools:** Bun and Node.js 20+ support `.env` natively. For this tool, direct `process.env` access is simpler (no file needed, env vars set by shell).

## Open Questions

1. **Should we validate API key format before returning?**
   - What we know: Kimi keys are 32-char hex + suffix, GLM keys have different format
   - What's unclear: Should validation happen here or in Phase 03 (API layer)?
   - Recommendation: Defer to Phase 03. This phase focuses on extraction, not validation. Let API layer report format errors.

2. **Should we cache database credentials?**
   - What we know: Database reads are fast (<10ms with WAL mode)
   - What's unclear: Will repeated reads cause issues in statusLine (called every 60s)?
   - Recommendation: No caching needed. Database reads are fast, and caching adds complexity. Let Phase 04 caching layer handle this if needed.

3. **Exact domain matching vs substring matching for provider detection?**
   - What we know: `hostname.includes('kimi.com')` matches `api.kimi.com`, `kimi.com`, but also `notkimi.com`
   - What's unclear: Should we use stricter matching (e.g., `hostname.endsWith('.kimi.com') || hostname === 'kimi.com'`)?
   - Recommendation: Substring matching is acceptable for this use case. Known providers in controlled environment. If false positives occur, can tighten to regex `/\.?kimi\.com$/i`. Defer to implementation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | 24.14.0 | Bun 1.3.10 |
| Bun | Runtime | ✓ | 1.3.10 | Node.js 24.14.0 |
| SQLite (bun:sqlite) | CC Switch database access | ✓ | Built-in | node:sqlite |
| SQLite (node:sqlite) | CC Switch database access | ✓ | Built-in | bun:sqlite |
| Native URL API | Provider detection | ✓ | Built-in | — |
| os.homedir() | Path expansion | ✓ | Built-in | — |

**Missing dependencies with no fallback:**
- None — all dependencies are built-in to supported runtimes.

**Missing dependencies with fallback:**
- None — primary and fallback runtimes both available.

**Verification:**
```bash
$ node --version
v24.14.0

$ bun --version
1.3.10
```

## Validation Architecture

> nyquist_validation enabled in .planning/config.json. Include this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in) |
| Config file | None — see Wave 0 |
| Quick run command | `bun test test/proxy-*.test.js` |
| Full suite command | `bun test` (runs all tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROXY-01 | Detect localhost in BASE_URL | unit | `bun test test/proxy-detection.test.js::isProxyEnabled` | ❌ Wave 0 |
| PROXY-02 | Open CC Switch database | integration | `bun test test/proxy-database.test.js::openDatabase` | ❌ Wave 0 |
| PROXY-03 | Query providers table | integration | `bun test test/proxy-database.test.js::queryProviders` | ❌ Wave 0 |
| PROXY-04 | Parse settings_config JSON | unit | `bun test test/proxy-database.test.js::parseSettings` | ❌ Wave 0 |
| PROXY-05 | Fail on database errors | unit | `bun test test/proxy-database.test.js::errorHandling` | ❌ Wave 0 |
| PROV-01 | Detect provider from domain | unit | `bun test test/provider-detection.test.js::detectProvider` | ❌ Wave 0 |
| PROV-02 | Fallback to env vars | integration | `bun test test/credentials.test.js::envFallback` | ❌ Wave 0 |
| PROV-03 | Route to correct endpoint | integration | `bun test test/credentials.test.js::routing` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test test/proxy-*.test.js test/provider-*.test.js` (proxy + provider tests only)
- **Per wave merge:** `bun test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/proxy-detection.test.js` — covers PROXY-01 (localhost detection)
- [ ] `test/proxy-database.test.js` — covers PROXY-02, PROXY-03, PROXY-04, PROXY-05 (database extraction)
- [ ] `test/provider-detection.test.js` — covers PROV-01 (domain-based provider detection)
- [ ] `test/credentials.test.js` — covers PROV-02, PROV-03 (unified credential resolution)
- [ ] `tests/conftest.js` — add `createMockDatabase()` helper for CC Switch schema
- [ ] No framework install needed — Bun test runner built-in

**Total Wave 0 tests needed:** ~25-30 test cases across 4 new test files

## Sources

### Primary (HIGH confidence)
- [MDN Web Docs - URL.hostname](https://developer.mozilla.org/en-US/docs/Web/API/URL/hostname) - URL parsing, hostname extraction
- [Node.js docs - os.homedir()](https://nodejs.org/api/os.html#oshomedir) - Cross-platform home directory
- [Phase 01 code](../usage.mjs) - `openDatabase()`, `ConfigError`, established patterns
- [User decisions in CONTEXT.md](./02-CONTEXT.md) - Locked implementation decisions D-01 through D-07

### Secondary (MEDIUM confidence)
- [Claude API TypeScript SDK docs](https://platform.claude.com/docs/en/api/sdks/typescript) - Environment variable patterns
- [Claude Code environment variables](https://support.claude.com/en/articles/12304248-managing-api-key-environment-variables-in-claude-code) - ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL usage

### Tertiary (LOW confidence)
- None — all critical information verified with primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All built-in APIs, well-documented, Phase 01 infrastructure reusable
- Architecture: HIGH — User decisions locked in CONTEXT.md, clear requirements, established patterns from Phase 01
- Pitfalls: HIGH — Common mistakes well-documented, error handling patterns established

**Research date:** 2026-04-01
**Valid until:** 90 days (stable APIs, no external dependencies)
