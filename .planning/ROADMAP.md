# AI API Usage Monitor - Roadmap

**Project:** cc-third-party-usage
**Created:** 2026-03-31
**Granularity:** Fine
**Status:** Active

## Overview

This roadmap delivers a high-performance single-file CLI tool that monitors AI API usage (Kimi and GLM) with intelligent CC Switch proxy detection, optimized for Claude Code statusLine integration.

## Phases

- [x] **Phase 1: Core Infrastructure** - Runtime-abstracted SQLite access, HTTP client with retry/timeout, atomic file operations, error handling framework
- [ ] **Phase 2: Proxy Penetration & Provider Detection** - CC Switch detection, credential extraction from SQLite, provider auto-detection and routing
- [ ] **Phase 3: API Integration & Data Normalization** - Kimi/GLM API integration, response parsing, unified data format, error handling
- [ ] **Phase 4: Caching Layer** - JSON file cache with TTL, atomic writes, cache-first data fetching strategy
- [ ] **Phase 5: CLI Interface & Output Formatting** - Argument parsing, template-based output, statusLine-optimized defaults, help/version flags

## Phase Details
### Phase 1: Core Infrastructure

**Goal:** Establish cross-runtime compatible foundation with SQLite access, HTTP client, and error handling that all subsequent layers depend on.

**Depends on:** nothing (first phase)

**Requirements:** CORE-01, CORE-02, core-03, core-04, DB-01, db-02, db-03, db-04, db-05, http-01, http-02, http-03, http-04, http-05

**Success Criteria** (what must be TRUE):
1. developer can run the same `usage.mjs` file on both Bun and Node.js runtimes without modification
2. developer can query SQLite database using runtime-conditional imports that work identically on Bun and Node.js
3. developer can make HTTP requests with automatic retry, timeout, and rate limit handling
4. developer can trigger error conditions and see clear, actionable error messages with appropriate exit codes
5. tool handles concurrent database access without locking errors (WAL mode enabled)

**Plans:** 4 plans (00-03) - COMPLETED

### Phase 2: Proxy Penetration & Provider Detection

**Goal:** users behind CC Switch proxy have their real API credentials automatically extracted and the correct provider detected without manual configuration.

**Depends on:** Phase 1 (needs SQLite access and error handling)

**Requirements:** PROXY-01, PROXY-02, PROXY-03, PROXY-04, PROXY-05, PROV-01, PROV-02, PROV-03

**Success Criteria** (what must be TRUE):
1. user with CC Switch proxy enabled (localhost in ANTHROPIC_BASE_URL) has real credentials automatically extracted from SQLite database
2. user's provider type (Kimi or GLM) is correctly detected from baseUrl domain without manual specification
3. user without proxy has credentials read from environment variables as fallback
4. user sees clear error message when CC Switch database is unreadable or credentials cannot be extracted
5. tool routes to correct API endpoint based on detected provider (kimi.com → Kimi API, bigmodel.cn → GLM API)

**Plans:** 3 plans in 3 waves
plans:
- [x] 02-00-PLAN.md — Wave 0: test infrastructure (4 test files, mock DB helper)
- [x] 02-01-PLAN.md — Wave 1: proxy detection + provider detection
- [x] 02-02-PLAN.md — Wave 2: credential extraction + unified resolution

### Phase 3: API Integration & Data Normalization

**Goal:** users receive normalized usage data from their provider's API in a consistent format regardless of provider-specific response schemas.

**Depends on:** Phase 2 (needs provider detection and credentials)

**Requirements:** API-01, API-02, API-03, API-04, API-05, NORM-01, NORM-02, NORM-03, NORM-04

**Success Criteria** (what must be TRUE):
1. user can query Kimi API and receive usage data in normalized format (total, used, remaining, percent, reset_display)
2. user can query GLM API and receive usage data in same normalized format as Kimi
3. user sees human-readable reset time (e.g., "2小时30分") regardless of provider's timestamp format
4. user sees clear error message when API request fails (network error, timeout, rate limit, invalid response)
5. tool correctly parses both Kimi response format (usage array, limits array) and GLM response format (data.limits array)

**Plans:** 4 plans in 3 waves
plans:
- [x] 03-00-PLAN.md — Wave 0: test infrastructure (test stubs for mock API fixtures)
- [ ] 03-01-PLAN.md — Wave 1: API request infrastructure (URL builder, query functions)
- [ ] 03-02-PLAN.md — Wave 1: Response parsers (Kimi parser, GLM parser)
- [ ] 03-03-PLAN.md — Wave 2: Data normalization (timestamp conversion, percentage, unified format)

### Phase 4: caching Layer
**Goal:** users experience fast statusLine refreshes without API rate limit concerns thanks to intelligent cache-first data fetching strategy.

**Depends on:** Phase 3 (needs normalized usage data to cache)

**Requirements:** CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05

**Success Criteria** (what must be TRUE):
1. user's repeated invocations within 60 seconds receive cached data without hitting the API
2. user can customize cache duration via `--cache-duration` flag (e.g., 120 seconds)
3. user's cache file survives concurrent invocations without corruption (atomic write operations)
4. user sees stale data immediately on cache hit (no delay for statusLine refresh)
5. cache includes timestamp, provider name, and complete normalized usage data structure

**Plans:** TBD

### Phase 5: CLI Interface & Output Formatting
**Goal:** users have flexible output options optimized for statusLine integration while supporting custom templates and machine-readable formats.

**Depends on:** Phase 4 (needs complete data flow with caching)

**Requirements:** OUT-01, OUT-02, out-03, out-04, out-05, CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Success Criteria** (what must be TRUE):
1. user sees concise default output optimized for statusLine display (provider, usage percent, reset time)
2. user can request JSON output via `--json` flag for scripting and automation
3. user can customize output format using `--template` flag with placeholders (e.g., `{provider}: {used}/{total}`)
4. user can see debugging information with `--verbose` flag (cache hits, API calls, provider detection)
5. user sees help documentation with `--help` or `-h` flag
6. user sees version information with `--version` or -v` flag
7. all output goes to stdout, all errors go to stderr (proper CLI conventions)

**Plans:** TBD

## Progress
| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. core infrastructure | 4/4 | Completed | 2026-04-01 |
| 2. proxy penetration & provider detection | 3/3 | Completed | 2026-04-01 |
| 3. api integration & data normalization | 0/4 | Ready for execution | - |
| 4. caching layer | 0/1 | Not started | - |
| 5. cli interface & output formatting | 0/1 | Not started | - |

## Notes
- **Phase ordering rationale:** infrastructure → service logic → API integration → caching → user interface
- **Cross-runtime testing:** Phase 1 establishes testing in each Bun and Node.js from day one
- **Concurrent access:** WAL mode and atomic cache writes prevent concurrency issues
- **Research flags:** Phase 2 (CC Switch schema exploration) and Phase 3 (API response validation) need deeper research during planning
---
*Roadmap created: 2026-03-31*
*roadmap updated: 2026-04-01*
