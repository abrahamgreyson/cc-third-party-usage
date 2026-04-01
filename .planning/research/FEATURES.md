# Feature Research

**Domain:** API Usage Monitoring CLI Tools
**Researched:** 2026-03-31
**Confidence:** MEDIUM (WebSearch sources only, rate limit errors prevented deeper verification)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Basic usage query** | Users need to see current quota consumption | LOW | Single command to fetch and display usage data |
| **Output formatting (JSON/text)** | Status line integration requires concise text; scripts need JSON | MEDIUM | Must support at least two output modes for different consumers |
| **Authentication/credential management** | API calls require credentials from environment or config | MEDIUM | Expected: env vars (ANTHROPIC_API_KEY), config files, or database extraction |
| **Error handling with clear messages** | Users need actionable feedback when queries fail | LOW | Clear exit codes and error messages for debugging |
| **Cache mechanism** | Frequent status line refreshes shouldn't hammer APIs | MEDIUM | 60-second default is common balance between freshness and rate limits |
| **Provider detection** | Tool should auto-detect which API to query based on config | MEDIUM | Domain-based detection (kimi.com, bigmodel.cn) reduces manual configuration |
| **Cross-runtime compatibility** | Users run different JavaScript runtimes (Bun, Node.js) | MEDIUM | Single-file ESM that works on both Bun and Node.js without transpilation |
| **Reset time display** | Users need to know when quota replenishes | LOW | Human-readable countdown (e.g., "4h 23m until reset") |
| **Percentage/remaining display** | Quick visual indicator of consumption | LOW | Show both absolute numbers and percentages |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Proxy penetration (CC Switch detection)** | Automatically extracts real credentials from proxy database | HIGH | Unique to this tool — detects localhost proxy and penetrates to real provider config |
| **Template-based output** | Custom output formats without code changes | MEDIUM | `--template` flag enables statusLine-specific formatting without forking tool |
| **Multi-provider normalization** | Unified interface across different API providers | MEDIUM | Kimi, GLM, future providers — all return same data structure |
| **Single-file distribution** | Zero-install: download one file and run | LOW | Simplicity for statusLine integration — no npm install, no dependencies |
| **Configurable cache duration** | Balance between freshness and API conservation per use case | LOW | `--cache-duration` flag lets users tune for their refresh patterns |
| **Graceful degradation** | Returns cached data on API failure with staleness indicator | MEDIUM | StatusLine shows last-known usage instead of blank on transient failures |
| **SQLite credential extraction** | Direct database access for proxy configuration | HIGH | Reads `~/.cc-switch/cc-switch.db` without external SQLite dependencies |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time WebSocket monitoring** | Users want live updates | Adds complexity, requires persistent connection, statusLine refreshes are already polling-based | Use existing cache mechanism with configurable duration |
| **OAuth authentication flows** | Some APIs require OAuth | Single-file constraint makes complex auth flows difficult to maintain; adds significant code bloat | API key-based auth only; document that OAuth is out of scope |
| **Multiple provider aggregation** | Show usage across all providers in one call | Different providers have different quota systems, reset times, rate limits — aggregation is misleading | Single provider per invocation; user runs tool multiple times if needed |
| **Persistent database storage** | Historical usage tracking | SQLite/history adds file management complexity, migration concerns, disk usage | Lightweight JSON cache only; external tools can parse JSON output for historical tracking |
| **Windows CC Switch paths** | Cross-platform support | Windows paths are fundamentally different (registry, AppData), adds significant conditional logic | Document Unix-only (macOS/Linux); Windows users can WSL or file issue for future support |
| **Built-in alerting/threshold notifications** | Proactive warnings when quota low | Requires background process, scheduling, notification system integration | External monitoring tools can parse JSON output and handle alerting |
| **Rate limit enforcement** | Prevent users from exceeding quotas | Tool's job is monitoring, not throttling — enforcement creates false expectations | Display usage clearly; let users manage their own rate limiting |
| **Web dashboard/UI** | Visual interface for usage data | Violates single-file CLI constraint; adds web server, frontend code, security concerns | JSON output enables external dashboard tools; CLI is the interface |

## Feature Dependencies

```
Proxy Penetration
    └──requires──> SQLite Credential Extraction
                       └──requires──> Provider Detection

Cache Mechanism
    └──requires──> File System Access (JSON read/write)

Template-based Output
    └──requires──> Basic Usage Query
    └──enhances──> StatusLine Integration

Multi-provider Normalization
    └──requires──> Provider Detection
    └──requires──> Basic Usage Query

Graceful Degradation
    └──requires──> Cache Mechanism
    └──enhances──> Error Handling

Single-file Distribution
    └──conflicts──> External Dependencies (must use built-in modules only)
```

### Dependency Notes

- **Proxy Penetration requires SQLite Credential Extraction:** Cannot detect proxy and extract credentials without reading the database
- **SQLite Credential Extraction requires Provider Detection:** Must know which provider (Kimi vs GLM) to extract correct credentials
- **Template-based Output enhances StatusLine Integration:** Templates make statusLine formatting flexible without code changes
- **Graceful Degradation enhances Error Handling:** Returns cached data instead of failing hard when APIs are unreachable
- **Single-file Distribution conflicts with External Dependencies:** Must use only Bun/Node built-in modules (bun:sqlite, node:sqlite, fs, path, etc.)

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] **Basic usage query** — Core value: fetch usage data from Kimi/GLM APIs
- [x] **Proxy penetration (CC Switch detection)** — Unique differentiator, validates core use case
- [x] **SQLite credential extraction** — Required for proxy penetration
- [x] **Provider detection** — Zero-configuration UX, required for normalization
- [x] **Multi-provider normalization** — Kimi and GLM support from day one
- [x] **Output formatting (JSON/text)** — StatusLine needs text, scripts need JSON
- [x] **Cache mechanism (60s default)** — Essential for statusLine refresh patterns
- [x] **Error handling with clear messages** — Actionable feedback on failures
- [x] **Single-file ESM distribution** — Simplicity for statusLine integration
- [x] **Cross-runtime compatibility (Bun/Node)** — Don't lock users into one runtime

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Template-based output (`--template` flag)** — After users report specific formatting needs
- [ ] **Configurable cache duration (`--cache-duration` flag)** — After users report cache freshness issues
- [ ] **Graceful degradation (return cached data on failure)** — After observing real-world failure modes
- [ ] **Verbose logging (`--verbose` flag)** — After users need deeper debugging
- [ ] **Reset time display improvements** — After user feedback on time formatting preferences

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Additional providers (beyond Kimi/GLM)** — After core use case validated with existing providers
- [ ] **Configuration file support (YAML/JSON)** — If env vars prove insufficient for power users
- [ ] **Usage history export (CSV/JSON)** — If users demand historical tracking
- [ ] **Multiple output format presets (`--format statusline/json/table`)** — If template proves too complex
- [ ] **Watch mode (continuous monitoring with live updates)** — If statusLine polling proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Basic usage query | HIGH | LOW | P1 |
| Proxy penetration | HIGH | HIGH | P1 |
| Provider detection | HIGH | MEDIUM | P1 |
| Multi-provider normalization | HIGH | MEDIUM | P1 |
| Output formatting (JSON/text) | HIGH | MEDIUM | P1 |
| Cache mechanism | HIGH | MEDIUM | P1 |
| SQLite credential extraction | HIGH | HIGH | P1 |
| Error handling | HIGH | LOW | P1 |
| Single-file distribution | MEDIUM | LOW | P1 |
| Cross-runtime compatibility | MEDIUM | MEDIUM | P1 |
| Template-based output | MEDIUM | MEDIUM | P2 |
| Configurable cache duration | MEDIUM | LOW | P2 |
| Graceful degradation | MEDIUM | MEDIUM | P2 |
| Verbose logging | LOW | LOW | P2 |
| Additional providers | MEDIUM | HIGH | P3 |
| Configuration file support | LOW | MEDIUM | P3 |
| Usage history export | LOW | MEDIUM | P3 |
| Watch mode | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | AWS CLI (CloudWatch) | GitHub CLI (`gh api`) | Stripe CLI | Our Approach |
|---------|---------------------|----------------------|-----------|--------------|
| **Usage query** | `aws cloudwatch get-metric-statistics` | `gh api rate_limit` | Limited usage metrics | Direct API calls to Kimi/GLM endpoints |
| **Output format** | JSON (default), text (via `--output text`) | JSON (default), templates via jq | JSON (default) | JSON + text default, custom templates via `--template` |
| **Cache** | None (queries every time) | None (queries every time) | None | 60s default cache (configurable) |
| **Auth** | Multiple profiles, env vars, credential files | Multiple auth methods (token, GitHub login) | API keys via login or env vars | Env vars + SQLite extraction from proxy |
| **Error handling** | Exit codes, verbose error messages | Exit codes, error JSON on failure | Exit codes, error messages | Exit codes, clear actionable error messages |
| **Proxy support** | HTTP_PROXY env var | N/A | N/A | **Unique:** Auto-detect and penetrate CC Switch proxy |
| **Provider normalization** | N/A (single provider) | N/A (single provider) | N/A (single provider) | Unified interface across Kimi/GLM/future providers |
| **Distribution** | Multi-file, npm/homebrew install | Multi-file, npm/homebrew install | Multi-file, npm/homebrew install | **Unique:** Single-file ESM, zero-install |

## Sources

- [4 Facets of API Monitoring You Should Implement - DEV Community](https://dev.to/apitally/4-facets-of-api-monitoring-you-should-implement-5afa) — API monitoring fundamentals: traffic, performance, errors, uptime
- [Best API Monitoring Tools 2026 - Rumbliq](https://rumbliq.com/blog/best-api-monitoring-tools-2026) — Comparison of monitoring tools, schema drift detection, third-party API monitoring patterns
- [The 5 Worst Anti-Patterns in API Management - The New Stack](https://thenewstack.io/the-5-worst-anti-patterns-in-api-management/) — Common mistakes in API tooling
- [API Anti-Patterns: Common Pitfalls - LinkedIn](https://www.linkedin.com/pulse/api-anti-patterns-common-pitfalls-avoid-better-design-alvis-cheng-jhabe) — Design and implementation mistakes
- [Graceful Degradation Patterns - Arcade.dev](https://www.arcade.dev/patterns/graceful-degradation/) — Resilience patterns for tool failures
- [Circuit Breaker Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) — Fault tolerance patterns
- [API Gateway Resilience - Zuplo](https://zuplo.com/learning-center/api-gateway-resilience-fault-tolerance) — Timeouts, retries, circuit breakers, graceful degradation
- [AWS CLI CloudWatch Command Reference](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/) — Industry standard CLI usage monitoring
- [GitHub CLI Rate Limit Discussions](https://github.com/cli/cli/discussions/7754) — Real-world rate limit handling in CLI tools
- [Stripe CLI Documentation](https://docs.stripe.com/cli) — Usage-based monitoring patterns

---
*Feature research for: API Usage Monitoring CLI Tools*
*Researched: 2026-03-31*
