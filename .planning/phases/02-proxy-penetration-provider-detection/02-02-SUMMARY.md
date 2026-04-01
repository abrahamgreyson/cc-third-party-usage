---
phase: 02-proxy-penetration-provider-detection
plan: 02
subsystem: credential-extraction
tags: [credentials, proxy, database, environment-variables, tdd]
dependency_graph:
  requires:
    - "01-core-infrastructure (error classes, database layer)"
    - "02-01 (proxy detection, provider detection)"
  provides:
    - "getProxyCredentials() - CC Switch database credential extraction"
    - "getEnvCredentials() - Environment variable fallback"
    - "getCredentials() - Unified credential resolution"
  affects:
    - "Phase 03 (API clients will use getCredentials())"
tech_stack:
  added:
    - "Native os.homedir() for cross-platform path expansion"
  patterns:
    - "TDD workflow (RED-GREEN-REFACTOR)"
    - "Fail-fast error handling (ConfigError on all failures)"
    - "Resource cleanup with try-finally (database connections)"
key_files:
  created: []
  modified:
    - path: "usage.mjs"
      changes: "Added CC_SWITCH_DB_PATH, getProxyCredentials(), getEnvCredentials(), getCredentials()"
      exports: ["CC_SWITCH_DB_PATH", "getProxyCredentials", "getEnvCredentials", "getCredentials"]
    - path: "test/proxy-database.test.js"
      changes: "Implemented 10 tests for proxy credential extraction"
    - path: "test/credentials.test.js"
      changes: "Implemented 15 tests for unified credential resolution"
    - path: "tests/conftest.js"
      changes: "Fixed createMockCCSwitchDatabase() to properly load database module"
decisions:
  - id: "D-06"
    choice: "Fail-fast on proxy credential extraction errors"
    rationale: "No fallback to environment variables when proxy detected - user expects database credentials"
  - id: "D-07"
    choice: "Environment variable fallback for non-proxy usage"
    rationale: "Users without CC Switch can use ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN directly"
metrics:
  duration: "401 seconds (~7 minutes)"
  tasks_completed: 3
  files_modified: 4
  tests_added: 25
  test_pass_rate: "100% (25/25)"
  completed_date: "2026-04-01"
---

# Phase 02 Plan 02: Credential Extraction Summary

Implemented credential extraction from CC Switch database and unified credential resolution with environment variable fallback. Enables automatic credential extraction when behind CC Switch proxy, with fallback to environment variables for direct API access.

## What Was Built

### Core Functions (usage.mjs)

**1. expandHomePath(path)**
- Expands `~` in paths to user's home directory using `os.homedir()`
- Cross-platform compatible (macOS, Linux, Windows)
- Supports both `~/` and standalone `~` patterns

**2. getProxyCredentials()**
- Extracts API credentials from CC Switch SQLite database at `~/.cc-switch/cc-switch.db`
- Queries `providers` table for `id='default'`
- Parses `settings_config` JSON to extract `env.ANTHROPIC_AUTH_TOKEN` and `env.ANTHROPIC_BASE_URL`
- Fail-fast error handling with `ConfigError` for all failure cases (database unreadable, JSON parsing fails, required fields missing)
- Automatic database cleanup with try-finally

**3. getEnvCredentials()**
- Reads API key from `ANTHROPIC_API_KEY` environment variable
- Falls back to `ANTHROPIC_AUTH_TOKEN` if `ANTHROPIC_API_KEY` not set
- Throws `ConfigError` with actionable message if neither variable is set

**4. getCredentials()**
- Unified credential resolution entry point
- Routes to `getProxyCredentials()` when CC Switch proxy detected (per D-06, no fallback)
- Routes to `getEnvCredentials()` when no proxy detected (per D-07)
- Returns `{ apiKey, baseUrl?, provider }` structure for downstream API calls

### Test Coverage

**test/proxy-database.test.js (10 tests)**
- Success cases: Extract apiKey and baseUrl from settings_config
- Error handling: ConfigError on database missing, invalid JSON, missing fields
- Verify ConfigError has correct exit code (2) and actionable messages

**test/credentials.test.js (15 tests)**
- Proxy detection: localhost, 127.0.0.1, 0.0.0.0 patterns
- Environment variable fallback: ANTHROPIC_API_KEY with ANTHROPIC_AUTH_TOKEN fallback
- Error handling: ConfigError when no credentials found
- Verify error messages include environment variable names and CC Switch suggestion

**Total: 25 new tests, all passing**

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed following TDD workflow:

1. **Task 1:** expandHomePath() - Already implemented in previous work, tests verified
2. **Task 2:** getProxyCredentials() - Implemented with full test coverage (10 tests)
3. **Task 3:** getEnvCredentials() and getCredentials() - Implemented with full test coverage (15 tests)

## Technical Highlights

### Cross-Platform Path Expansion
Used `os.homedir()` instead of `process.env.HOME` to ensure compatibility across macOS, Linux, and Windows.

### Fail-Fast Error Handling
Per D-06, when proxy is detected, any database error throws `ConfigError` immediately with no fallback to environment variables. This prevents confusing scenarios where users expect proxy credentials but tool silently uses environment variables.

### Resource Cleanup
All database operations use try-finally to ensure connections are closed even on errors, preventing "database is locked" issues on subsequent runs.

### Test Infrastructure Improvement
Fixed `createMockCCSwitchDatabase()` helper in tests/conftest.js to properly load the database module based on runtime (bun:sqlite vs node:sqlite), enabling reliable in-memory database testing.

## Verification

### Test Results
```bash
# Phase 02 Plan 02 tests only
bun test test/proxy-database.test.js test/credentials.test.js
# Result: 25 pass, 0 fail

# Full test suite (regression check)
bun test
# Result: 111 pass, 0 fail (Phase 01: 67, Phase 02: 44)
```

### Requirements Addressed
- **PROXY-02:** Read CC Switch SQLite database at `~/.cc-switch/cc-switch.db`
- **PROXY-03:** Extract real API credentials from `providers` table (`settings_config` JSON field)
- **PROXY-04:** Parse `settings_config` to extract `apiKey` and `baseUrl`
- **PROXY-05:** Fail with clear error if database unreadable or JSON parsing fails
- **PROV-02:** Support environment variable authentication when no proxy detected
- **PROV-03:** Route to correct API endpoint based on detected provider

### Success Criteria Met
- expandHomePath() correctly expands `~` to home directory (cross-platform)
- getProxyCredentials() extracts credentials from CC Switch database (PROXY-02~05)
- getEnvCredentials() reads from environment variables (PROV-02)
- getCredentials() unifies both paths with correct routing (PROV-03)
- Fail-fast behavior: no fallback to env vars when proxy detected (D-06)
- All credential extraction and resolution tests pass (25/25)
- No regressions in Phase 01 tests (111/111 total tests passing)

## Next Steps

Phase 03 will use `getCredentials()` to obtain credentials before making API calls to Kimi and GLM providers. The unified credential resolution enables seamless support for both proxy and direct API access patterns.

## Commits

1. **bb786d1** - feat(02-02): implement CC Switch credential extraction
   - Added getProxyCredentials(), getEnvCredentials(), getCredentials()
   - Fixed createMockCCSwitchDatabase() helper
   - Added 10 tests for proxy credential extraction

2. **aeea7d1** - test(02-02): add tests for unified credential resolution
   - Added 15 tests for getCredentials() and getEnvCredentials()
   - Verified environment variable fallback behavior
   - Verified error handling and ConfigError exit codes

---

**Duration:** 401 seconds (~7 minutes)
**Completed:** 2026-04-01

## Self-Check: PASSED

All files verified:
- usage.mjs ✓
- test/proxy-database.test.js ✓
- test/credentials.test.js ✓
- tests/conftest.js ✓
- 02-02-SUMMARY.md ✓

All commits verified:
- bb786d1 (feat: CC Switch credential extraction) ✓
- aeea7d1 (test: unified credential resolution) ✓

