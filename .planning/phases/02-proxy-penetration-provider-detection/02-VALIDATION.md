---
phase: 02
slug: proxy-penetration-provider-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (built-in) |
| **Config file** | None — see Wave 0 |
| **Quick run command** | `bun test test/proxy-*.test.js test/provider-*.test.js` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test test/proxy-*.test.js test/provider-*.test.js`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROXY-01 | unit | `bun test test/proxy-detection.test.js::isProxyEnabled` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | PROXY-02 | integration | `bun test test/proxy-database.test.js::openDatabase` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | PROXY-03 | integration | `bun test test/proxy-database.test.js::queryProviders` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | PROXY-04 | unit | `bun test test/proxy-database.test.js::parseSettings` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | PROXY-05 | unit | `bun test test/proxy-database.test.js::errorHandling` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | PROV-01 | unit | `bun test test/provider-detection.test.js::detectProvider` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | PROV-02 | integration | `bun test test/credentials.test.js::envFallback` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | PROV-03 | integration | `bun test test/credentials.test.js::routing` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/proxy-detection.test.js` — stubs for PROXY-01 (localhost detection)
- [ ] `test/proxy-database.test.js` — stubs for PROXY-02~05 (database extraction)
- [ ] `test/provider-detection.test.js` — stubs for PROV-01 (domain-based provider detection)
- [ ] `test/credentials.test.js` — stubs for PROV-02~03 (unified credential resolution)
- [ ] `test/conftest.js` — add `createMockDatabase()` helper for CC Switch schema
- [x] Framework already installed — Bun test runner built-in

*Total Wave 0 tests needed: ~25-30 test cases across 4 new test files*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
