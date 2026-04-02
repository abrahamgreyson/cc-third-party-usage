# Phase 05: CLI Interface & Output Formatting - Research

**Researched:** 2026-04-02
**Domain:** CLI argument parsing (Commander.js), output formatting, template engine, multi-window parser backport
**Confidence:** HIGH

## Summary

Phase 5 delivers the user-facing CLI layer of `usage.mjs`. It has three distinct work streams: (1) a Phase 3 parser backport to capture all quota windows from both APIs instead of just `limits[0]`, (2) a Commander.js-based CLI entry point with six flags (`--json`, `--template`, `--verbose`, `--cache-duration`, `--help`, `--version`), and (3) output formatting functions (default statusLine format, JSON output, template placeholder substitution, verbose debug logging). The existing codebase provides a clean integration point: the `///// CLI Interface /////` and `///// Entry Point /////` placeholder sections at lines 1238-1239 of `usage.mjs`, and the already-exported `getCachedUsageData()` as the data fetching entry point.

The Commander.js library (v14.0.3) is the project's single allowed external dependency. It supports ESM imports, has zero transitive dependencies, and provides `parseAsync()` for async action handlers. The template engine is a trivial string `.replace()` loop -- no library needed. All data output goes to stdout; all errors and verbose output go to stderr.

**Primary recommendation:** Structure the phase as three waves: (1) parser backport + new data structures, (2) CLI entry point with Commander.js, (3) output formatters and integration. Use `program.parseAsync()` with `exitOverride()` for controlled error handling. Keep the CLI entry point under 100 lines -- the real work is in formatting functions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Expand Phase 3 parsers to capture ALL quota windows (not just `limits[0]`). New nested data structure with `quotas[]` array.
- **D-02:** Preserve backward compatibility for caching. Cache file structure updates to match new format. Existing cache files become invalid (acceptable -- TTL is 60s).
- **D-03:** Default output: `{Provider}: {percent}% | {reset_display}` (e.g., `Kimi: 45.2% | 2h30m`). Shows most relevant window.
- **D-04:** Reset time format for statusLine: compact `2h30m`, `45m15s`, `3d12h` -- NOT Chinese format.
- **D-05:** Default output shows ONE quota window (shortest reset time). Full data via `--json` and `--template`.
- **D-06:** Template engine: simple `{placeholder}` replacement only. Unknown placeholders kept as-is.
- **D-07:** Window-prefixed placeholders: `{window_field}` (e.g., `{5h_percent}`, `{weekly_reset}`).
- **D-08:** JSON output: complete nested structure with both human and machine-readable fields.
- **D-09:** Verbose output: three sections (cache status, API call details, provider detection). All to stderr.
- **D-10:** Verbose format: one-line-per-fact with `[debug]` prefix.
- **D-11:** Commander.js for argument parsing (v14.0.3). Only external dependency.
- **D-12:** Dual-mode: CLI when run directly, module when imported. Detection via `process.argv[1]`.
- **D-13:** `--version` outputs `usage.mjs v1.0.0`, exit code 0.
- **D-14:** stdout/stderr separation: data to stdout, errors+verbose to stderr.

### Claude's Discretion
- Exact error message wording for CLI errors
- Commander.js program configuration details (description, option definitions)
- Compact reset time formatter implementation (hours/minutes/seconds breakdown)
- Whether to add `--quiet` flag (currently not in requirements)
- Test coverage boundaries for CLI entry point
- How to select "most relevant" quota window for default display (shortest reset vs highest usage)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope. Multi-window data capture is a backport to Phase 3 parsers, not new capability.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-01 | Default concise output format optimized for statusLine display | D-03 defines `{Provider}: {percent}% \| {reset_display}`. Compact reset formatter (D-04) needed alongside existing `formatTimeRemaining()`. |
| OUT-02 | Support `--json` flag for JSON output (machine-readable) | D-08 defines complete nested structure. `JSON.stringify(data, null, 2)` to stdout. |
| OUT-03 | Support `--template` flag for custom output format with placeholders | D-06/D-07 define `{window_field}` pattern. Simple regex/string replace loop. |
| OUT-04 | Template placeholders: `{total}`, `{used}`, `{remaining}`, `{percent}`, `{reset}`, `{provider}` | Extended with window prefixes per D-07: `{5h_percent}`, `{weekly_reset}`, etc. |
| OUT-05 | All output to stdout, errors to stderr (proper CLI conventions) | D-14 locked. Commander.js `configureOutput()` + explicit `process.stdout.write`/`process.stderr.write`. |
| CLI-01 | Zero-configuration: auto-detect everything by default | `getCachedUsageData()` already handles auto-detection. CLI calls it with no args. |
| CLI-02 | Support `--cache-duration <seconds>` flag to customize cache TTL | Commander.js `.option('-c, --cache-duration <seconds>', ..., parseInt, 60)`. Passes to `getCachedUsageData()`. |
| CLI-03 | Support `--template <string>` flag for custom output | Commander.js `.option('-t, --template <string>', ...)`. |
| CLI-04 | Support `--json` flag for JSON output | Commander.js `.option('-j, --json', ...)`. Boolean flag. |
| CLI-05 | Support `--verbose` flag for debugging | Commander.js `.option('-V, --verbose', ...)`. Note: `-v` reserved for version. |
| CLI-06 | Display help with `--help` or `-h` | Built into Commander.js by default. |
| CLI-07 | Display version with `--version` or `-v` | Commander.js `.version(VERSION)`. Default flags are `-V, --version`; user wants `-v, --version` per D-13. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Commander.js | 14.0.3 | CLI argument parsing | Project decision (CLAUDE.md tech stack). Zero transitive dependencies. Dual CJS/ESM support. Provides --help, --version, option parsing, async action handlers. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | Template engine uses native `String.prototype.replace()`. Output formatting uses template literals. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Commander.js | Yargs | Yargs is heavier, more complex. Overkill for 6 flags on a single command. |
| Commander.js | manual `process.argv` parsing | Manual parsing is fragile, misses edge cases (combined flags, `--` separator, help formatting). Not worth saving one dependency. |
| String.replace() | Mustache/Handlebars | Template needs are trivial (6-10 placeholders). Full template engine adds 100-200KB for no benefit. |

**Installation:**
```bash
npm install commander@14.0.3
```

**Version verification:**
```
npm view commander version -> 14.0.3 (verified 2026-04-02)
```

Note: Commander.js is NOT currently installed. The project has no `package.json`. This must be created as part of Wave 0 setup.

## Architecture Patterns

### Recommended Integration Point
```
usage.mjs (single file, ~1287 lines currently)

Line 1238: ///// CLI Interface /////   <-- NEW CODE HERE
Line 1239: ///// Entry Point /////     <-- NEW CODE HERE

Existing exports block (line 1241-1286): ADD new exports
```

### Pattern 1: Commander.js ESM Single-Command Program
**What:** Single-command CLI (no subcommands) with async action handler
**When to use:** This phase -- the tool has one mode of operation
**Example:**
```javascript
// Source: Commander.js official README (github.com/tj/commander.js)
import { Command } from 'commander';

const program = new Command();
program
  .name('usage.mjs')
  .description(DESCRIPTION)
  .version(VERSION, '-v, --version', 'output the current version');

program
  .option('-j, --json', 'output raw JSON')
  .option('-t, --template <string>', 'custom output template')
  .option('-V, --verbose', 'show debug information')
  .option('-c, --cache-duration <seconds>', 'cache TTL in seconds', parseInt, 60);

program
  .exitOverride() // Prevents Commander from calling process.exit directly
  .action(async (options) => {
    // Main logic here
  });

await program.parseAsync(process.argv);
```

### Pattern 2: Dual-Mode Entry Point Detection
**What:** Run as CLI when executed directly, export as module when imported
**When to use:** Single-file architecture that needs both CLI and test module access
**Example:**
```javascript
// ESM equivalent of require.main === module
// process.argv[1] contains the script path when run directly
const isMainModule = process.argv[1] &&
  (process.argv[1].includes('usage.mjs') || process.argv[1].includes('usage'));

if (isMainModule) {
  runCLI().catch(handleError);
}
```

### Pattern 3: Template Placeholder Substitution
**What:** Simple `{placeholder}` replacement with window-prefixed keys
**When to use:** `--template` flag output formatting
**Example:**
```javascript
function applyTemplate(template, data) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    // Build flat lookup from nested quotas array
    const values = buildPlaceholderValues(data);
    return key in values ? String(values[key]) : match;
  });
}

function buildPlaceholderValues(data) {
  const values = { provider: data.provider };
  for (const quota of data.quotas) {
    const prefix = quota.window; // '5h', 'weekly', 'overall'
    values[`${prefix}_percent`] = quota.percent;
    values[`${prefix}_reset`] = quota.reset;
    values[`${prefix}_used`] = quota.used ?? '';
    values[`${prefix}_total`] = quota.total ?? '';
    values[`${prefix}_remaining`] = quota.remaining ?? '';
  }
  return values;
}
```

### Pattern 4: Compact Reset Time Formatter
**What:** Convert milliseconds to compact format like `2h30m`, `45m15s`, `3d12h`
**When to use:** Default statusLine output (D-04)
**Example:**
```javascript
function formatCompactTime(ms) {
  if (ms <= 0) return '0s';
  const days = Math.floor(ms / (86400000));
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`); // skip seconds when days shown
  return parts.join('');
}
```

### Anti-Patterns to Avoid
- **Using `program.parse()` with async actions:** Must use `program.parseAsync()` or async actions silently fail. (Source: Commander.js Issue #1681)
- **Commander.js default `-V` for version:** User expects `-v` for version (D-13). Must explicitly set `'-v, --version'` in `.version()` call.
- **Putting verbose output on stdout:** D-14 requires verbose/debug to stderr. Use `process.stderr.write()` explicitly, not `console.log()`.
- **Modifying parser return types without updating cache:** D-02 notes cache structure must match new format. Old cache files invalidated (acceptable).
- **Using `console.log()` for data output:** Use `process.stdout.write()` to avoid trailing newline issues and ensure clean pipe behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Manual `process.argv` parsing | Commander.js | Edge cases: combined short flags, `--` separator, help generation, error messages, option validation |
| Help text formatting | Custom help output | Commander.js built-in help | Commander auto-generates help from option definitions. Consistent formatting, handles terminal width. |
| Version display | Custom `--version` handler | `program.version(VERSION)` | Built-in: parses version flag, outputs, exits cleanly. |

**Key insight:** Commander.js is the ONE allowed external dependency specifically for avoiding hand-rolled argument parsing. The rest (template engine, formatting) is trivial enough for native code.

## Common Pitfalls

### Pitfall 1: Commander.js `-v` vs default `-V` for version
**What goes wrong:** Commander.js defaults to `-V, --version`. User expects `-v, --version` (D-13).
**Why it happens:** Commander.js uses uppercase `-V` as default to avoid conflicts with verbose flags.
**How to avoid:** Explicitly set flags: `program.version(VERSION, '-v, --version', 'output the current version')`.
**Warning signs:** Running `usage.mjs -v` shows "error: unknown option '-v'" instead of version.

### Pitfall 2: Async action handler not completing
**What goes wrong:** Async functions in `.action()` silently fail when using `program.parse()` instead of `program.parseAsync()`.
**Why it happens:** `program.parse()` does not await the action handler's Promise.
**How to avoid:** Always use `await program.parseAsync(process.argv)`.
**Warning signs:** Tool exits before API response arrives; no output on cache miss.

### Pitfall 3: Commander.js calling process.exit prematurely
**What goes wrong:** Commander calls `process.exit()` on help, version, or error -- preventing error handling or test cleanup.
**Why it happens:** Commander's default behavior exits on these conditions.
**How to avoid:** Call `program.exitOverride()` to make Commander throw `CommanderError` instead of exiting. Catch and handle via `handleError()`.
**Warning signs:** Tests exit mid-run; custom error handling never executes.

### Pitfall 4: ESM import for Commander.js fails without package.json
**What goes wrong:** `import { Command } from 'commander'` fails if no `package.json` or `node_modules` exists.
**Why it happens:** Node.js ESM resolution requires either a `package.json` with `"type": "module"` or `.mjs` extension AND the package installed locally.
**How to avoid:** Create a minimal `package.json` with `commander` as dependency. Run `npm install` before execution.
**Warning signs:** `ERR_MODULE_NOT_FOUND` error when running `node usage.mjs`.

### Pitfall 5: GLM reset timestamp interpretation
**What goes wrong:** GLM's `nextResetTime` is in **milliseconds** (e.g., `1776304584997`), not seconds. Kimi's `resetTime` is an ISO string.
**Why it happens:** The existing `normalizeResetTime()` multiplies by 1000 assuming seconds. But GLM already returns milliseconds.
**How to avoid:** During parser backport, verify GLM timestamp unit. The CONTEXT.md example shows `1776304584997` which is a 13-digit millisecond timestamp. Current code at line 882 does `resetDate = new Date(resetTime * 1000)` for numbers -- this would be WRONG for millisecond timestamps. Must check: if `resetTime > 1e12`, it is already milliseconds; if `< 1e12`, treat as seconds.
**Warning signs:** Reset time shows year 56000+ instead of hours from now.

### Pitfall 6: Cache structure mismatch after parser backport
**What goes wrong:** After expanding parsers to return nested `quotas[]`, `getCachedUsageData()` still writes flat structure to cache.
**Why it happens:** `getCachedUsageData()` at line 1224 writes `{ timestamp, provider, total, used, ... }` -- must update to new nested format.
**How to avoid:** Update `writeCache()` call in `getCachedUsageData()` to write new structure. Update `readCache()` return to match. Old cache files auto-invalidate (60s TTL).
**Warning signs:** CLI crashes with "cannot read property 'quotas' of undefined" on cache hit.

### Pitfall 7: stdout/stderr mixing with console methods
**What goes wrong:** Using `console.log()` for data output and `console.error()` for errors. While these go to stdout/stderr respectively, `console.log()` adds a trailing newline, and the separation isn't explicit enough for piping scenarios.
**Why it happens:** Habit of using `console.log/error` instead of explicit stream writes.
**How to avoid:** Use `process.stdout.write()` for data output, `process.stderr.write()` for debug/error output. Control newlines explicitly.
**Warning signs:** Piped output `usage.mjs | cat` includes debug messages; `usage.mjs --json | jq` fails with mixed content.

## Code Examples

### Complete Commander.js Setup (verified pattern)
```javascript
// Source: Commander.js official README + README examples
import { Command } from 'commander';

const program = new Command();
program
  .name('usage.mjs')
  .description(DESCRIPTION)
  .version(VERSION, '-v, --version', 'output the current version')
  .option('-j, --json', 'output raw JSON')
  .option('-t, --template <string>', 'custom output template')
  .option('--verbose', 'show debug information')
  .option('-c, --cache-duration <seconds>', 'cache TTL in seconds', parseInt, DEFAULT_CONFIG.cacheDuration)
  .exitOverride()
  .action(async (options) => {
    const data = await getCachedUsageData(options.cacheDuration);
    if (options.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    } else if (options.template) {
      process.stdout.write(applyTemplate(options.template, data) + '\n');
    } else {
      process.stdout.write(formatDefaultOutput(data) + '\n');
    }
  });

await program.parseAsync(process.argv);
```

### Multi-Window Parser (Kimi) - Backport Pattern
```javascript
// Current: parseKimiResponse returns { used, total, reset }
// New: returns { quotas: [{ window, type, total, used, remaining, percent, reset, resetTimestamp }] }

function parseKimiResponseMultiWindow(response) {
  if (!response || typeof response !== 'object') {
    throw new APIError('Invalid Kimi API response: expected JSON object.');
  }

  const quotas = [];

  // Parse usage (overall quota)
  if (response.usage) {
    const usage = response.usage;
    const total = parseInt(usage.limit, 10);
    const remaining = parseInt(usage.remaining, 10);
    const used = total - remaining;
    const resetTime = usage.resetTime;

    quotas.push({
      window: 'overall',
      type: 'usage',
      total,
      used,
      remaining,
      percent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
      reset: resetTime,         // Keep original for normalizeResetTime
      reset_timestamp: null     // ISO string, not timestamp
    });
  }

  // Parse limits (windowed quotas)
  if (response.limits && Array.isArray(response.limits)) {
    for (const limit of response.limits) {
      const durationMin = limit.window?.duration || 300;
      const hours = Math.floor(durationMin / 60);
      const windowLabel = hours > 0 ? `${hours}h` : `${durationMin}m`;

      const detail = limit.detail || limit;
      const total = parseInt(detail.limit, 10);
      const remaining = parseInt(detail.remaining, 10);
      const used = total - remaining;

      quotas.push({
        window: windowLabel,
        type: 'TIME_LIMIT',
        total,
        used,
        remaining,
        percent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
        reset: detail.resetTime,
        reset_timestamp: null
      });
    }
  }

  return { quotas };
}
```

### Multi-Window Parser (GLM) - Backport Pattern
```javascript
function parseGLMResponseMultiWindow(response) {
  if (!response?.data?.limits || !Array.isArray(response.data.limits)) {
    throw new APIError('Invalid GLM API response.');
  }

  const quotas = [];

  for (const limit of response.data.limits) {
    const windowLabel = limit.type === 'TIME_LIMIT'
      ? `${limit.unit * (limit.number || 1)}h`  // e.g., 5h
      : 'weekly';  // TOKENS_LIMIT

    quotas.push({
      window: windowLabel,
      type: limit.type,
      total: limit.usage ?? null,
      used: limit.currentValue ?? null,
      remaining: limit.remaining ?? null,
      percent: limit.percentage ?? 0,
      reset: formatCompactTimeFromTimestamp(limit.nextResetTime),
      reset_timestamp: limit.nextResetTime
    });
  }

  return { quotas };
}
```

### Verbose Output Pattern
```javascript
function verboseLog(message) {
  process.stderr.write(`[debug] ${message}\n`);
}

function outputVerboseInfo(cacheInfo, apiInfo, providerInfo) {
  // Cache status
  verboseLog(`Cache: ${cacheInfo.status} (${cacheInfo.detail})`);

  // Provider detection
  verboseLog(`Provider: ${providerInfo.name} (from ${providerInfo.source})`);

  // API call details
  verboseLog(`API call: ${apiInfo.duration}ms, ${apiInfo.retries} retries, ${apiInfo.url}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Commander.js `program.parse()` for async | `program.parseAsync()` | Commander v5+ | Must use parseAsync or async handlers silently fail |
| Commander.js `-V` for version | Custom `-v` via explicit flags | Always available | Must specify flags explicitly |
| Manual process.argv parsing | Commander.js auto-parsing | Commander.js v1+ | No need to manually handle `--` separator or flag combinations |

**Deprecated/outdated:**
- `program.storeOptionsAsProperties()`: Legacy pattern from Commander < v7. Use `.opts()` instead.
- `require('commander')` in ESM: Use `import { Command } from 'commander'` instead. Commander v8+ supports both.

## Open Questions

1. **GLM timestamp unit (milliseconds vs seconds)**
   - What we know: CONTEXT.md example shows `1776304584997` (13 digits = milliseconds). Current code at line 882 multiplies by 1000 (assumes seconds).
   - What's unclear: Is this consistently milliseconds across all GLM responses, or does it vary?
   - Recommendation: Check during implementation. Add a heuristic: `if (timestamp > 1e12) treat as milliseconds, else seconds`. The existing `normalizeResetTime()` function will need this fix regardless.

2. **Commander.js version flag: `-v` or `-V`?**
   - What we know: D-13 says `--version` or `-v`. Commander defaults to `-V, --version`.
   - What's unclear: Whether `-v` conflicts with any verbose convention.
   - Recommendation: Use `-v, --version` per D-13. Use `--verbose` (no short flag) for verbose mode per CLI-05 which does NOT specify `-V`.

3. **"Most relevant" quota window selection for default output**
   - What we know: D-05 says "shortest reset time (most urgent)". Claude's Discretion allows choosing differently.
   - What's unclear: Whether shortest reset or highest usage percentage is more useful.
   - Recommendation: Use shortest reset time (most urgent window) per D-05. This is what users need to know -- when their next window resets.

4. **Package.json creation**
   - What we know: Project has no `package.json`. Commander.js needs `node_modules` or a bundler.
   - What's unclear: Whether `bun install` vs `npm install` matters. Whether this should be in the repo.
   - Recommendation: Create minimal `package.json` with `commander` dependency. Both `bun install` and `npm install` work. Include `package-lock.json` or `bun.lockb` for reproducibility.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Primary runtime | Yes | 1.3.10 | -- |
| Node.js | Secondary runtime | Yes | 24.14.0 | -- |
| Commander.js | CLI arg parsing | No (not installed) | 14.0.3 (npm registry) | -- |
| npm | Package install | Yes (via Node) | -- | bun install |

**Missing dependencies with no fallback:**
- Commander.js: Must install via `npm install commander@14.0.3` or `bun add commander`. This is a blocking dependency for the CLI entry point.

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (`bun:test`) |
| Config file | None -- Bun auto-discovers `*.test.js` |
| Quick run command | `bun test tests/05-cli-interface.test.js` |
| Full suite command | `bun test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | Default statusLine output format | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| OUT-02 | JSON output with `--json` | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| OUT-03 | Template output with `--template` | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| OUT-04 | Template placeholders substituted correctly | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| OUT-05 | stdout/stderr separation | integration | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-01 | Zero-config auto-detection | integration | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-02 | `--cache-duration` flag | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-03 | `--template` flag | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-04 | `--json` flag | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-05 | `--verbose` flag | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-06 | `--help` / `-h` flag | integration | `bun test tests/05-cli-interface.test.js` | Wave 0 |
| CLI-07 | `--version` / `-v` flag | unit | `bun test tests/05-cli-interface.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test tests/05-cli-interface.test.js`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/05-cli-interface.test.js` -- covers OUT-01~05, CLI-01~07
- [ ] Framework install: `npm install commander@14.0.3` -- Commander.js not yet installed
- [ ] `package.json` creation -- required for Commander.js ESM resolution

## Sources

### Primary (HIGH confidence)
- Commander.js official README (github.com/tj/commander.js) -- full API reference, ESM examples, parseAsync, exitOverride, version flags
- Commander.js options-in-depth docs (github.com/tj/commander.js/blob/master/docs/options-in-depth.md) -- option parsing, custom processing
- npm registry (npmjs.com/package/commander) -- verified version 14.0.3
- Project source code (usage.mjs) -- lines 1-1287, all existing implementations

### Secondary (MEDIUM confidence)
- Commander.js GitHub Issues #505, #806, #1681 -- async action handler behavior
- Phase 03/04 CONTEXT.md files -- established data flow, parser implementations, caching patterns
- CLAUDE.md tech stack -- Commander.js 14.0.3 as approved dependency

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Commander.js is locked decision, version verified on npm
- Architecture: HIGH -- existing code provides clear integration points, Commander.js API well-documented
- Pitfalls: HIGH -- Commander.js async/version/exit issues well-documented in GitHub issues
- Parser backport: MEDIUM -- API response structures documented in CONTEXT.md but edge cases need runtime verification

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- Commander.js 14 is in maintenance mode, no API changes expected)
