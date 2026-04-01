---
phase: 03
slug: api-integration-&-data-normalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in) |
| **Config file** | None — see Wave 0 |
| **Quick run command** | `bun test tests/03-api-integration.test.js` |
| **Full suite command** | `bun test` (runs all tests) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/03-api-integration.test.js`
- **After every plan wave:** Run `bun test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | API-01 | integration | `bun test tests/03-api-integration.test.js::testKimiAPIQuery` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | API-02 | integration | `bun test tests/03-api-integration.test.js::testGLMAPIQuery` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | API-03 | unit | `bun test tests/03-api-integration.test.js::testKimiParser` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | API-04 | unit | `bun test tests/03-api-integration.test.js::testGLMParser` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | API-05 | unit | `bun test tests/03-api-integration.test.js::testAPIErrors` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | NORM-01 | unit | `bun test tests/03-api-integration.test.js::testNormalizeData` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | NORM-02 | unit | `bun test tests/03-api-integration.test.js::testPercentageCalc` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | NORM-03 | unit | `bun test tests/03-api-integration.test.js::testTimeFormatting` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 2 | NORM-04 | unit | `bun test tests/03-api-integration.test.js::testTimestampDetection` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/03-api-integration.test.js` — stubs for API-01~05, NORM-01~04
- [ ] `tests/conftest.js` — shared fixtures for mock API responses
- [ ] Mock API server setup for integration tests (optional, or use recorded responses)

**Test coverage strategy:**
- Unit tests for parsers (validate field extraction, error cases)
- Unit tests for normalizers (timestamp detection, percentage calc, edge cases)
- Integration tests for full query flow (mock HTTP responses with realistic data)
- Error scenario tests (401, 429, 5xx, malformed JSON, missing fields)

---

## Manual Verification Requirements

None — All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
