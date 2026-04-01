# Phase 1: Core Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
 Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.
 **Date:** 2026-04-01
**Phase:** 01-core-infrastructure
**Areas discussed:** Runtime detection, HTTP retry, error handling, code organization
---
## Runtime Detection strategy
| Option | Description | Selected |
|--------|-------------|----------|
| process.versions.bun 检测 | Feature detection, 简洁标准 | ✓ |
| Dynamic import + try/catch | Mixed import styles, fallback to env vars | |
| Process.isBun (Bun-specific) | | |
| globalThis.Bun (feature detection) | | |
| Separated db.js module | Abstract into db.js, internal handling all runtime differences, main file cleaner | |

**User's choice:** process.versions.bun 检测
**Notes:** 简洁标准,Node.js 会回退到 env vars

---
## HTTP retry strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Exponential backoff: 1s → 2s → 4s → 8s | ✓ |
| Fixed interval: every 2s | |
| Fast backoff: 500ms → 1s → 2s → 4s | |
| No retry | - | | ✓ |

| 3 毁 | 1s, 2s, 4s, 8s | ✓ |
| 5xx, 429, network errors | | ✓ |
| 400/401/403/404 (client errors) | | ✓ |

**User's choice:** Exponential backoff
**Notes:** Initial 1s, then double each time (2s), max 3 retries. 4xx client errors fail immediately.
---
## Error handling pattern
| Option | Description | Selected |
|--------|-------------|----------|
| Custom Error classes | UsageError, ConfigError, APIError, etc. with code, message, details | ✓ |
| Simple JSON object | { success: false, error: string, code: number } | |
| pure console.error | Only console.error + process.exit(code) | |

**User's choice:** custom Error classes
**Notes:** Clean structure, typed errors can catch/handle by exit codes
---
## Exit code mapping
| Code | Meaning | selected |
|------|---------|----------|
| 0 | Success | ✓ |
| 1 | General error | ✓ |
| 2 | Config error | ✓ |
| 3 | Network error | ✓ |
| 4 | API error | ✓ |

**User's choice:** semantic exit codes
**Notes:** Standard Unix conventions
---
## Error message style
| Option | Description | Selected |
|--------|-------------|----------|
| Concise + actionable suggestion | "CC Switch database not found. Run cc-switch init first" | ✓ |
| Detailed + stack trace | Full error details with stack trace (dev mode) | |
| Minimal | Short error only | |

**User's choice:** Concise + actionable suggestions
**Notes:** Clear, user-friendly, follow Unix CLI conventions
---
## Code organization
| Option | Description | Selected |
|--------|-------------|----------|
| Bottom-up (dependencies first) | Error classes → Utils → SQLite → HTTP → Main logic | ✓ |
| Top-down (main logic first) | Main logic → Error classes → Utils → SQLite → HTTP (requires forward refs) | |
| By domain | Group by feature area (auth module, cache module, API module) | |

**User's choice:** Bottom-up
**Notes:** Clean dependency graph, easier to read
---
## Comment style
| Option | Description | Selected |
|--------|-------------|----------|
| Section separators + JSDoc | `///// Section /////` separators + JSDoc for key functions | ✓ |
| Full JSDoc | Every function has detailed @param, @returns, @throws | |
| Minimal | Code is self-documenting, complex logic only | |

**User's choice:** Section separators + JSDoc
**Notes:** Balanced clarity without verbosity
---
## Claude's Discretion
- Runtime detection approach (conditional import style)
- SQLite WAL mode configuration
- Specific utility functions for error messages
- Exact exit code mapping (detailed above)
- Code organization structure (if splitting into modules in the future)

