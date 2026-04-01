---
phase: 01
slug: core-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-01
wave_0_completed: 2026-04-01
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun built-in test runner |
| **Config file** | None — see Wave 0 |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CORE-01 | unit | `bun test test/runtime-detection.test.js` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CORE-02 | unit | `bun test test/runtime-detection.test.js` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CORE-03 | unit | `bun test test/error-handling.test.js` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CORE-04 | unit | `bun test test/error-handling.test.js` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | DB-01 | integration | `bun test test/database-bun.test.js` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | DB-02 | integration | `bun test test/database-node.test.js` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | DB-03 | unit | `bun test test/runtime-detection.test.js` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | DB-04 | integration | `bun test test/database-wal.test.js` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 1 | DB-05 | integration | `bun test test/database-busy-timeout.test.js` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | HTTP-01 | unit | `bun test test/http-client.test.js` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | HTTP-02 | unit | `bun test test/http-timeout.test.js` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 1 | HTTP-03 | unit | `bun test test/http-retry.test.js` | ❌ W0 | ⬜ pending |
| 01-03-04 | 03 | 1 | HTTP-04 | unit | `bun test test/http-rate-limit.test.js` | ❌ W0 | ⬜ pending |
| 01-03-05 | 03 | 1 | HTTP-05 | unit | `bun test test/http-error-messages.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/runtime-detection.test.js` - stubs for CORE-01, CORE-02, DB-03
- [x] `test/error-handling.test.js` - stubs for CORE-03, CORE-04
- [x] `test/database-bun.test.js` - stubs for DB-01
- [x] `test/database-node.test.js` - stubs for DB-02
- [x] `test/database-wal.test.js` - stubs for DB-04
- [x] `test/database-busy-timeout.test.js` - stubs for DB-05
- [x] `test/http-client.test.js` - stubs for HTTP-01
- [x] `test/http-timeout.test.js` - stubs for HTTP-02
- [x] `test/http-retry.test.js` - stubs for HTTP-03
- [x] `test/http-rate-limit.test.js` - stubs for HTTP-04
- [x] `test/http-error-messages.test.js` - stubs for HTTP-05
- [x] `tests/conftest.js` - shared fixtures (test database setup, mock fetch)
- [x] Framework install: `bun test` is built-in, no install required

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | All phase behaviors have automated verification |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter
