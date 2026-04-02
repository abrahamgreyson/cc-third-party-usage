---
phase: 05-cli-interface-output-formatting
plan: 02
subsystem: cli
tags: [commander, template-engine, statusline, verbose, stdout-stderr]

# Dependency graph
requires:
  - phase: 05-cli-interface-output-formatting
    provides: "Multi-window parsers, formatCompactTime, getCachedUsageData with diagnostics, nested data structure"
provides:
  - "CLI entry point with Commander.js (--json, --template, --verbose, --cache-duration, --version)"
  - "buildPlaceholderValues for flat lookup from nested quotas"
  - "applyTemplate for {key} placeholder substitution"
  - "formatDefaultOutput for statusLine display with shortest reset window"
  - "outputVerboseInfo for [debug] prefixed stderr diagnostics"
  - "Dual-mode detection: CLI when run directly, module when imported"
  - "stdout/stderr separation: data to stdout, errors/debug to stderr"
affects: [cli, output-formatting, statusline]

# Tech tracking
tech-stack:
  added: [commander]
  patterns: [template-substitution, window-prefixed-keys, shortest-reset-selection, dual-mode-entry-point]

key-files:
  created: []
  modified:
    - usage.mjs
    - tests/05-cli-interface.test.js

key-decisions:
  - "exitOverride() on Commander.js for testability, with CommanderError catch for clean --help/--version exits"
  - "Shortest reset_timestamp selection for formatDefaultOutput (most urgent window)"
  - "formatCompactTime used in formatDefaultOutput, not Chinese reset_display field"
  - "Null quota values become empty string in buildPlaceholderValues"

patterns-established:
  - "Template engine: regex-based {key} substitution with unknown placeholder passthrough"
  - "Verbose pattern: [debug] prefixed lines to stderr, three sections (Cache/Provider/API)"
  - "Dual-mode: isMainModule check using process.argv[1] inclusion test"

requirements-completed: [OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07]

# Metrics
duration: 13min
completed: 2026-04-02
---

# Phase 5 Plan 2: CLI Interface and Output Formatting Summary

**Commander.js CLI with template engine, statusLine formatter, verbose diagnostics, and stdout/stderr separation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-02T06:25:29Z
- **Completed:** 2026-04-02T06:38:35Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Complete CLI tool with all output modes: default statusLine, JSON, custom template, verbose
- Template engine with {key} substitution supporting window-prefixed placeholders and unknown passthrough
- formatDefaultOutput selects shortest reset window and uses compact time format
- Verbose mode outputs [debug] diagnostics to stderr alongside data to stdout
- Dual-mode entry point: CLI when run directly, clean module import without side effects

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Output formatters and CLI tests** - `21adb0a` (test)
2. **Task 1 GREEN: Implement formatters and CLI** - `70ed5f1` (feat)

_Note: TDD task with RED (failing tests) and GREEN (implementation) commits._

## Files Created/Modified
- `usage.mjs` - Added Commander.js import, buildPlaceholderValues, applyTemplate, formatDefaultOutput, verboseLog, outputVerboseInfo, runCLI, dual-mode entry point, CommanderError handling
- `tests/05-cli-interface.test.js` - Converted 19 test.todo() stubs to real tests across 7 describe blocks (buildPlaceholderValues, applyTemplate, formatDefaultOutput, outputVerboseInfo, runCLI, stdout/stderr separation)

## Decisions Made
- Used exitOverride() on Commander.js program for testability, with custom catch for CommanderError to ensure --help and --version exit cleanly with code 0
- Shortest reset_timestamp selection for formatDefaultOutput ensures the most urgent quota window is shown in statusLine
- formatCompactTime used in formatDefaultOutput rather than the Chinese reset_display field, producing compact "2h30m" format suitable for statusLine
- Null/undefined quota values become empty string in buildPlaceholderValues for clean template output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CommanderError on --help/--version causing exit code 1**
- **Found during:** Task 1 (CLI implementation)
- **Issue:** exitOverride() makes Commander throw instead of calling process.exit(). --help and --version threw errors caught by handleError, producing "Unexpected error" messages and exit code 1
- **Fix:** Added CommanderError detection in the catch handler, checking for commander.version, commander.help, and commander.helpDisplayed error codes, exiting cleanly with code 0
- **Files modified:** usage.mjs
- **Verification:** `node usage.mjs --version` outputs "usage.mjs v1.0.0" exit code 0; `node usage.mjs --help` outputs help text exit code 0
- **Committed in:** 70ed5f1 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- fix was necessary for correct CLI behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 05 complete -- all 12 requirements (OUT-01~05, CLI-01~07) satisfied
- CLI tool works end-to-end: node usage.mjs shows statusLine format, --json outputs valid JSON, --template supports custom format, --verbose shows debug info
- 41 Phase 05 tests pass, 221 total tests pass (2 pre-existing integration test failures out of scope)
- Project milestone v1.0 ready for `/gsd:complete-milestone`

---
*Phase: 05-cli-interface-output-formatting*
*Completed: 2026-04-02*

## Self-Check: PASSED

- FOUND: usage.mjs
- FOUND: tests/05-cli-interface.test.js
- FOUND: 05-02-SUMMARY.md
- FOUND: 21adb0a (RED commit)
- FOUND: 70ed5f1 (GREEN commit)
