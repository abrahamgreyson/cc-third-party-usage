<!-- GSD:project-start source:PROJECT.md -->
## Project

**AI API Usage Monitor**

A high-performance single-file CLI tool (`usage.mjs`) that queries Kimi and GLM API usage with intelligent CC Switch proxy detection. Primarily designed for Claude Code statusLine integration to display real-time usage monitoring, while also supporting manual queries and automated monitoring scenarios.

**Core Value:** Seamlessly surface AI API usage data even when behind CC Switch proxy, with zero-configuration auto-detection and cache-optimized for frequent status bar refreshes.

### Constraints

- **Single File:** Must be implemented as `usage.mjs` (ESM format) — no multi-file architectures
- **Runtime Compatibility:** Must work identically on Bun and Node.js without transpilation
- **Performance:** StatusLine invocations must complete within 2 seconds (cache helps)
- **SQLite Access:** Use Bun's built-in `bun:sqlite` or Node's `node:sqlite` (no external dependencies)
- **Error Handling:** Failed CC Switch penetration must exit with error (no silent fallback)
- **Cache Duration:** Default 60 seconds, user-configurable via CLI flag
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
# No npm dependencies required!
# The tool uses only built-in runtime APIs
# For development (optional):
# Build single-file executable:
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
- Use `bun:sqlite` directly (fastest SQLite driver)
- Use `bun build --compile` for distribution
- Leverage Bun's built-in test runner and bundler
- Use `node:sqlite` (requires Node 22.5.0+, stable in v25.7.0+)
- Ensure Node.js 24+ for native fetch support
- Distribute as `.mjs` file (no compilation needed)
## Version Compatibility
| Runtime | Minimum Version | SQLite Module | Native Fetch | Notes |
|---------|----------------|---------------|--------------|-------|
| **Bun** | 1.3.10+ | `bun:sqlite` | ✅ Built-in | Recommended for single-file compilation |
| **Node.js** | 22.5.0+ | `node:sqlite` | ✅ Built-in | SQLite RC since v25.7.0 |
| **Node.js** | 18.0.0+ | ❌ Requires better-sqlite3 | ✅ Built-in | Native SQLite not available |
## Performance Characteristics
| Component | Performance | Notes |
|-----------|-------------|-------|
| **bun:sqlite** | 3-6x faster than better-sqlite3 | Bun's native implementation, benchmarks show 8-9x faster than Deno SQLite |
| **node:sqlite** | Comparable to better-sqlite3 | Synchronous API, no async overhead |
| **Native Fetch** | Slightly slower than Undici, faster than Axios | Sufficient for CLI use case (API calls complete in <2s) |
| **Template Literals** | 4x faster than Handlebars | Native JS engine optimization, no parsing overhead |
## Sources
- **Context7 / Official Documentation:**
- **Performance & Comparisons:**
- **CLI Libraries:**
- **Node.js SQLite:**
- **Bun Features:**
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
