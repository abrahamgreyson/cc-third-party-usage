# Project Research Summary

**Project:** cc-third-party-usage
**Domain:** Single-file CLI tool for AI API usage monitoring with SQLite, HTTP, and caching
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

This is a single-file CLI tool that monitors AI API usage (Kimi and GLM providers) by penetrating the CC Switch proxy to extract real credentials from SQLite, then fetching usage data with intelligent caching for statusLine integration. Experts build such tools using layered architecture (CLI → Coordination → Service → Infrastructure) with zero external dependencies, relying exclusively on built-in runtime APIs (native fetch, bun:sqlite/node:sqlite, template literals) to maintain single-file portability.

The recommended approach is to build a cross-runtime compatible ESM file using conditional SQLite imports based on runtime detection, implementing cache-first data fetching with atomic file writes, and supporting template-based output formatting for flexible statusLine integration. The tool should use fail-fast error handling with clear user-facing messages and semantic exit codes.

Key risks include SQLite module incompatibility between Bun and Node.js (mitigated by runtime-conditional imports), database locking under concurrent access (mitigated by WAL mode and busy_timeout configuration), JSON cache race conditions (mitigated by atomic write operations), and process exit before async completion (mitigated by avoiding process.exit() and using natural exit with process.exitCode). Cross-runtime testing from day one is essential.

## Key Findings

### Recommended Stack

Use only built-in runtime APIs with zero external npm dependencies to maintain single-file portability. Both Bun 1.3.10+ and Node.js 22.5+ provide native SQLite modules and fetch API, making third-party packages unnecessary. The only acceptable external package is Commander.js 14.0.3 for CLI argument parsing due to its minimal footprint and zero-dependency architecture.

**Core technologies:**
- **Native Fetch API** (Node 18+, Bun built-in) — HTTP client for API requests; zero dependencies, built into both runtimes, eliminates need for axios/got
- **bun:sqlite / node:sqlite** (Bun 1.3+ / Node 22.5+) — SQLite database access; use conditional import based on runtime detection, bun:sqlite is 3-6x faster
- **Template Literals** (ES6+) — Output formatting; 4x faster than Handlebars, zero dependencies, sufficient for statusLine and custom templates
- **Commander.js 14.0.3** — CLI argument parsing; minimal (zero dependencies), widely adopted, supports auto-generated help

### Expected Features

**Must have (table stakes):**
- **Basic usage query** — Single command to fetch and display usage data from Kimi/GLM APIs
- **Output formatting (JSON/text)** — StatusLine integration requires concise text; scripts need JSON
- **Cache mechanism (60s default)** — Frequent statusLine refreshes shouldn't hammer APIs, balance freshness and rate limits
- **Provider detection** — Auto-detect which API to query based on baseUrl domain (kimi.com, bigmodel.cn)
- **Cross-runtime compatibility** — Single-file ESM that works on both Bun and Node.js without transpilation
- **Error handling with clear messages** — Actionable feedback when queries fail, semantic exit codes

**Should have (competitive):**
- **Proxy penetration (CC Switch detection)** — Unique differentiator: automatically extracts real credentials from proxy SQLite database
- **Template-based output (`--template` flag)** — Custom output formats without code changes, enables statusLine-specific formatting
- **Multi-provider normalization** — Unified interface across Kimi, GLM, future providers — all return same data structure
- **Single-file distribution** — Zero-install: download one file and run (Bun `--compile` support)
- **SQLite credential extraction** — Direct database access for proxy configuration without external SQLite dependencies
- **Graceful degradation** — Returns cached data on API failure with staleness indicator instead of hard failure

**Defer (v2+):**
- **Additional providers beyond Kimi/GLM** — Not essential for launch, validate core use case first
- **Configuration file support (YAML/JSON)** — Environment variables sufficient for v1
- **Usage history export (CSV/JSON)** — External tools can parse JSON output for historical tracking
- **Watch mode (continuous monitoring)** — StatusLine polling is sufficient for current use case

### Architecture Approach

Organize code in a single ESM file using layered architecture with clear boundaries: CLI Interface Layer (argument parsing, output formatting) → Coordination Layer (main orchestration, control flow) → Service Layer (provider detection, cache management, proxy penetration) → Infrastructure Layer (database access, HTTP client, file I/O). Dependencies flow downward only, enabling bottom-up testing and clear separation of concerns.

**Major components:**
1. **Infrastructure Layer** (lines 250-450) — Database access (SQLite queries), HTTP client wrapper with retry logic, file I/O operations for cache
2. **Service Layer** (lines 450-700) — Provider detection logic, cache management (read/write/validate with TTL), proxy penetration (credential extraction), API response normalization
3. **Coordination Layer** (lines 700-850) — Main orchestration function, flow control (detect → penetrate → fetch → cache → output), error handling and propagation
4. **CLI Interface Layer** (lines 850-1000) — Argument parsing (Commander.js), output formatting (concise/template), error display and exit codes

### Critical Pitfalls

1. **SQLite Module Incompatibility Between Runtimes** — Bun uses `bun:sqlite` while Node.js uses `node:sqlite`, and they're not interchangeable. Avoid with runtime-conditional imports: `const sqlite = process.isBun ? await import('bun:sqlite') : await import('node:sqlite');`

2. **SQLite Database Locking Under Concurrent Access** — Multiple CLI invocations can cause "SQLITE_BUSY" errors when accessing CC Switch database simultaneously. Avoid by enabling WAL mode (`PRAGMA journal_mode = WAL;`), setting busy_timeout to 30+ seconds, and using IMMEDIATE transactions for writes.

3. **JSON Cache Race Conditions** — Multiple invocations reading/writing cache simultaneously can corrupt data. Avoid by using atomic file operations: write to temporary file first, then rename (atomic on Unix systems).

4. **Process Exit Before Async Operations Complete** — Using `process.exit()` immediately terminates the process, cutting off pending operations. Avoid by never using `process.exit()` in normal flow; use `process.exitCode = 1` instead to set exit code without forcing immediate exit.

5. **HTTP API Timeout Configuration Mistakes** — CLI hangs indefinitely or times out too quickly. Avoid by always setting timeouts (connection + read), using exponential backoff for retries, respecting Retry-After headers, and not retrying 4xx errors (except 429).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Infrastructure
**Rationale:** Foundation layer must be established first — all other layers depend on infrastructure (database, HTTP, file I/O). Must handle cross-runtime compatibility from day one to avoid costly refactoring.
**Delivers:** Runtime-abstracted SQLite access, HTTP client with retry/timeout, atomic cache operations, error handling framework with exit codes
**Addresses:** Basic usage query, SQLite credential extraction, Cache mechanism, Error handling
**Avoids:** SQLite module incompatibility, Database locked errors, JSON cache race conditions, Process exit before completion, Missing exit codes, Cross-runtime API differences

### Phase 2: Service Layer Business Logic
**Rationale:** Business logic layer depends on infrastructure being complete. Provider detection, cache management, and proxy penetration can then be built on solid foundation.
**Delivers:** Provider detection (domain matching), Cache manager with TTL validation, Proxy penetration logic (CC Switch detection + credential extraction), API response normalization for multi-provider support
**Uses:** bun:sqlite / node:sqlite, native fetch, template literals
**Implements:** Service Layer component (lines 450-700)
**Addresses:** Provider detection, Multi-provider normalization, Proxy penetration, SQLite credential extraction

### Phase 3: API Integration & Data Flow
**Rationale:** With infrastructure and services complete, can now integrate real APIs (Kimi/GLM) and implement end-to-end data flow from proxy detection to normalized output.
**Delivers:** Kimi API integration (`/v1/usages` endpoint), GLM API integration (`/api/monitor/usage/quota/limit` endpoint), Unified usage data structure, Graceful degradation (return cached data on failure)
**Uses:** HTTP client from Phase 1, Provider detection and normalization from Phase 2
**Addresses:** Basic usage query, Multi-provider normalization, Graceful degradation
**Avoids:** HTTP API timeout configuration mistakes

### Phase 4: CLI Interface & User Experience
**Rationale:** User-facing layer comes last after all backend functionality is working. Can iterate on UX without changing core logic.
**Delivers:** Commander.js argument parsing, JSON and text output formats, Template-based output (`--template` flag), Concise default output for statusLine, Clear error messages with actionable suggestions, `--help` and `--version` flags
**Uses:** All previous layers (Coordination → Service → Infrastructure)
**Implements:** CLI Interface Layer component (lines 850-1000)
**Addresses:** Output formatting (JSON/text), Template-based output, Error handling with clear messages

### Phase 5: Distribution & Polish
**Rationale:** Final phase focuses on packaging, optimization, and real-world testing. Build system setup, single-file compilation, documentation.
**Delivers:** Single-file ESM distribution, Bun `--compile` executable generation, README with installation and usage, Cross-runtime testing (Bun + Node.js), Cache duration configuration (`--cache-duration` flag), Force refresh flag (`--force`)
**Addresses:** Single-file distribution, Cross-runtime compatibility, Configurable cache duration

### Phase Ordering Rationale

- **Phase 1 → Phase 2:** Infrastructure must exist before services can use it (database access, HTTP client, file I/O)
- **Phase 2 → Phase 3:** Provider detection and normalization must exist before real API integration makes sense
- **Phase 3 → Phase 4:** Core functionality must work before adding user-facing CLI interface
- **Phase 4 → Phase 5:** Working tool must exist before packaging for distribution
- **Concurrent access handled early:** WAL mode and atomic cache writes in Phase 1 prevent hard-to-debug concurrency issues later
- **Cross-runtime testing from day one:** Phase 1 establishes testing in both Bun and Node.js, preventing late-stage compatibility surprises

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** CC Switch database schema exploration — need to understand exact table structure and column names for credential extraction (research during implementation with actual database inspection)
- **Phase 3:** Kimi and GLM API response schemas — need actual API responses to validate normalization logic (research during implementation with curl/Postman testing)

Phases with standard patterns (skip research-phase):
- **Phase 1:** SQLite access, HTTP client, file I/O — well-documented patterns in both Bun and Node.js ecosystems
- **Phase 4:** CLI argument parsing, output formatting — Commander.js and template literals are straightforward, established patterns
- **Phase 5:** Build and distribution — Bun `--compile` is well-documented, single-file ESM distribution is standard

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified with official Bun and Node.js documentation, version numbers confirmed via npm/context7 |
| Features | MEDIUM | WebSearch sources only, rate limit errors prevented deeper verification, but competitor analysis provides good baseline |
| Architecture | HIGH | Based on established layered architecture patterns, well-documented in CLI tool literature and official guides |
| Pitfalls | MEDIUM | Mix of official docs (SQLite, Bun) and domain expertise, some sources are blog posts rather than official documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **CC Switch database schema unknown:** Exact table structure and column names for credential extraction need exploration during Phase 2 implementation. Handle by inspecting actual `~/.cc-switch/cc-switch.db` file during development.

- **Kimi and GLM API response schemas not fully verified:** Need actual API responses to validate normalization logic. Handle by testing with real API endpoints during Phase 3 using curl or Postman before implementing client code.

- **Rate limit behavior not fully understood:** Retry-After headers and rate limit thresholds for Kimi/GLM APIs need real-world observation. Handle by implementing conservative retry strategy initially (exponential backoff starting at 1s), then tune based on production behavior.

- **StatusLine refresh patterns vary:** Cache duration (60s default) may need adjustment based on actual user refresh patterns. Handle by making cache duration configurable via `--cache-duration` flag in Phase 5, gather user feedback.

## Sources

### Primary (HIGH confidence)
- Bun Official Documentation — SQLite API, single-file executables, bundler, runtime compatibility
- Node.js Official Documentation — node:sqlite module (v22.5.0+), native fetch API
- GitHub Issue nodejs/node#57445 — Node.js v25.7.0 SQLite RC announcement

### Secondary (MEDIUM confidence)
- LogRocket 2025 — Fetch vs Axios vs Undici performance comparison
- PkgPulse 2026 — Commander vs Yargs comparison (Commander minimal and zero-dependency)
- CodeBlocq 2016 — Template literals vs Handlebars performance (4x advantage)
- Tenthousandmeters Blog — SQLite concurrent writes and database locking errors

### Tertiary (LOW confidence)
- DEV Community, Rumbliq, The New Stack — API monitoring tools and anti-patterns (general principles, not domain-specific)
- Medium, LinkedIn — Error handling patterns (best practices, not verified with official sources)

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
