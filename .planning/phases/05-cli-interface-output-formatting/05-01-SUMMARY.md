---
phase: 05-cli-interface-output-formatting
plan: 01
subsystem: api, parsing, output-formatting
tags: [parser, multi-window, compact-time, diagnostics, cache, statusline]

# Dependency graph
requires:
  - phase: 05-cli-interface-output-formatting/00
    provides: Test infrastructure and stubs for CLI/output functions
provides:
  - Multi-window parser functions (parseKimiResponse, parseGLMResponse) returning { quotas: [...] }
  - Updated normalizeUsageData returning nested { provider, quotas, fetchedAt } structure
  - Updated getCachedUsageData returning { data, diagnostics } with cache/API metadata
  - formatCompactTime function for statusLine display
  - Fixed normalizeResetTime millisecond timestamp handling (GLM >1e12 heuristic)
affects: [cli-interface, output-formatting, verbose-output]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-window-quotas, diagnostic-metadata, compact-time-format]

key-files:
  created: []
  modified:
    - usage.mjs
    - tests/05-cli-interface.test.js
    - tests/03-api-integration.test.js
    - tests/04-caching-layer.test.js

key-decisions:
  - "Heuristic >1e12 for millisecond detection in normalizeResetTime (GLM gives 13-digit ms, Kimi gives seconds or ISO strings)"
  - "Quota window labels: Kimi duration/60 => '5h', GLM TIME_LIMIT unit=5/number=1 => '5h', TOKENS_LIMIT unit=3/number=5 => 'weekly'"
  - "Diagnostics object returned alongside data from getCachedUsageData for Plan 02 verbose output"

patterns-established:
  - "Quotas array pattern: all parsers return { quotas: [...] } with entries containing window, type, total, used, remaining, percent, reset_display, reset_timestamp"
  - "Diagnostic metadata pattern: getCachedUsageData returns { data, diagnostics } where diagnostics tracks cacheStatus, apiDuration, providerSource etc."

requirements-completed: [OUT-01, OUT-04, CLI-01, CLI-02]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 05 Plan 01: Multi-Window Parsers & Compact Time Formatter Summary

**Multi-window parsers capturing all Kimi/GLM quota windows, nested data pipeline with diagnostic metadata, and compact time formatter for statusLine display**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T06:12:27Z
- **Completed:** 2026-04-02T06:18:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Rewrote parseKimiResponse to capture both `response.usage` (overall window) and all `response.limits[]` entries instead of only `limits[0]`
- Rewrote parseGLMResponse to capture ALL limit types (TIME_LIMIT + TOKENS_LIMIT) instead of only TIME_LIMIT
- Added formatCompactTime for statusLine-compatible compact time display (e.g., "2h30m", "3d12h")
- Fixed normalizeResetTime millisecond timestamp bug -- GLM 13-digit timestamps (>1e12) no longer produce year-56000 dates
- Updated data pipeline (normalizeUsageData, getCachedUsageData) to use nested { provider, quotas, fetchedAt } structure
- Added diagnostic metadata to getCachedUsageData return value for Plan 02 verbose output

## Task Commits

Each task was committed atomically:

1. **Task 1: formatCompactTime + normalizeResetTime ms fix** - `38ddec1` (test), `bcd3943` (feat)
2. **Task 2: Multi-window parsers + data pipeline + diagnostics** - `5dd08a1` (test), `62309b9` (feat)

_Note: TDD tasks have test-then-implementation commits_

## Files Created/Modified
- `usage.mjs` - Multi-window parsers, updated normalizer, compact time formatter, diagnostic metadata in cache layer
- `tests/05-cli-interface.test.js` - 20 passing tests covering formatCompactTime, normalizeResetTime ms fix, multi-window parsers, nested normalizeUsageData, cache diagnostics
- `tests/03-api-integration.test.js` - Updated parser tests to match new { quotas: [...] } return format
- `tests/04-caching-layer.test.js` - Updated cache tests to match new nested format and { data, diagnostics } return

## Decisions Made
- GLM millisecond detection uses >1e12 heuristic (13-digit GLM timestamps exceed this threshold, 10-digit second timestamps do not)
- Quota window labels are derived from API-specific fields: Kimi `duration/60` hours, GLM `type+unit+number` combinations
- Diagnostic metadata collected alongside data enables verbose output in Plan 02 without re-fetching

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated tests in 03-api-integration.test.js for new parser signatures**
- **Found during:** Task 2 (multi-window parsers)
- **Issue:** Old tests expected `result.used`, `result.total`, `result.reset` but parsers now return `{ quotas: [...] }`. Old validation tests (used/total/reset missing) no longer relevant since parsers use different field names
- **Fix:** Rewrote 7 tests to match new parser signatures and validate new behavior (multi-window extraction, missing field defaults, window label derivation)
- **Files modified:** tests/03-api-integration.test.js
- **Verification:** `bun test tests/03-api-integration.test.js` -- 46 pass, 2 fail (pre-existing integration tests)
- **Committed in:** 62309b9 (part of Task 2 commit)

**2. [Rule 2 - Missing Critical] Updated tests in 04-caching-layer.test.js for new cache format**
- **Found during:** Task 2 (data pipeline update)
- **Issue:** Cache tests used flat `{ total, used, remaining, percent }` format but getCachedUsageData now returns `{ data, diagnostics }` with nested quotas
- **Fix:** Updated cache test fixtures to nested format and destructured return values
- **Files modified:** tests/04-caching-layer.test.js
- **Verification:** `bun test tests/04-caching-layer.test.js` -- 23 pass, 0 fail
- **Committed in:** 62309b9 (part of Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical test updates for changed signatures)
**Impact on plan:** Both auto-fixes necessary for correctness. Parser signature changes inherently require test updates. No scope creep.

## Issues Encountered
- Previous executor left Task 2 changes uncommitted -- required careful analysis of committed vs. uncommitted state before committing

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data pipeline functions now return nested format ready for output formatters
- getCachedUsageData returns diagnostics object ready for Plan 02 verbose output
- formatCompactTime ready for use in formatDefaultOutput
- 19 test.todo() stubs in tests/05-cli-interface.test.js ready for Plan 02 (buildPlaceholderValues, applyTemplate, formatDefaultOutput, outputVerboseInfo, runCLI)

## Known Stubs
- 19 test.todo() entries in tests/05-cli-interface.test.js for Plan 02 functions (buildPlaceholderValues, applyTemplate, formatDefaultOutput, outputVerboseInfo, runCLI, stdout/stderr separation) -- intentionally deferred to Plan 02

## Self-Check: PASSED

- All 4 modified files verified present
- All 4 commit hashes verified present (38ddec1, bcd3943, 5dd08a1, 62309b9)
- Test suite: 200 pass, 19 todo, 2 fail (pre-existing integration tests)

---
*Phase: 05-cli-interface-output-formatting*
*Completed: 2026-04-02*
