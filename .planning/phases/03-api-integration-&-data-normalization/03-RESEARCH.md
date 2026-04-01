# Phase 03: API Integration & Data Normalization - Research

**Researched:** 2026-04-01
**Domain:** API integration with Kimi and GLM providers, response parsing, and data normalization
**Confidence:** MEDIUM-HIGH

## Summary

This phase implements the core API integration layer that queries Kimi and GLM APIs for usage data, parses provider-specific response formats, and normalizes the data into a unified format. The implementation leverages existing HTTP client infrastructure (`fetchWithRetry`) and credential management (`getCredentials`) from Phase 02.

**Primary recommendation:** Implement provider-specific parser functions with strict validation, then normalize to a standard format with human-readable reset times. Use defensive programming for timestamp conversion (detect format, validate ranges, handle edge cases).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Unified Bearer token authentication
- Both Kimi and GLM use `Authorization: Bearer <token>` header
- No custom authentication schemes needed
- Rationale: Simple, consistent, both APIs support standard Bearer auth

**D-02:** Hard-coded endpoint paths
- Kimi: `/coding/v1/usages` (fixed path, no base URL variation)
- GLM: `/api/monitor/usage/quota/limit` (fixed path, no base URL variation)
- No query parameters needed for either endpoint
- Rationale: Both APIs have fixed endpoints, no configuration needed

**D-03:** URL construction using URL constructor
- Use `new URL(endpoint, baseUrl)` for path resolution
- Handles trailing slashes and path joining automatically
- Rationale: Browser-standard API, avoids manual string manipulation errors

**D-04:** Independent parser functions
- `parseKimiResponse(response)` for Kimi API responses
- `parseGLMResponse(response)` for GLM API responses
- Each parser handles its provider's format details
- Rationale: Clear separation, easier testing and maintenance

**D-05:** Direct field access
- Kimi: `response.limits[0]` for quota limits
- GLM: `response.data.limits[0]` for quota limits
- Hard-coded field paths (no mapping configuration)
- Rationale: Simple, direct, formats are stable

**D-06:** Strict validation
- Validate required fields exist before parsing
- Throw APIError if validation fails
- Required fields: `limits` array, quota data
- Rationale: Fail-fast on malformed responses, no silent fallback

**D-07:** Timestamp to human-readable format
- Detect timestamp format (Unix timestamp vs ISO string)
- Convert to "X小时X分钟" format (e.g., "2小时30分")
- Current time used as reference for calculating remaining time
- Rationale: User-friendly display for statusLine

**D-08:** Percentage calculation
- Formula: `Math.round((used / total) * 100, 2)`
- Round to 2 decimal places for readability
- Rationale: Standard percentage calculation, consistent precision

**D-09:** Standardized output structure
```javascript
{
  total: number,       // Total quota
  used: number,        // Used quota
  remaining: number,  // Remaining quota
  percent: number,     // Percentage used (0-100, 2 decimals)
  reset_display: string // Human-readable reset time
  provider: 'kimi' | 'glm'
}
```
- All fields required, no optional fields
- Rationale: Consistent interface regardless of provider

**D-10:** No retry on authentication errors
- 401/403 errors → immediately throw APIError
- No retry attempts for auth failures
- Rationale: Authentication failures require user intervention, not retry

**D-11:** Retry network errors only
- Network errors (ETIMEDOUT, ENOTFOUND, ECONNREFUSED) → retry up to 3 times
- Exponential backoff: 1s, 2s, 4s delays
- Rationale: Transient network issues may resolve, retry improves success rate

**D-12:** Fail immediately on rate limits
- 429 errors → throw APIError immediately
- No retry on rate limit (respects Retry-After header)
- Rationale: Rate limits require backing off, retry won't help

### Claude's Discretion

- Exact error messages wording for API failures
- Whether to include response body in error messages
- Logging/debug output format
- Unit test coverage boundaries

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. All API integration and normalization concerns addressed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Query Kimi API usage via `/coding/v1/usages` endpoint | Section: API Integration > Kimi API |
| API-02 | Query GLM API usage via `/api/monitor/usage/quota/limit` endpoint | Section: API Integration > GLM API |
| API-03 | Parse Kimi response format: `{ usage: [...], limits: [...] }` with duration=300 for 5-minute windows | Section: Response Parsing > Kimi Parser |
| API-04 | Parse GLM response format: `{ data: { limits: [...] } }` with `TIME_LIMIT` type entries | Section: Response Parsing > GLM Parser |
| API-05 | Handle API errors with clear error messages (no silent fallback) | Section: Error Handling |
| NORM-01 | Normalize usage data to standard format: `{ total, used, remaining, percent, reset_display }` | Section: Data Normalization > Output Structure |
| NORM-02 | Calculate percentage: `(used / total) * 100` | Section: Data Normalization > Percentage Calculation |
| NORM-03 | Convert reset time to human-readable format ("X小时X分" or similar) | Section: Data Normalization > Time Formatting |
| NORM-04 | Handle both timestamp (GLM) and ISO string (Kimi) reset time formats | Section: Data Normalization > Timestamp Detection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native Fetch API | Built-in (Node 18+, Bun) | HTTP client for API requests | Zero dependencies, built into both runtimes, leverages existing `fetchWithRetry()` from Phase 02 |
| URL constructor | Built-in (ES6+) | URL construction with base resolution | Browser-standard API, handles path joining automatically per D-03 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | — | — | Project constraints emphasize single-file architecture with zero external dependencies |

**No installation required** — all functionality uses built-in runtime APIs.

**Version verification:** N/A — uses only built-in JavaScript/Node.js/Bun APIs that are guaranteed available by runtime validation (Phase 01).

## Architecture Patterns

### Recommended Function Structure

```
usage.mjs
├── queryProviderAPI(credentials)     // Unified entry point
│   ├── buildAPIUrl(baseUrl, provider) // URL construction
│   ├── makeAPIRequest(url, apiKey)    // HTTP request using fetchWithRetry
│   ├── parseResponse(response, provider) // Provider-specific parsing
│   └── normalizeUsageData(rawData, provider) // Data normalization
│
├── parseKimiResponse(response)       // Kimi-specific parser
├── parseGLMResponse(response)        // GLM-specific parser
│
├── normalizeResetTime(resetTime)     // Timestamp detection & formatting
├── calculatePercentage(used, total)  // Percentage calculation with edge cases
└── formatTimeRemaining(ms)           // Human-readable time formatting
```

### Pattern 1: Provider-Specific Parsers

**What:** Separate parser functions for each provider that validate and extract raw data
**When to use:** Always — required by D-04 for clear separation of concerns
**Example:**

```javascript
// Source: CONTEXT.md D-04, D-05, D-06
function parseKimiResponse(response) {
  // Strict validation per D-06
  if (!response || !response.limits || !Array.isArray(response.limits)) {
    throw new APIError(
      'Invalid Kimi API response: missing or malformed limits array. ' +
      'Expected { limits: [...] } structure.'
    );
  }

  // Per D-05: Direct field access
  const quota = response.limits[0];

  if (!quota) {
    throw new APIError(
      'Invalid Kimi API response: limits array is empty. ' +
      'Expected at least one quota entry.'
    );
  }

  // Extract raw data for normalization
  return {
    used: quota.used,
    total: quota.total,
    reset: quota.reset // ISO string format
  };
}
```

### Pattern 2: Unified Query Entry Point

**What:** Single function that coordinates the entire API query flow
**When to use:** For all provider queries — ensures consistent error handling
**Example:**

```javascript
// Source: Integration flow from CONTEXT.md
async function queryProviderAPI(credentials) {
  const { apiKey, baseUrl, provider } = credentials;

  // 1. Build API endpoint URL (per D-03)
  const url = buildAPIUrl(baseUrl, provider);

  // 2. Make authenticated request (per D-01, D-11)
  const response = await makeAPIRequest(url, apiKey);

  // 3. Parse provider-specific format (per D-04)
  const rawData = parseResponse(response, provider);

  // 4. Normalize to standard format (per D-09)
  return normalizeUsageData(rawData, provider);
}
```

### Pattern 3: Defensive Timestamp Handling

**What:** Detect format, validate ranges, calculate remaining time, format human-readable output
**When to use:** For all reset time conversions (per D-07, NORM-03, NORM-04)
**Example:**

```javascript
// Source: D-07, NORM-03, NORM-04
function normalizeResetTime(resetTime) {
  let resetDate;

  // 1. Detect format (NORM-04)
  if (typeof resetTime === 'number') {
    // Unix timestamp (GLM)
    resetDate = new Date(resetTime * 1000);
  } else if (typeof resetTime === 'string') {
    // ISO string (Kimi)
    resetDate = new Date(resetTime);
  } else {
    throw new APIError(
      `Invalid reset time format: expected number or string, got ${typeof resetTime}`
    );
  }

  // 2. Validate date
  if (isNaN(resetDate.getTime())) {
    throw new APIError(
      `Invalid reset time value: ${resetTime} cannot be converted to valid date`
    );
  }

  // 3. Calculate remaining time
  const now = new Date();
  const remainingMs = resetDate - now;

  // 4. Handle edge cases
  if (remainingMs <= 0) {
    return "已过期"; // Already expired
  }

  // 5. Format as human-readable (D-07)
  return formatTimeRemaining(remainingMs);
}

function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}
```

### Anti-Patterns to Avoid

- **Silent fallback on parse errors:** Violates D-06 (strict validation) and D-12 (fail immediately)
  - **Instead:** Throw APIError with descriptive message including what was expected vs. received

- **Retrying 401/403 errors:** Violates D-10 (no retry on auth errors)
  - **Instead:** Throw APIError immediately, let user fix credentials

- **Assuming timestamp format:** Violates NORM-04 (must handle both formats)
  - **Instead:** Detect format using typeof, validate result, then convert

- **Division by zero in percentage:** Will produce NaN/Infinity in output
  - **Instead:** Validate total > 0 before calculation, throw error if invalid

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client with retry | Custom fetch wrapper | `fetchWithRetry()` from Phase 02 | Already implements D-11 (retry logic), exponential backoff, timeout handling |
| URL construction | String concatenation | `new URL(path, base)` | Built-in API handles edge cases (trailing slashes, protocol resolution) per D-03 |
| Credential management | Manual env var reading | `getCredentials()` from Phase 02 | Handles proxy detection, provider detection, credential extraction |
| Error classes | Generic Error | `APIError`, `NetworkError` from Phase 02 | Semantic exit codes (4 for API errors), consistent error handling |

**Key insight:** Phase 02 already established robust infrastructure. This phase focuses on API-specific logic (parsers, normalizers) rather than rebuilding HTTP/auth layers.

## Runtime State Inventory

> Not applicable — this phase involves code-only changes with no runtime state (no databases, services, OS registrations, or build artifacts to migrate).

## Common Pitfalls

### Pitfall 1: Incorrect URL Construction

**What goes wrong:** String concatenation produces malformed URLs when baseUrl has trailing slash or missing protocol
**Why it happens:** Manual path joining doesn't handle edge cases like `https://api.com/` + `/path` → `https://api.com//path`
**How to avoid:** Use `new URL(endpoint, baseUrl)` constructor per D-03 — it normalizes slashes automatically
**Warning signs:** API returns 404, URL looks malformed in error messages

**Example:**
```javascript
// ❌ Wrong - manual concatenation
const url = baseUrl + '/coding/v1/usages'; // Doubles slash if baseUrl ends with /

// ✅ Right - URL constructor
const url = new URL('/coding/v1/usages', baseUrl).toString();
```

### Pitfall 2: Accessing Wrong Field Path

**What goes wrong:** Kimi uses `response.limits[0]` but GLM uses `response.data.limits[0]` — mixing them causes undefined errors
**Why it happens:** Response structures differ between providers, easy to copy-paste wrong path
**How to avoid:** Strictly follow D-05 field paths, validate each parser independently with provider-specific test data
**Warning signs:** `Cannot read property 'used' of undefined` errors

**Example:**
```javascript
// ❌ Wrong - using GLM path for Kimi
function parseKimiResponse(response) {
  const quota = response.data.limits[0]; // undefined - Kimi doesn't have .data
}

// ✅ Right - per D-05
function parseKimiResponse(response) {
  const quota = response.limits[0]; // Correct
}
```

### Pitfall 3: Unix Timestamp Unit Confusion

**What goes wrong:** GLM returns Unix timestamp in seconds, but JavaScript Date expects milliseconds → dates in 1970
**Why it happens:** Unix timestamps are traditionally seconds, but JS Date uses milliseconds
**How to avoid:** Always multiply Unix timestamps by 1000 before passing to Date constructor (see Pattern 3 example)
**Warning signs:** Reset time shows as "52年前" (52 years ago) or similar ancient date

**Example:**
```javascript
// ❌ Wrong - treats seconds as milliseconds
const date = new Date(1743894733); // 1970-01-21

// ✅ Right - convert seconds to milliseconds
const date = new Date(1743894733 * 1000); // 2025-04-05
```

### Pitfall 4: Division by Zero

**What goes wrong:** `total = 0` causes percentage calculation to return `NaN` or `Infinity`
**Why it happens:** Some API responses may have `total: 0` for unlimited quotas or error states
**How to avoid:** Validate `total > 0` before division, throw descriptive error if invalid (see Anti-Patterns)
**Warning signs:** Output shows `NaN%` or `Infinity%`

**Example:**
```javascript
// ❌ Wrong - no validation
function calculatePercentage(used, total) {
  return Math.round((used / total) * 100, 2);
}

// ✅ Right - validate first
function calculatePercentage(used, total) {
  if (total <= 0) {
    throw new APIError(
      `Invalid quota total: ${total}. Total must be greater than zero.`
    );
  }
  return Math.round((used / total) * 100, 2);
}
```

### Pitfall 5: Negative Remaining Time Display

**What goes wrong:** Reset time already passed, but code displays negative time like "-2小时-15分钟"
**Why it happens:** Code calculates remaining time without checking if it's in the past
**How to avoid:** Check `remainingMs <= 0` before formatting, return special message like "已过期" (see Pattern 3)
**Warning signs:** Negative numbers in output, confusing user experience

## Code Examples

Verified patterns from CONTEXT.md and web research:

### Kimi API Request

```javascript
// Source: CONTEXT.md D-01, D-02, D-03
async function queryKimiAPI(baseUrl, apiKey) {
  const url = new URL('/coding/v1/usages', baseUrl).toString();

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: DEFAULT_CONFIG.timeout,
    maxAttempts: DEFAULT_CONFIG.maxRetries
  });

  if (!response.ok) {
    throw new APIError(
      `Kimi API request failed with status ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  return response.json();
}
```

### GLM API Request

```javascript
// Source: GitHub issue #1588 (cc-switch), CONTEXT.md D-01, D-02, D-03
async function queryGLMAPI(baseUrl, apiKey) {
  const url = new URL('/api/monitor/usage/quota/limit', baseUrl).toString();

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Authorization': apiKey, // GLM uses raw token, not "Bearer" prefix
      'Content-Type': 'application/json'
    },
    timeout: DEFAULT_CONFIG.timeout,
    maxAttempts: DEFAULT_CONFIG.maxRetries
  });

  if (!response.ok) {
    throw new APIError(
      `GLM API request failed with status ${response.status}: ${response.statusText}`,
      response.status
    );
  }

  return response.json();
}
```

**Note:** GLM authentication may use raw token instead of "Bearer" prefix based on cc-switch examples. Verify with actual API testing.

### Kimi Response Parser

```javascript
// Source: CONTEXT.md D-04, D-05, D-06, REQUIREMENTS.md API-03
function parseKimiResponse(response) {
  // Strict validation per D-06
  if (!response || typeof response !== 'object') {
    throw new APIError('Invalid Kimi API response: expected JSON object');
  }

  if (!response.limits || !Array.isArray(response.limits)) {
    throw new APIError(
      'Invalid Kimi API response: missing or malformed limits array. ' +
      'Expected { usage: [...], limits: [...] } structure.'
    );
  }

  // Per D-05: Direct field access to limits[0]
  const quota = response.limits[0];

  if (!quota) {
    throw new APIError(
      'Invalid Kimi API response: limits array is empty. ' +
      'Expected at least one quota entry with duration=300 (5-minute window).'
    );
  }

  // Validate required fields
  if (typeof quota.used !== 'number' || typeof quota.total !== 'number') {
    throw new APIError(
      'Invalid Kimi quota data: used and total must be numbers. ' +
      `Got used=${typeof quota.used}, total=${typeof quota.total}`
    );
  }

  if (!quota.reset) {
    throw new APIError(
      'Invalid Kimi quota data: missing reset field. ' +
      'Expected ISO 8601 timestamp string.'
    );
  }

  // Return raw data for normalization
  return {
    used: quota.used,
    total: quota.total,
    reset: quota.reset // ISO string format per API-03
  };
}
```

### GLM Response Parser

```javascript
// Source: GitHub issue #1588 (cc-switch), CONTEXT.md D-04, D-05, D-06, REQUIREMENTS.md API-04
function parseGLMResponse(response) {
  // Strict validation per D-06
  if (!response || typeof response !== 'object') {
    throw new APIError('Invalid GLM API response: expected JSON object');
  }

  // GLM wraps data in { data: { limits: [...] } } per API-04
  if (!response.data || !response.data.limits || !Array.isArray(response.data.limits)) {
    throw new APIError(
      'Invalid GLM API response: missing or malformed data.limits array. ' +
      'Expected { data: { limits: [...] } } structure.'
    );
  }

  // Find TIME_LIMIT entry (per API-04)
  const quota = response.data.limits.find(limit => limit.type === 'TIME_LIMIT');

  if (!quota) {
    throw new APIError(
      'Invalid GLM API response: no TIME_LIMIT entry found in limits array. ' +
      'Expected at least one entry with type="TIME_LIMIT".'
    );
  }

  // Validate required fields
  if (typeof quota.used !== 'number' || typeof quota.total !== 'number') {
    throw new APIError(
      'Invalid GLM quota data: used and total must be numbers. ' +
      `Got used=${typeof quota.used}, total=${typeof quota.total}`
    );
  }

  if (!quota.reset) {
    throw new APIError(
      'Invalid GLM quota data: missing reset field. ' +
      'Expected Unix timestamp number.'
    );
  }

  // Return raw data for normalization
  return {
    used: quota.used,
    total: quota.total,
    reset: quota.reset // Unix timestamp per API-04
  };
}
```

### Data Normalizer

```javascript
// Source: CONTEXT.md D-07, D-08, D-09, NORM-01~04
function normalizeUsageData(rawData, provider) {
  const { used, total, reset } = rawData;

  // Calculate percentage per D-08, NORM-02
  const percent = calculatePercentage(used, total);

  // Calculate remaining
  const remaining = total - used;

  // Convert reset time per D-07, NORM-03, NORM-04
  const reset_display = normalizeResetTime(reset);

  // Standard output structure per D-09, NORM-01
  return {
    total,
    used,
    remaining,
    percent,
    reset_display,
    provider
  };
}

function calculatePercentage(used, total) {
  // Edge case protection
  if (total <= 0) {
    throw new APIError(
      `Invalid quota total: ${total}. Total must be greater than zero to calculate percentage.`
    );
  }

  // Per D-08: Round to 2 decimal places
  return Math.round((used / total) * 100, 2);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|---------|
| Retry all HTTP errors | Retry only network/5xx errors (D-10, D-11) | Phase 02 | Reduces unnecessary API load, faster failure on client errors |
| Generic error messages | Provider-specific error messages with context | This phase | Better debugging, clearer user guidance |
| Single timestamp format | Dual format detection (ISO + Unix) (NORM-04) | This phase | Handles both Kimi and GLM APIs without configuration |

**Deprecated/outdated:**
- **axios/got for HTTP requests:** Replaced by native fetch in Phase 01 (zero dependencies, built-in retry in Phase 02)
- **Manual env var reading:** Replaced by `getCredentials()` in Phase 02 (handles proxy detection, provider routing)

## Open Questions

1. **GLM Authentication Header Format**
   - What we know: Kimi uses `Authorization: Bearer <token>` (confirmed in D-01)
   - What's unclear: GLM examples show raw token without "Bearer" prefix, but not explicitly documented
   - Recommendation: Implement with raw token first, add "Bearer" if API returns 401. Add test to verify which format works.

2. **Kimi `/coding/v1/usages` Endpoint Response Structure**
   - What we know: CONTEXT.md specifies `{ usage: [...], limits: [...] }` with ISO string reset times
   - What's unclear: Could not find official documentation for this specific endpoint (searched platform.kimi.com, platform.moonshot.cn)
   - Recommendation: Trust CONTEXT.md specification (user decision), implement strict validation to catch format mismatches during testing

3. **Over-Quota Handling (used > total)**
   - What we know: Percentage formula `(used / total) * 100` will produce values > 100
   - What's unclear: Should we cap at 100%, show actual percentage, or throw error?
   - Recommendation: Show actual percentage (may exceed 100%), let users see over-quota state. Add warning if percent > 100.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Native Fetch API | HTTP requests | ✓ | Built-in (Node 18+, Bun) | — |
| URL constructor | URL building | ✓ | Built-in (ES6+) | — |
| Date API | Timestamp conversion | ✓ | Built-in | — |
| fetchWithRetry() | HTTP with retry | ✓ | Phase 02 | — |
| getCredentials() | Auth management | ✓ | Phase 02 | — |
| APIError, NetworkError | Error handling | ✓ | Phase 02 | — |

**Missing dependencies with no fallback:**
- None — all required infrastructure from Phase 02 is available

**Missing dependencies with fallback:**
- None — no external dependencies required

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test runner (built-in) |
| Config file | None — see Wave 0 |
| Quick run command | `bun test tests/03-api-integration.test.js` |
| Full suite command | `bun test` (runs all tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | Query Kimi API endpoint | integration | `bun test tests/03-api-integration.test.js::testKimiAPIQuery` | ❌ Wave 0 |
| API-02 | Query GLM API endpoint | integration | `bun test tests/03-api-integration.test.js::testGLMAPIQuery` | ❌ Wave 0 |
| API-03 | Parse Kimi response format | unit | `bun test tests/03-api-integration.test.js::testKimiParser` | ❌ Wave 0 |
| API-04 | Parse GLM response format | unit | `bun test tests/03-api-integration.test.js::testGLMParser` | ❌ Wave 0 |
| API-05 | API error handling | unit | `bun test tests/03-api-integration.test.js::testAPIErrors` | ❌ Wave 0 |
| NORM-01 | Normalize to standard format | unit | `bun test tests/03-api-integration.test.js::testNormalizeData` | ❌ Wave 0 |
| NORM-02 | Percentage calculation | unit | `bun test tests/03-api-integration.test.js::testPercentageCalc` | ❌ Wave 0 |
| NORM-03 | Human-readable time formatting | unit | `bun test tests/03-api-integration.test.js::testTimeFormatting` | ❌ Wave 0 |
| NORM-04 | Dual timestamp format handling | unit | `bun test tests/03-api-integration.test.js::testTimestampDetection` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test tests/03-api-integration.test.js` (quick validation)
- **Per wave merge:** `bun test` (full suite to catch regressions)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/03-api-integration.test.js` — covers all API-01~05, NORM-01~04 requirements
- [ ] `tests/conftest.js` — add shared fixtures for mock API responses (if not already present)
- [ ] Mock API server setup for integration tests (optional, or use recorded responses)

**Test coverage strategy:**
- Unit tests for parsers (validate field extraction, error cases)
- Unit tests for normalizers (timestamp detection, percentage calc, edge cases)
- Integration tests for full query flow (mock HTTP responses with realistic data)
- Error scenario tests (401, 429, 5xx, malformed JSON, missing fields)

## Sources

### Primary (HIGH confidence)
- CONTEXT.md (phase context) - User decisions from `/gsd:discuss-phase`, locked implementation choices
- REQUIREMENTS.md - Project requirements API-01~05, NORM-01~04
- usage.mjs (Phase 02 implementation) - Existing HTTP client, error classes, credential management
- GitHub issue #1588 (cc-switch) - GLM API response format verification: `{ data: { limits: [...] } }` with `TIME_LIMIT` type

### Secondary (MEDIUM confidence)
- Kimi API platform (platform.kimi.com) - General API structure, but `/coding/v1/usages` endpoint not documented
- Moonshot API docs (platform.moonshot.cn) - Rate limit documentation, error response formats

### Tertiary (LOW confidence)
- Web search for Kimi `/coding/v1/usages` endpoint - Could not find official documentation, relying on CONTEXT.md specification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only built-in APIs, no external dependencies
- Architecture: HIGH - Patterns established in CONTEXT.md with clear examples
- API formats: MEDIUM - GLM format verified via cc-switch, Kimi format from CONTEXT.md (not found in official docs)
- Pitfalls: HIGH - Common JavaScript/HTTP issues well-documented

**Research date:** 2026-04-01
**Valid until:** 30 days (API formats stable, but may change with provider updates)
