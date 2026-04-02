---
phase: 05
slug: cli-interface-output-formatting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test runner (`bun:test`) |
| **Config file** | none — Bun auto-discovers `*.test.js` |
| **Quick run command** | `bun test tests/05-cli-interface.test.js` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test tests/05-cli-interface.test.js`
- **After every plan wave:** Run `bun test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-00-01 | 00 | 0 | all | stub | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |
| 05-01-01 | 01 | 1 | OUT-01 | unit | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | OUT-02, OUT-04 | unit | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | OUT-03 | unit | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CLI-01~07 | unit | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | OUT-05 | integration | `bun test tests/05-cli-interface.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/05-cli-interface.test.js` — stubs for OUT-01~05, CLI-01~07
- [ ] `npm install commander@14.0.3` — Commander.js not yet installed
- [ ] `package.json` creation — required for Commander.js ESM resolution

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| StatusLine display in Claude Code | OUT-01 | Requires live Claude Code integration | Run `usage.mjs` and verify output appears in statusLine |
| Help text formatting in terminal | CLI-06 | Visual verification of terminal output | Run `usage.mjs --help` and verify layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
