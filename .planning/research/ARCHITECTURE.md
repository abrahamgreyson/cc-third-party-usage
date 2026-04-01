# Architecture Research

**Domain:** Single-file CLI tool with database access, HTTP client, and caching
**Researched:** 2026-03-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Interface Layer                       │
│  (Argument Parsing, Output Formatting, Error Display)       │
├─────────────────────────────────────────────────────────────┤
│                    Coordination Layer                        │
│  (Main Function, Orchestration, Control Flow)               │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Provider  │  │    Cache     │  │    Proxy     │       │
│  │  Detection  │  │   Manager    │  │  Penetration │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Database   │  │  HTTP Client │  │   File I/O   │      │
│  │   (SQLite)   │  │   (fetch)    │  │   (cache)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **CLI Interface** | Parse arguments, format output, display errors | Commander.js, Yargs, or native `process.argv` parsing |
| **Main Function** | Orchestrate execution flow, handle async operations | Top-level await or async IIFE with error handling |
| **Provider Detection** | Identify API provider from baseUrl domain | Domain pattern matching, regex validation |
| **Cache Manager** | Read/write JSON cache with TTL validation | File-based JSON with timestamp checks |
| **Proxy Penetration** | Detect CC Switch, extract real credentials | SQLite queries, environment variable checks |
| **Database Access** | Query CC Switch SQLite for configuration | Native `node:sqlite` or `bun:sqlite` module |
| **HTTP Client** | Make authenticated API requests with error handling | Native `fetch()` with retry wrapper |
| **File I/O** | Read/write cache file atomically | `fs.promises` API with error handling |

## Recommended Project Structure

Since this is a **single-file architecture** constraint, the structure is organized within one file:

```
usage.mjs
├── Shebang & Metadata (lines 1-20)
│   #!/usr/bin/env node
│   // Metadata: version, description
│
├── Imports (lines 20-50)
│   // Native modules: fs, path, os, sqlite
│   // No external dependencies
│
├── Constants & Configuration (lines 50-100)
│   // API endpoints, cache duration, paths
│   // Provider detection patterns
│   // Default settings
│
├── Utility Functions (lines 100-250)
│   // Helper functions grouped by purpose:
│   // - Path resolution
│   // - Error formatting
│   // - Data normalization
│   // - Validation
│
├── Infrastructure Layer (lines 250-450)
│   // Database access functions
│   // HTTP client wrapper with retry
│   // File I/O operations
│
├── Service Layer (lines 450-700)
│   // Provider detection logic
│   // Cache management (read/write/validate)
│   // Proxy penetration logic
│   // API response normalization
│
├── Coordination Layer (lines 700-850)
│   // Main orchestration function
│   // Flow control: detect → penetrate → fetch → cache → output
│   // Error handling and propagation
│
├── CLI Interface Layer (lines 850-1000)
│   // Argument parsing
│   // Output formatting (concise/template)
│   // Error display and exit codes
│
└── Entry Point (lines 1000+)
    // Top-level await or main() call
    // Process exit handling
```

### Structure Rationale

**Single-file organization follows vertical slice pattern:**
- **Top to bottom**: High-level to low-level (CLI → Infrastructure)
- **Grouped by abstraction layer**: Related functions clustered together
- **Entry point at end**: Execution flows from bottom up
- **No circular dependencies**: Each layer only calls layers below it

This structure is common in single-file CLI tools like `create-react-app`, `vite`, and other popular tools when bundled as single files.

## Architectural Patterns

### Pattern 1: Layered Architecture with Clear Boundaries

**What:** Organize code into distinct layers (CLI → Coordination → Service → Infrastructure) with unidirectional dependencies.

**When to use:** All single-file CLI tools with multiple concerns (database, HTTP, caching).

**Trade-offs:**
- ✅ Clear separation of concerns
- ✅ Testable units (each layer can be tested independently)
- ✅ Easy to locate functionality
- ❌ More initial organization required
- ❌ May feel "over-engineered" for very simple tools

**Example:**
```javascript
// Infrastructure Layer - Database access
async function queryCcSwitchDb(dbPath, query) {
  const db = await openDatabase(dbPath);
  const result = await db.execute(query);
  await db.close();
  return result;
}

// Service Layer - Uses infrastructure
async function extractRealCredentials(dbPath) {
  const config = await queryCcSwitchDb(dbPath, 'SELECT * FROM provider');
  return parseProviderConfig(config);
}

// Coordination Layer - Orchestrates services
async function fetchUsageData(baseUrl) {
  const credentials = await extractRealCredentials(getDbPath());
  const response = await fetchWithRetry(credentials.apiUrl, {
    headers: { 'Authorization': `Bearer ${credentials.apiKey}` }
  });
  return normalizeUsageData(response);
}

// CLI Layer - Entry point
async function main() {
  const args = parseArgs(process.argv);
  const data = await fetchUsageData(args.baseUrl);
  console.log(formatOutput(data, args.template));
}
```

### Pattern 2: Fail-Fast Error Handling

**What:** Validate assumptions early and exit with clear error messages when preconditions fail.

**When to use:** CLI tools where configuration errors should be immediately visible to users.

**Trade-offs:**
- ✅ Clear error messages help users fix issues
- ✅ Prevents silent failures or incorrect behavior
- ✅ Simplifies debugging
- ❌ Requires comprehensive validation code
- ❌ May feel "strict" for edge cases

**Example:**
```javascript
async function detectProxyConfig() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || process.env.BASE_URL;

  if (!baseUrl) {
    console.error('Error: No proxy configuration found');
    console.error('Set ANTHROPIC_BASE_URL or BASE_URL environment variable');
    process.exit(1);
  }

  if (!isLocalhost(baseUrl)) {
    console.error('Error: baseUrl does not appear to be a CC Switch proxy');
    console.error(`Expected localhost/127.0.0.1, got: ${baseUrl}`);
    process.exit(1);
  }

  return baseUrl;
}
```

### Pattern 3: Cache-First with Stale-While-Revalidate

**What:** Always check cache first, serve cached data if valid, optionally refresh in background.

**When to use:** CLI tools invoked frequently (like statusLine integration) where response time matters.

**Trade-offs:**
- ✅ Fast response for frequent invocations
- ✅ Reduces API calls and rate limit pressure
- ✅ Works well with status bar refresh patterns
- ❌ May serve slightly stale data
- ❌ Requires cache invalidation logic
- ❌ Additional file I/O overhead

**Example:**
```javascript
const CACHE_DURATION_MS = 60_000; // 60 seconds

async function getUsageData(forceRefresh = false) {
  const cachePath = getCachePath();

  // Try cache first
  if (!forceRefresh) {
    const cached = await readCache(cachePath);
    if (cached && !isCacheStale(cached)) {
      return cached.data; // Fast path
    }
  }

  // Cache miss or stale - fetch fresh data
  const freshData = await fetchUsageFromApi();
  await writeCache(cachePath, {
    timestamp: Date.now(),
    data: freshData
  });

  return freshData;
}

function isCacheStale(cache) {
  return (Date.now() - cache.timestamp) > CACHE_DURATION_MS;
}
```

### Pattern 4: Native Module Abstraction

**What:** Wrap runtime-specific modules (Bun vs Node) in unified interface to ensure compatibility.

**When to use:** CLI tools that must run on multiple JavaScript runtimes.

**Trade-offs:**
- ✅ Single codebase works on multiple runtimes
- ✅ Runtime-specific optimizations preserved
- ✅ Easier testing and maintenance
- ❌ Slight abstraction overhead
- ❌ Requires conditional imports

**Example:**
```javascript
// Runtime-agnostic database access
let Database;

// Detect runtime and load appropriate module
if (typeof Bun !== 'undefined') {
  Database = (await import('bun:sqlite')).Database;
} else {
  Database = (await import('node:sqlite')).DatabaseSync;
}

async function openDatabase(path) {
  return new Database(path);
}

// Usage is identical regardless of runtime
const db = await openDatabase('~/.cc-switch/cc-switch.db');
const result = db.prepare('SELECT * FROM provider').all();
```

### Pattern 5: Template-Based Output Formatting

**What:** Support custom output formats via template strings rather than multiple hardcoded formats.

**When to use:** CLI tools where users need integration with different systems (statusLine, scripts, etc.).

**Trade-offs:**
- ✅ Flexible without code changes
- ✅ Single format implementation to maintain
- ✅ User-controlled customization
- ❌ Requires template parsing logic
- ❌ Less structured than multiple format options

**Example:**
```javascript
function formatOutput(data, template = '{remaining} left ({percent}%)') {
  // Simple template substitution
  return template
    .replace('{total}', data.total)
    .replace('{used}', data.used)
    .replace('{remaining}', data.remaining)
    .replace('{percent}', data.percent)
    .replace('{reset}', data.reset_display);
}

// Default concise format for statusLine
console.log(formatOutput(data));
// Output: "847 left (85%)"

// Custom format for different integrations
console.log(formatOutput(data, 'Used {used}/{total}, resets at {reset}'));
// Output: "Used 153/1000, resets at 14:30"
```

## Data Flow

### Request Flow

```
[User/StatusLine]
    ↓ (invoke usage.mjs)
[CLI Argument Parser] → Parse flags (--template, --force)
    ↓
[Main Orchestration Function]
    ↓
[Proxy Detection] → Check ANTHROPIC_BASE_URL/BASE_URL
    ↓ (localhost detected?)
[Proxy Penetration] → Query SQLite for real credentials
    ↓ (apiKey + baseUrl extracted)
[Provider Detection] → Match domain to provider (Kimi/GLM)
    ↓
[Cache Check] → Read ~/.cc-switch/usage_cache.json
    ↓ (cache valid?)
    ├─ YES → [Return cached data] → [Format Output] → [Exit 0]
    └─ NO  → Continue
[HTTP Request] → Fetch /v1/usages or /api/monitor/usage/quota/limit
    ↓ (with retry logic)
[Response Normalization] → Convert to standard format
    ↓
[Cache Write] → Store with timestamp
    ↓
[Output Formatting] → Apply template
    ↓
[Console Output] → Print to stdout
    ↓
[Exit 0]
```

### Error Flow

```
[Any Step]
    ↓ (error occurs)
[Error Handler]
    ↓
[User-Friendly Error Message]
    ↓
[Console Error] → stderr
    ↓
[Exit 1]
```

### State Management

Single-file CLI tools typically use **stateless architecture**:

```
[Environment Variables] → Read at startup
    ↓
[Function Arguments] → Passed through call chain
    ↓
[Cache File] → Persistent state (JSON)
    ↓
[Return Values] → Data flows back up
```

No global state mutation. All data flows through function arguments and return values.

### Key Data Flows

1. **Configuration Detection Flow:**
   - Environment variables (`ANTHROPIC_BASE_URL`, `BASE_URL`) → Proxy detection → SQLite query → Real credentials extracted

2. **Cache Management Flow:**
   - Check cache file existence → Read JSON → Compare timestamp → Serve or refresh → Write updated cache

3. **API Request Flow:**
   - Detected provider → Construct endpoint URL → Add auth headers → Fetch with retry → Parse JSON response → Normalize to standard format

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Single user, occasional use** | Current single-file architecture is optimal |
| **Single user, frequent statusLine integration** | Reduce cache duration (30s) or add `--force` flag |
| **Team usage (shared machine)** | Add user-specific cache paths, config per user |
| **Multiple providers** | Extract provider adapters to separate functions, plugin pattern |

### Scaling Priorities

1. **First bottleneck: Cache invalidation**
   - **What breaks:** Stale data during rapid API usage changes
   - **How to fix:** Add `--force` flag, reduce default cache duration, or implement cache-busting logic

2. **Second bottleneck: Error message clarity**
   - **What breaks:** Users can't diagnose configuration issues
   - **How to fix:** Add verbose error messages with suggested fixes, link to documentation

**Note:** This tool is designed for single-user, local usage. Scaling beyond that scope would require rearchitecting as a multi-file project or service.

## Anti-Patterns

### Anti-Pattern 1: God Function

**What people do:** Write entire CLI logic in one massive `main()` function with 500+ lines.

**Why it's wrong:**
- Impossible to test individual components
- Hard to debug specific issues
- Difficult to modify behavior without breaking other parts
- No code reuse between features

**Do this instead:** Break into focused functions with single responsibilities:
```javascript
// ❌ Bad - God function
async function main() {
  // 200 lines of argument parsing
  // 150 lines of database access
  // 100 lines of HTTP requests
  // 50 lines of output formatting
}

// ✅ Good - Focused functions
function parseArgs(argv) { /* 20 lines */ }
async function detectProvider(baseUrl) { /* 15 lines */ }
async function queryApi(endpoint, credentials) { /* 25 lines */ }
function formatOutput(data, template) { /* 10 lines */ }

async function main() {
  const args = parseArgs(process.argv);
  const provider = await detectProvider(args.baseUrl);
  const data = await queryApi(provider.endpoint, provider.credentials);
  console.log(formatOutput(data, args.template));
}
```

### Anti-Pattern 2: Global State Mutation

**What people do:** Use global variables to share state between functions.

**Why it's wrong:**
- Makes functions impure and unpredictable
- Difficult to test in isolation
- Hidden dependencies between functions
- Race conditions in async code

**Do this instead:** Pass state explicitly through function arguments:
```javascript
// ❌ Bad - Global state
let cacheData = null;
let credentials = null;

async function fetchUsage() {
  credentials = await getCredentials(); // Mutates global
  cacheData = await fetch(credentials); // Mutates global
}

// ✅ Good - Explicit state
async function fetchUsage(credentials) {
  return await fetch(credentials);
}

const credentials = await getCredentials();
const data = await fetchUsage(credentials);
```

### Anti-Pattern 3: Silent Failure with Fallback

**What people do:** Catch errors and silently return default values or fallback behavior.

**Why it's wrong:**
- Users don't know something is broken
- Debugging becomes nightmare
- Incorrect data may be displayed
- Configuration issues remain hidden

**Do this instead:** Fail fast with clear error messages:
```javascript
// ❌ Bad - Silent failure
async function detectProxy() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    return 'https://api.anthropic.com'; // Silent fallback
  }
  return baseUrl;
}

// ✅ Good - Fail fast
async function detectProxy() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    console.error('Error: ANTHROPIC_BASE_URL not set');
    console.error('This tool requires CC Switch proxy to be configured');
    process.exit(1);
  }
  return baseUrl;
}
```

### Anti-Pattern 4: Synchronous I/O in Hot Path

**What people do:** Use synchronous file/database operations (`fs.readFileSync`, `db.exec`).

**Why it's wrong:**
- Blocks event loop during statusLine refresh
- Slows down CLI response time
- Prevents concurrent operations
- Poor user experience in interactive scenarios

**Do this instead:** Use async/await throughout:
```javascript
// ❌ Bad - Sync I/O
function readCache(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8')); // Blocks!
}

// ✅ Good - Async I/O
async function readCache(path) {
  const content = await fs.promises.readFile(path, 'utf8');
  return JSON.parse(content);
}
```

### Anti-Pattern 5: Tight Coupling to Runtime-Specific APIs

**What people do:** Use runtime-specific APIs directly without abstraction.

**Why it's wrong:**
- Code only works on one runtime (Bun or Node, not both)
- Difficult to test without specific runtime
- Migration to different runtime requires rewrite

**Do this instead:** Abstract runtime-specific imports:
```javascript
// ❌ Bad - Runtime-specific
import { Database } from 'bun:sqlite'; // Only works in Bun!

// ✅ Good - Runtime-agnostic
let Database;
if (typeof Bun !== 'undefined') {
  Database = (await import('bun:sqlite')).Database;
} else {
  Database = (await import('node:sqlite')).DatabaseSync;
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Kimi API** | HTTPS GET to `/v1/usages` | Requires API key in Authorization header |
| **GLM API** | HTTPS GET to `/api/monitor/usage/quota/limit` | Different response structure, needs normalization |
| **CC Switch SQLite** | Direct database query | Read-only access to `provider` table |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **CLI ↔ Coordination** | Function call with parsed args | Synchronous interface, async implementation |
| **Coordination ↔ Service** | Async function calls with DTOs | Data transfer objects for credentials, usage data |
| **Service ↔ Infrastructure** | Async function calls | Abstracted I/O operations (db, http, file) |

### Build Order Implications

Based on the layered architecture, recommended implementation order:

1. **Infrastructure Layer** (Foundation)
   - Database access functions (SQLite queries)
   - HTTP client wrapper (fetch with retry)
   - File I/O utilities (cache read/write)
   - **Why first:** No dependencies on other layers, can be tested in isolation

2. **Service Layer** (Business Logic)
   - Provider detection (domain matching)
   - Cache manager (TTL validation, stale detection)
   - Proxy penetration (credential extraction)
   - API response normalization
   - **Why second:** Depends on infrastructure, but not CLI or coordination

3. **Coordination Layer** (Orchestration)
   - Main orchestration function
   - Error handling wrapper
   - Control flow logic
   - **Why third:** Depends on service layer to do actual work

4. **CLI Interface Layer** (User Interaction)
   - Argument parser
   - Output formatter
   - Error display
   - **Why last:** Depends on coordination layer, easiest to iterate on

**Dependencies flow downward:** CLI → Coordination → Service → Infrastructure

**Testing order:** Infrastructure → Service → Coordination → CLI (bottom-up testing)

## Sources

- **ESM Single-File Architecture:**
  - [How to generate a single file "ESM" bundle using ESBuild for Node.js?](https://stackoverflow.com/questions/76630431/how-to-generate-a-single-file-esm-bundle-using-esbuild-for-node-js) - ESBuild configuration for ESM bundles
  - [ESM | oclif: The Open CLI Framework](https://oclif.github.io/docs/esm/) - ESM support in CLI frameworks
  - [Full Guide to JavaScript Modules: From Chaos to Clarity](https://billennium.com/full-guide-to-javascript-modules-from-chaos-to-clarity/) - Module organization patterns

- **CLI Architecture Patterns:**
  - [14 Great Tips to Make Amazing CLI Applications](https://dev.to/wesen/14-great-tips-to-make-amazing-cli-applications-3gp3) - Single-file distribution, command parsing frameworks
  - [Node.js CLI Apps Best Practices (GitHub)](https://github.com/lirantal/nodejs-cli-apps-best-practices) - Comprehensive CLI patterns repository
  - [Separation of Concerns Pattern](https://mcpmarket.com/tools/skills/separation-of-concerns-pattern) - Layered architecture for CLI tools

- **Node.js Native SQLite:**
  - [Node.js 24 原生SQLite 支持](https://developer.aliyun.com/article/1712615) - Native SQLite module in Node.js 24
  - [重磅！Node.js 24 原生SQLite 支持](https://juejin.cn/post/7570394530316615680) - Native SQLite integration details

- **HTTP Client Patterns:**
  - [Axios vs. Fetch (2025 update)](https://blog.logrocket.com/axios-vs-fetch-2025/) - Error handling comparison, retry strategies
  - [Building Resilient Systems with API Retry Mechanisms in Node.js](https://medium.com/@devharshgupta.com/building-resilient-systems-with-api-retry-mechanisms-in-node-js-a-guide-to-handling-failure-d6d9021b172a) - Retry with exponential backoff
  - [Implementing retry logic in node-fetch api call](https://stackoverflow.com/questions/71705285/implementing-retry-logic-in-node-fetch-api-call) - Practical retry implementation

- **Caching Strategies:**
  - [Caching in Node.js command line app](https://stackoverflow.com/questions/47618926/caching-in-node-js-command-line-app) - File-based caching patterns for CLI
  - [Bringing HTTP Caching to Node.js](https://blog.platformatic.dev/bringing-http-caching-to-nodejs) - Cache invalidation strategies

- **Top-Level Await:**
  - [Using await at the top level in ES modules](https://allthingssmatty.com/2025/06/16/using-await-at-the-top-level-in-es-modules/) - TLA patterns and trade-offs
  - [深入了解Top-level await](https://github.com/orgs/web-infra-dev/discussions/10) - Module execution order with TLA

- **Layered Architecture:**
  - [Layered Architecture: Separating Concerns in Software Design](https://comp423-25s.github.io/resources/backend-architecture/0-layered-architecture/) - Separation of concerns benefits for CLI tools

---
*Architecture research for: Single-file CLI tool with database, HTTP, and caching*
*Researched: 2026-03-31*
