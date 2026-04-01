# Stack Research

**Domain:** Single-file CLI tool (AI API usage monitoring with SQLite, HTTP, templates)
**Researched:** 2026-03-31
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Native Fetch API** | Built-in (Node 18+, Bun) | HTTP client for API requests | Zero dependencies, built into both runtimes, sufficient performance for CLI use case. Eliminates need for axios/got, keeping tool truly single-file and portable. |
| **bun:sqlite** / **node:sqlite** | Bun 1.3+ / Node 22.5+ | SQLite database access | Both runtimes now have built-in SQLite drivers. `bun:sqlite` is 3-6x faster than `better-sqlite3`. `node:sqlite` (RC since v25.7.0) eliminates native module dependencies. Use conditional import based on runtime detection. |
| **Template Literals** | Native ES6+ | Output formatting | 4x faster than Handlebars, zero dependencies, full JavaScript power for complex formatting. Sufficient for statusLine output and custom templates via `--template` flag. |
| **Commander.js** | 14.0.3 | CLI argument parsing | Minimal (zero dependencies), excellent documentation, widely adopted. Simpler than Yargs for this use case. Supports subcommands, options, and auto-generated help. |
| **Bun** | 1.3.10+ (or Node.js 24.14.0+) | Primary runtime | Bun's single-file executable compilation (`bun build --compile`) creates standalone binaries. Also compatible with Node.js for environments without Bun. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **None required** | — | — | Project requirements emphasize single-file architecture with zero external dependencies beyond built-in APIs |

**Rationale for Zero Dependencies:**
- **Single-file constraint:** External packages complicate distribution and break Bun's `--compile` portability
- **Runtime compatibility:** Built-in APIs (fetch, sqlite, template literals) work identically in Bun and Node.js
- **Performance:** Native APIs outperform third-party alternatives (fetch vs axios, template literals vs handlebars)
- **Maintenance:** No dependency version conflicts or security advisories to track

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Bun** | Runtime + bundler + test runner | Built-in test framework (`bun test`), linter, and bundler. Replaces jest, eslint, webpack/rollup. |
| **VS Code** | Editor | Native TypeScript/JavaScript support, no extensions required |

## Installation

```bash
# No npm dependencies required!
# The tool uses only built-in runtime APIs

# For development (optional):
bun install -g bun  # Ensure Bun 1.3.10+ is available

# Build single-file executable:
bun build usage.mjs --compile --outfile usage
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Native Fetch** | Axios | Complex apps needing interceptors, automatic transforms, or better error handling on HTTP errors |
| **Native Fetch** | Got | Node.js-only applications requiring pagination, streams, or retry logic |
| **Native Fetch** | Undici | High-throughput applications where 65% lower latency is critical (overkill for CLI) |
| **Template Literals** | Handlebars 4.7.9 | Complex template reuse, email templates, or when logic-less templates are preferred |
| **Template Literals** | EJS 5.0.1 | Teams familiar with PHP/JSP-style templating |
| **Commander.js** | Yargs 18.0.0 | Complex CLIs requiring extensive validation, interactive prompts, or built-in coercion |
| **bun:sqlite** | better-sqlite3 | Node.js-only environments (but slower and requires native compilation) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **axios** | Adds 5-13KB bundle size, requires dependency management, breaks single-file compilation | Native Fetch API |
| **got** | Adds ~50KB, requires dependencies, over-engineered for simple API queries | Native Fetch API |
| **better-sqlite3 / sqlite3** | Requires native compilation, breaks Bun `--compile`, adds dependency complexity | `bun:sqlite` / `node:sqlite` |
| **Handlebars / EJS** | Adds 100-200KB, slower than template literals, overkill for statusLine formatting | Template Literals |
| **Undici** | Adds ~200KB, requires dependency, performance gains unnecessary for CLI use case | Native Fetch API |
| **Multiple npm packages** | Violates single-file constraint, complicates distribution, breaks runtime portability | Built-in runtime APIs |

## Stack Patterns by Variant

**If targeting Bun-only:**
- Use `bun:sqlite` directly (fastest SQLite driver)
- Use `bun build --compile` for distribution
- Leverage Bun's built-in test runner and bundler

**If targeting Node.js-only:**
- Use `node:sqlite` (requires Node 22.5.0+, stable in v25.7.0+)
- Ensure Node.js 24+ for native fetch support
- Distribute as `.mjs` file (no compilation needed)

**If targeting both Bun and Node.js (recommended):**
```javascript
// Runtime-conditional SQLite import
const db = process.isBun
  ? new (await import('bun:sqlite')).Database(path)
  : new (await import('node:sqlite')).DatabaseSync(path);

// Native fetch works identically in both
const response = await fetch(url, options);

// Template literals work identically in both
const output = `${data.used}/${data.total} (${data.percent}%)`;
```

## Version Compatibility

| Runtime | Minimum Version | SQLite Module | Native Fetch | Notes |
|---------|----------------|---------------|--------------|-------|
| **Bun** | 1.3.10+ | `bun:sqlite` | ✅ Built-in | Recommended for single-file compilation |
| **Node.js** | 22.5.0+ | `node:sqlite` | ✅ Built-in | SQLite RC since v25.7.0 |
| **Node.js** | 18.0.0+ | ❌ Requires better-sqlite3 | ✅ Built-in | Native SQLite not available |

**Critical:** Node.js 22.5.0+ is required for built-in SQLite. For broader compatibility, use Bun (includes SQLite from v1.0+).

## Performance Characteristics

| Component | Performance | Notes |
|-----------|-------------|-------|
| **bun:sqlite** | 3-6x faster than better-sqlite3 | Bun's native implementation, benchmarks show 8-9x faster than Deno SQLite |
| **node:sqlite** | Comparable to better-sqlite3 | Synchronous API, no async overhead |
| **Native Fetch** | Slightly slower than Undici, faster than Axios | Sufficient for CLI use case (API calls complete in <2s) |
| **Template Literals** | 4x faster than Handlebars | Native JS engine optimization, no parsing overhead |

## Sources

- **Context7 / Official Documentation:**
  - Bun SQLite API: https://bun.com/docs/api/sqlite — Performance benchmarks, API reference (HIGH confidence)
  - Node.js SQLite Module: https://nodejs.org/api/sqlite.html — Official docs, RC status since v25.7.0 (HIGH confidence)
  - Bun Single-File Executables: https://bun.com/docs/bundler/executables — Compilation guide (HIGH confidence)

- **Performance & Comparisons:**
  - Fetch vs Axios vs Undici: [LogRocket 2025 Comparison](https://blog.logrocket.com/axios-vs-fetch-2025/) — Feature and performance analysis (MEDIUM confidence, verified with official docs)
  - Template Literals vs Handlebars: [Performance Benchmarks](https://www.codeblocq.com/2016/05/Performance-Comparison-ES6-Template-Literals-vs-HandleBars-in-Node/) — Shows 4x performance advantage (MEDIUM confidence, older benchmark but still relevant)
  - Undici Performance: [Why Undici is Faster](https://dev.to/alex_aslam/why-undici-is-faster-than-nodejss-core-http-module-and-when-to-switch-1cjf) — 65% lower latency claims (MEDIUM confidence)

- **CLI Libraries:**
  - Commander vs Yargs: [PkgPulse 2026 Comparison](https://www.pkgpulse.com/blog/commander-vs-yargs-2026) — Commander is minimal and zero-dependency (HIGH confidence)
  - Commander.js v14.0.3: Verified via `npm view commander version` (HIGH confidence)
  - Yargs v18.0.0: Verified via `npm view yargs version` (HIGH confidence)

- **Node.js SQLite:**
  - Node.js v25.7.0 RC Announcement: [GitHub Issue #57445](https://github.com/nodejs/node/issues/57445) — Removes need for native modules (HIGH confidence)
  - Node.js SQLite Guide: [LogRocket Tutorial](https://blog.logrocket.com/using-built-in-sqlite-module-node-js/) — Practical implementation guide (MEDIUM confidence)

- **Bun Features:**
  - Bun 1.3 Release: https://bun.com/blog/bun-v1.3 — Bundler improvements, cross-compilation support (HIGH confidence)
  - Awesome Bun: [GitHub Collection](https://github.com/oven-sh/awesome-bun) — Community resources (MEDIUM confidence)

---
*Stack research for: Single-file CLI tool with SQLite, HTTP, and template capabilities*
*Researched: 2026-03-31*
