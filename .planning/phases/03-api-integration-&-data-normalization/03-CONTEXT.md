# Phase 03: API Integration & Data Normalization - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Kimi and GLM API integration with unified data normalization. This phase delivers:
- Kimi API query via `/coding/v1/usages` endpoint
- GLM API query via `/api/monitor/usage/quota/limit` endpoint
- Response parsing for both provider formats
- Unified data normalization to standard format
- Error handling for API failures

**What this phase does NOT include:**
- Caching layer (Phase 4)
- CLI interface (Phase 5)
- Output formatting (Phase 5)

</domain>

<decisions>
## Implementation Decisions

### API Request Format

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

### Response Parsing

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

### Data Normalization

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

### Error Handling

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full requirements list (API-01~05, NORM-01~04)
- `.planning/STATE.md` — Current project state, Phase 02 completion status

### Prior Phase Context
- `.planning/phases/02-proxy-penetration-provider-detection/02-CONTEXT.md` — Provider detection, credential extraction
- Phase 02 established:
  - `getCredentials()` returns `{ apiKey, baseUrl?, provider }`
  - `detectProvider()` identifies 'kimi' or 'glm'
  - Error classes: `ConfigError`, `APIError`, `NetworkError`

### Code References
- `usage.mjs` — Existing HTTP client infrastructure:
  - `fetchWithTimeout()` — HTTP client with timeout and retry
  - `NetworkError`, `APIError` — Error classes for network/API failures
  - `DEFAULT_CONFIG` — Timeout: 5000ms, maxRetries: 3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchWithTimeout(url, options)`: HTTP client with 5s timeout, 3 retries
  - Already implements retry logic with exponential backoff
  - Use for all API calls in this phase
- `getCredentials()`: Returns `{ apiKey, baseUrl?, provider }`
  - Provides authentication token and provider detection
  - Call at start of API query flow
- `NetworkError`, `APIError`: Error classes
  - Use for network failures and API errors respectively
  - Provides semantic exit codes (3, 4)

### Established Patterns
- **Error handling:** Use semantic error classes (ConfigError, NetworkError, APIError)
- **HTTP requests:** Use `fetchWithTimeout()` for all external API calls
- **Fail-fast principle:** Throw errors immediately, no silent fallback
- **Modular functions:** Small, focused functions with single responsibility

### Integration Points
- API query flow:
  1. Call `getCredentials()` to get apiKey and provider
  2. Build API endpoint URL using provider
  3. Make HTTP request with Bearer token
  4. Parse response with provider-specific parser
  5. Normalize data to standard format
  6. Return normalized usage data

</code_context>

<specifics>
## Specific Ideas

**API Endpoint Details (from user discussion):**
- Kimi: `https://api.kimi.com/coding/v1/usages`
  - Method: GET
  - Headers: `Authorization: Bearer <token>`
  - No query parameters
  - Response: `{ usage: [...], limits: [...] }`

- GLM: `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
  - Method: GET
  - Headers: `Authorization: Bearer <token>`
  - No query parameters
  - Response: `{ data: { limits: [...] } }`

**Data Normalization Examples:**
- Kimi reset time: `"2026-04-06T03:33:46.648544Z"` (ISO string) → "2小时30分"
- GLM reset time: `1743894733` (Unix timestamp) → "2小时30分"
- Percentage: `(used / total) * 100` rounded to 2 decimal places

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. All API integration and normalization concerns addressed.

</deferred>

---

*Phase: 03-api-integration-&-data-normalization*
*Context gathered: 2026-04-01*
