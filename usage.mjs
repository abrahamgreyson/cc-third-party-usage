#!/usr/bin/env node

///// Metadata /////

const VERSION = '1.0.0';
const DESCRIPTION = 'AI API Usage Monitor - Query Kimi and GLM API usage with CC Switch proxy detection';

///// Constants & Configuration /////

const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  CONFIG_ERROR: 2,
  NETWORK_ERROR: 3,
  API_ERROR: 4,
};

const DEFAULT_CONFIG = {
  cacheDuration: 60,
  timeout: 5000,
  maxRetries: 3,
  initialRetryDelay: 1000,
  maxRetryDelay: 10000,
};

// Placeholder for remaining sections (to be implemented in subsequent tasks)
///// Utility Functions /////
///// Error Classes /////

/**
 * Base error class for CLI errors with semantic exit codes.
 * Provides actionable error messages without stack traces in production.
 */
class CliError extends Error {
  constructor(message, exitCode = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/**
 * General usage error. Exit code 1.
 * Used for runtime errors that don't fit other categories.
 */
class UsageError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.ERROR);
    this.name = 'UsageError';
  }
}

/**
 * Configuration error. Exit code 2.
 * Used for missing/invalid config, environment variables, or credentials.
 */
class ConfigError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.CONFIG_ERROR);
    this.name = 'ConfigError';
  }
}

/**
 * Network error. Exit code 3.
 * Used for connection failures, timeouts, DNS errors.
 */
class NetworkError extends CliError {
  constructor(message, originalError = null) {
    super(message, EXIT_CODES.NETWORK_ERROR);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * API error. Exit code 4.
 * Used for API response errors, authentication failures, rate limits.
 */
class APIError extends CliError {
  constructor(message, statusCode = null) {
    super(message, EXIT_CODES.API_ERROR);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

/**
 * Error handler that outputs to stderr and exits with appropriate code.
 * @param {Error} error - The error to handle
 */
function handleError(error) {
  if (error instanceof CliError) {
    console.error(`Error: ${error.message}`);
    process.exit(error.exitCode);
  } else {
    console.error('Unexpected error:', error.message);
    process.exit(EXIT_CODES.ERROR);
  }
}
///// Runtime Detection /////

/**
 * Detects the current JavaScript runtime.
 * @returns {'bun' | 'node'} The detected runtime name
 * @throws {ConfigError} If running on unsupported runtime
 */
function detectRuntime() {
  if (typeof process.versions.bun !== 'undefined') {
    return 'bun';
  }
  if (typeof process.versions.node !== 'undefined') {
    return 'node';
  }
  throw new ConfigError(
    'Unsupported runtime. This tool requires Bun 1.3.10+ or Node.js 22.5.0+.'
  );
}

/**
 * Returns detailed runtime information for debugging.
 * @returns {{ name: string, version: string }}
 */
function getRuntimeInfo() {
  const runtime = detectRuntime();
  const version = runtime === 'bun'
    ? process.versions.bun
    : process.versions.node;
  return { name: runtime, version };
}

/**
 * Checks if the runtime version meets minimum requirements.
 * @param {string} runtime - The runtime name ('bun' or 'node')
 * @returns {boolean} True if version is supported
 */
function isSupportedVersion(runtime) {
  const version = runtime === 'bun'
    ? process.versions.bun
    : process.versions.node;

  const [major, minor, patch] = version.split('.').map(Number);

  if (runtime === 'bun') {
    // Bun 1.3.10+ required
    return major >= 1 && (major > 1 || minor >= 3);
  }
  if (runtime === 'node') {
    // Node.js 22.5.0+ required for node:sqlite
    return major >= 22 && (major > 22 || minor >= 5);
  }
  return false;
}

/**
 * Validates runtime and throws clear error if unsupported.
 * @throws {ConfigError} If runtime version is too old
 */
function validateRuntime() {
  const { name, version } = getRuntimeInfo();

  if (!isSupportedVersion(name)) {
    const required = name === 'bun'
      ? 'Bun 1.3.10+'
      : 'Node.js 22.5.0+';
    throw new ConfigError(
      `${name.charAt(0).toUpperCase() + name.slice(1)} version ${version} is not supported. ` +
      `This tool requires ${required} or later.`
    );
  }
}
///// Database Layer /////

let Database = null;
let PreparedStatement = null;

/**
 * Load the appropriate SQLite module based on runtime.
 * Must be called before any database operations.
 * @throws {ConfigError} If SQLite module not available for runtime
 */
async function loadDatabaseModule() {
  const runtime = detectRuntime();

  try {
    if (runtime === 'bun') {
      // Bun runtime - use bun:sqlite
      const module = await import('bun:sqlite');
      Database = module.Database;
      // Note: bun:sqlite Database class has prepare() method
    } else if (runtime === 'node') {
      // Node.js runtime - use node:sqlite
      const module = await import('node:sqlite');
      Database = module.DatabaseSync;
      // Note: node:sqlite uses DatabaseSync class
    } else {
      throw new ConfigError(
        `SQLite not supported on runtime: ${runtime}. ` +
        `This tool requires Bun 1.3.10+ or Node.js 22.5.0+.`
      );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(
      `Failed to load SQLite module: ${error.message}. ` +
      `Ensure you are running on Bun 1.3.10+ or Node.js 22.5.0+.`
    );
  }
}

/**
 * Check if database module is loaded.
 * @returns {boolean}
 */
function isDatabaseLoaded() {
  return Database !== null;
}

/**
 * Open SQLite database with WAL mode and busy timeout configured.
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Promise<Object>} Database instance
 * @throws {ConfigError} If database cannot be opened
 */
async function openDatabase(dbPath) {
  if (!isDatabaseLoaded()) {
    await loadDatabaseModule();
  }

  try {
    const db = new Database(dbPath);

    // Configure WAL mode for concurrent read/write access
    // WAL mode allows multiple readers while one writer is active
    const runtime = detectRuntime();
    if (runtime === 'bun') {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA busy_timeout = 10000');
    } else {
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA busy_timeout = 10000');
    }

    return db;
  } catch (error) {
    throw new ConfigError(
      `Failed to open database at ${dbPath}: ${error.message}. ` +
      `Verify the file exists and is readable.`
    );
  }
}

/**
 * Close database connection.
 * @param {Object} db - Database instance to close
 */
function closeDatabase(db) {
  if (db && typeof db.close === 'function') {
    db.close();
  }
}
///// HTTP Client /////

/**
 * Sleep for specified milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error or response is retryable.
 * @param {Error|null} error - Error to check
 * @param {Response|null} response - Response to check
 * @returns {boolean} True if retryable
 */
function isRetryableError(error, response) {
  // 4xx client errors are NOT retryable (user decision from discussion log)
  // Exception: 429 (rate limit) and 408 (request timeout) are retryable
  if (response) {
    if (response.status >= 400 && response.status < 500) {
      return response.status === 429 || response.status === 408;
    }
    // 5xx server errors are retryable
    if (response.status >= 500) {
      return true;
    }
  }

  // Network errors are retryable
  if (error) {
    const networkErrorCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];
    if (error.code && networkErrorCodes.includes(error.code)) {
      return true;
    }
    // NetworkError from our error classes
    if (error.name === 'NetworkError' || error instanceof NetworkError) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch with timeout using AbortController.
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @returns {Promise<Response>} - Fetch Response
 * @throws {NetworkError} On timeout or network failure
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeout = DEFAULT_CONFIG.timeout, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new NetworkError(
        `Request timed out after ${timeout}ms. ` +
        `Check your network connection or increase timeout.`
      );
    }

    throw new NetworkError(
      `Network request failed: ${error.message}. ` +
      `Check your network connection and try again.`,
      error
    );
  }
}

/**
 * Fetch with retry and exponential backoff.
 * User decision: 1s, 2s, 4s backoff, max 3 retries, no retry on 4xx.
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} options.maxAttempts - Max retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial retry delay in ms (default: 1000)
 * @param {number} options.maxDelay - Max retry delay in ms (default: 10000)
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @returns {Promise<Response>} - Fetch Response
 * @throws {NetworkError|APIError} On failure after retries
 */
async function fetchWithRetry(url, options = {}) {
  const {
    maxAttempts = DEFAULT_CONFIG.maxRetries,
    initialDelay = DEFAULT_CONFIG.initialRetryDelay,
    maxDelay = DEFAULT_CONFIG.maxRetryDelay,
    timeout = DEFAULT_CONFIG.timeout,
    ...fetchOptions
  } = options;

  let lastError;
  let lastResponse;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
      });

      // Check for HTTP errors
      if (!response.ok) {
        // For 4xx errors (except 429 and 408), throw immediately without retry (user decision)
        if (response.status >= 400 && response.status < 500 &&
            response.status !== 429 && response.status !== 408) {
          throw new APIError(
            `API request failed with status ${response.status}: ${response.statusText}. ` +
            `Check your API credentials and request parameters.`,
            response.status
          );
        }

        // For 5xx, 429, 408, check if we should retry
        if (isRetryableError(null, response)) {
          lastResponse = response;
          lastError = new APIError(
            `API request failed with status ${response.status}. ` +
            `Attempt ${attempt}/${maxAttempts}. Retrying...`,
            response.status
          );

          // Respect Retry-After header for 429
          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) {
              const retryDelay = parseInt(retryAfter) * 1000;
              delay = Math.min(retryDelay, maxDelay);
            }
          }

          if (attempt < maxAttempts) {
            await sleep(delay);
            delay = Math.min(delay * 2, maxDelay); // Exponential backoff
            continue;
          }

          throw new APIError(
            `API request failed after ${maxAttempts} attempts. ` +
            `Last status: ${response.status}. Check API availability.`,
            response.status
          );
        }

        // Non-retryable server error
        throw new APIError(
          `API request failed with status ${response.status}: ${response.statusText}.`,
          response.status
        );
      }

      return response;

    } catch (error) {
      lastError = error;

      // Don't retry on AbortError (timeout) - already handled by fetchWithTimeout
      if (error.name === 'NetworkError' && error.message.includes('timed out')) {
        throw error;
      }

      // Check if error is retryable
      if (isRetryableError(error, null)) {
        if (attempt < maxAttempts) {
          await sleep(delay);
          delay = Math.min(delay * 2, maxDelay);
          continue;
        }

        throw new NetworkError(
          `Request failed after ${maxAttempts} attempts. ` +
          `Last error: ${error.message}`,
          error
        );
      }

      // Non-retryable error (e.g., APIError for 4xx)
      throw error;
    }
  }

  throw lastError;
}
///// Service Layer /////

///// Path Utilities /////

import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { readFile as fsReadFile, writeFile as fsWriteFile, rename as fsRename, unlink as fsUnlink } from 'fs/promises';

/**
 * Expands ~ in path to user's home directory.
 * Cross-platform compatible (macOS, Linux, Windows).
 * Per D-03: Fixed database path ~/.cc-switch/cc-switch.db needs ~ expansion.
 * @param {string} path - Path that may contain ~
 * @returns {string} Path with ~ expanded
 */
function expandHomePath(path) {
  if (path.startsWith('~/')) {
    return homedir() + path.slice(1);
  }
  if (path === '~') {
    return homedir();
  }
  return path;
}

///// Credential Extraction /////

// CC Switch database path (per D-03)
const CC_SWITCH_DB_PATH = '~/.cc-switch/cc-switch.db';

/**
 * Extracts API credentials from CC Switch SQLite database.
 * Per D-03: Fixed database path ~/.cc-switch/cc-switch.db
 * Per D-04: Query providers table, settings_config field, id='default'
 * Per D-06: Fail-fast with ConfigError, no fallback to env vars
 * @returns {Promise<{ apiKey: string, baseUrl: string }>}
 * @throws {ConfigError} If database unreadable or credentials missing
 */
async function getProxyCredentials() {
  const dbPath = expandHomePath(CC_SWITCH_DB_PATH);
  let db;

  try {
    db = await openDatabase(dbPath);
  } catch (error) {
    throw new ConfigError(
      `Failed to open CC Switch database at ${dbPath}: ${error.message}. ` +
      'Verify CC Switch is installed and configured.'
    );
  }

  try {
    const result = db.prepare('SELECT settings_config FROM providers WHERE id = ?').get('default');

    if (!result || !result.settings_config) {
      throw new ConfigError(
        'CC Switch database has no default provider configuration. ' +
        'Verify CC Switch is properly configured.'
      );
    }

    let config;
    try {
      config = JSON.parse(result.settings_config);
    } catch (parseError) {
      throw new ConfigError(
        `Failed to parse CC Switch configuration: ${parseError.message}. ` +
        'Database may be corrupted. Try reconfiguring CC Switch.'
      );
    }

    const apiKey = config.env?.ANTHROPIC_AUTH_TOKEN;
    const baseUrl = config.env?.ANTHROPIC_BASE_URL;

    if (!apiKey) {
      throw new ConfigError(
        'CC Switch database missing ANTHROPIC_AUTH_TOKEN. ' +
        'Expected env.ANTHROPIC_AUTH_TOKEN in settings_config. ' +
        'Verify CC Switch is properly configured.'
      );
    }

    if (!baseUrl) {
      throw new ConfigError(
        'CC Switch database missing ANTHROPIC_BASE_URL. ' +
        'Expected env.ANTHROPIC_BASE_URL in settings_config. ' +
        'Verify CC Switch is properly configured.'
      );
    }

    return { apiKey, baseUrl };
  } finally {
    closeDatabase(db);
  }
}

/**
 * Reads API credentials from environment variables.
 * Per D-07: Read ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN
 * Used when no CC Switch proxy is detected.
 * @returns {{ apiKey: string }}
 * @throws {ConfigError} If no credentials found in environment
 */
function getEnvCredentials() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

  if (!apiKey) {
    throw new ConfigError(
      'No API credentials found. ' +
      'Set ANTHROPIC_API_KEY environment variable, ' +
      'or configure CC Switch proxy for automatic credential detection.'
    );
  }

  return { apiKey };
}

/**
 * Unified credential resolution entry point.
 * Coordinates proxy detection and credential extraction.
 * Per D-06: No fallback to env vars when proxy detected
 * Per D-07: Use env vars when no proxy detected
 * @returns {Promise<{ apiKey: string, baseUrl?: string, provider: 'kimi' | 'glm' | null }>}
 * @throws {ConfigError} If credentials cannot be obtained
 */
async function getCredentials() {
  if (isProxyEnabled()) {
    // Proxy detected - extract from database (per D-06, no fallback)
    const { apiKey, baseUrl } = await getProxyCredentials();
    const provider = detectProvider(baseUrl);
    return { apiKey, baseUrl, provider };
  } else {
    // No proxy - use environment variables (per D-07)
    const { apiKey } = getEnvCredentials();
    // Provider will be detected later when making API calls
    return { apiKey, provider: null };
  }
}

///// Proxy Detection /////

/**
 * Returns the list of local address patterns that indicate proxy usage.
 * Per D-02: Support localhost, 127.0.0.1, 0.0.0.0
 * @returns {string[]}
 */
function getLocalAddressPatterns() {
  return ['localhost', '127.0.0.1', '0.0.0.0'];
}

/**
 * Detects if CC Switch proxy is enabled by checking environment variables.
 * Per D-01: Check only ANTHROPIC_BASE_URL and BASE_URL
 * Per D-02: Match against localhost, 127.0.0.1, 0.0.0.0
 * @returns {boolean} True if proxy is detected
 */
function isProxyEnabled() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || process.env.BASE_URL;
  if (!baseUrl) return false;

  const localPatterns = getLocalAddressPatterns();
  return localPatterns.some(pattern => baseUrl.includes(pattern));
}

///// Provider Detection /////

/**
 * Detects provider type based on baseUrl domain.
 * Per D-05: kimi.com → Kimi, bigmodel.cn → GLM, others → ConfigError
 * @param {string} baseUrl - The API base URL
 * @returns {'kimi' | 'glm'} Provider type
 * @throws {ConfigError} If provider is not supported
 */
function detectProvider(baseUrl) {
  let hostname;
  try {
    const url = new URL(baseUrl);
    hostname = url.hostname;
  } catch (error) {
    throw new ConfigError(
      `Invalid API base URL: ${baseUrl}. ` +
      'URL must be a valid HTTP/HTTPS endpoint.'
    );
  }

  // Per D-05: Domain-based provider detection
  // Note: Only support Kimi and GLM (Mainland China), not ZAI (overseas)
  if (hostname.includes('kimi.com')) {
    return 'kimi';
  }
  if (hostname.includes('bigmodel.cn')) {
    return 'glm';
  }

  throw new ConfigError(
    `Unsupported API provider: ${hostname}. ` +
    'This tool only supports Kimi (kimi.com) and GLM (bigmodel.cn) providers.'
  );
}

///// API Integration /////

/**
 * API endpoint paths per provider.
 * Per D-02: Hard-coded paths, no configuration needed.
 */
const API_ENDPOINTS = {
  kimi: '/coding/v1/usages',
  glm: '/api/monitor/usage/quota/limit'
};

/**
 * Build provider-specific API URL.
 * Per D-03: Use URL constructor for path resolution.
 * @param {string} baseUrl - Provider base URL (e.g., 'https://api.kimi.com')
 * @param {string} provider - Provider type ('kimi' or 'glm')
 * @returns {string} Complete API endpoint URL
 * @throws {ConfigError} If provider is unknown
 */
function buildAPIUrl(baseUrl, provider) {
  const path = API_ENDPOINTS[provider];
  if (!path) {
    throw new ConfigError(
      `Unknown provider: ${provider}. ` +
      `This tool only supports 'kimi' and 'glm' providers.`
    );
  }

  // Per D-03: URL constructor handles trailing slashes and path joining
  return new URL(path, baseUrl).toString();
}

/**
 * Query Kimi API for usage data.
 * Per D-01: Uses Bearer token authentication.
 * Per D-10/D-12: No retry on 401/403/429 errors.
 * @param {string} baseUrl - Kimi API base URL
 * @param {string} apiKey - Kimi API key
 * @returns {Promise<object>} Raw API response (to be parsed by parseKimiResponse)
 * @throws {APIError} On HTTP errors (401, 429, 5xx)
 */
async function queryKimiAPI(baseUrl, apiKey) {
  const url = buildAPIUrl(baseUrl, 'kimi');

  // Per D-01: Bearer token authentication
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: DEFAULT_CONFIG.timeout,
      maxAttempts: DEFAULT_CONFIG.maxRetries
    });

    // Parse JSON response
    try {
      return await response.json();
    } catch (error) {
      throw new APIError(
        `Invalid JSON response from Kimi API: ${error.message}`,
        null
      );
    }
  } catch (error) {
    // Intercept APIError to provide provider-specific messages per D-10, D-12
    if (error instanceof APIError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new APIError(
          `Kimi API authentication failed (${error.statusCode}): Invalid API key. ` +
          `Verify your API key is correct and has not expired.`,
          error.statusCode
        );
      }

      if (error.statusCode === 429) {
        // Note: fetchWithRetry already throws on 429, but doesn't include Retry-After in message
        // We can't access the response headers here, so just provide generic message
        throw new APIError(
          `Kimi API rate limit exceeded. Please wait before retrying.`,
          error.statusCode
        );
      }
    }

    // Re-throw other errors (NetworkError, etc.)
    throw error;
  }
}

/**
 * Query GLM API for usage data.
 * Per D-01: Uses Bearer token authentication (same as Kimi).
 * Per D-10/D-12: No retry on 401/403/429 errors.
 * @param {string} baseUrl - GLM API base URL
 * @param {string} apiKey - GLM API key
 * @returns {Promise<object>} Raw API response (to be parsed by parseGLMResponse)
 * @throws {APIError} On HTTP errors (401, 429, 5xx)
 */
async function queryGLMAPI(baseUrl, apiKey) {
  const url = buildAPIUrl(baseUrl, 'glm');

  // Per D-01: Bearer token authentication
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: DEFAULT_CONFIG.timeout,
      maxAttempts: DEFAULT_CONFIG.maxRetries
    });

    // Parse JSON response
    try {
      return await response.json();
    } catch (error) {
      throw new APIError(
        `Invalid JSON response from GLM API: ${error.message}`,
        null
      );
    }
  } catch (error) {
    // Intercept APIError to provide provider-specific messages per D-10, D-12
    if (error instanceof APIError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new APIError(
          `GLM API authentication failed (${error.statusCode}): Invalid API key. ` +
          `Verify your API key is correct and has not expired.`,
          error.statusCode
        );
      }

      if (error.statusCode === 429) {
        throw new APIError(
          `GLM API rate limit exceeded. Please wait before retrying.`,
          error.statusCode
        );
      }
    }

    // Re-throw other errors (NetworkError, etc.)
    throw error;
  }
}

/**
 * Unified API query entry point.
 * Coordinates credential resolution, provider detection, and API query.
 * @returns {Promise<{ response: object, provider: 'kimi' | 'glm' }>} Raw API response and provider type
 * @throws {ConfigError} If credentials unavailable or provider undetectable
 * @throws {APIError} If API request fails
 */
async function queryProviderAPI() {
  // Get credentials (handles proxy detection and env vars)
  const credentials = await getCredentials();
  const { apiKey, baseUrl, provider } = credentials;

  // Provider must be detected (either from proxy URL or needs baseUrl)
  if (!provider) {
    throw new ConfigError(
      'Cannot detect provider: no baseUrl available. ' +
      'When using environment variables without CC Switch proxy, ' +
      'this function requires manual provider specification.'
    );
  }

  // Query appropriate API based on provider
  let response;
  if (provider === 'kimi') {
    response = await queryKimiAPI(baseUrl, apiKey);
  } else if (provider === 'glm') {
    response = await queryGLMAPI(baseUrl, apiKey);
  } else {
    throw new ConfigError(
      `Unsupported provider: ${provider}. ` +
      `This tool only supports 'kimi' and 'glm' providers.`
    );
  }

  return { response, provider };
}

///// Data Normalization /////

/**
 * Format remaining milliseconds as human-readable time string.
 * Per D-07: Format as "X小时X分钟" or "X分钟" (Chinese format).
 * @param {number} ms - Remaining time in milliseconds
 * @returns {string} Human-readable time string
 */
function formatTimeRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

/**
 * Normalize reset time to human-readable format.
 * Per D-07: Detect format, validate, calculate remaining time.
 * Per NORM-03: Return "X小时X分钟" format.
 * Per NORM-04: Handle both Unix timestamp (GLM) and ISO string (Kimi).
 * @param {string|number} resetTime - Reset time (ISO string or Unix timestamp in seconds)
 * @returns {string} Human-readable remaining time (e.g., "2小时30分钟")
 * @throws {APIError} If reset time format is invalid
 */
function normalizeResetTime(resetTime) {
  let resetDate;

  // Per NORM-04: Detect format
  if (typeof resetTime === 'number') {
    // Unix timestamp in seconds (GLM) - must multiply by 1000 for JS Date
    resetDate = new Date(resetTime * 1000);
  } else if (typeof resetTime === 'string') {
    // ISO string (Kimi)
    resetDate = new Date(resetTime);
  } else {
    throw new APIError(
      `Invalid reset time format: expected number or string, got ${typeof resetTime}.`
    );
  }

  // Validate date is parseable
  if (isNaN(resetDate.getTime())) {
    throw new APIError(
      `Invalid reset time value: "${resetTime}" cannot be converted to valid date.`
    );
  }

  // Calculate remaining time
  const now = new Date();
  const remainingMs = resetDate - now;

  // Handle edge case: already expired
  if (remainingMs <= 0) {
    return '已过期';
  }

  // Format as human-readable per D-07
  return formatTimeRemaining(remainingMs);
}

/**
 * Calculate usage percentage.
 * Per D-08: Formula Math.round((used / total) * 100, 2)
 * Per NORM-02: Calculate (used / total) * 100.
 * @param {number} used - Used quota
 * @param {number} total - Total quota
 * @returns {number} Percentage used (0-100+, rounded to 2 decimals)
 * @throws {APIError} If total is zero or negative
 */
function calculatePercentage(used, total) {
  // Edge case protection per RESEARCH.md Pitfall 4
  if (total <= 0) {
    throw new APIError(
      `Invalid quota total: ${total}. ` +
      `Total must be greater than zero to calculate percentage.`
    );
  }

  // Per D-08: Round to 2 decimal places
  // Note: Can exceed 100% if over quota (per Open Question 3 in RESEARCH.md)
  return Math.round((used / total) * 100 * 100) / 100;
}

/**
 * Normalize raw usage data to standard format.
 * Per D-09: Output structure { total, used, remaining, percent, reset_display, provider }.
 * Per NORM-01: Standardized format for all providers.
 * @param {{ used: number, total: number, reset: string|number }} rawData - Raw data from parser
 * @param {'kimi'|'glm'} provider - Provider type
 * @returns {{ total: number, used: number, remaining: number, percent: number, reset_display: string, provider: string }}
 */
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

/**
 * Get normalized usage data from provider API.
 * Main entry point that orchestrates: query -> parse -> normalize.
 * @returns {Promise<{ total: number, used: number, remaining: number, percent: number, reset_display: string, provider: string }>}
 * @throws {ConfigError|NetworkError|APIError} On any failure in the pipeline
 */
async function getUsageData() {
  // Step 1: Query provider API (handles credentials, routing, HTTP)
  const { response, provider } = await queryProviderAPI();

  // Step 2: Parse response with provider-specific parser
  let rawData;
  if (provider === 'kimi') {
    rawData = parseKimiResponse(response);
  } else if (provider === 'glm') {
    rawData = parseGLMResponse(response);
  } else {
    throw new ConfigError(
      `Unsupported provider for parsing: ${provider}. ` +
      `This should not happen if queryProviderAPI works correctly.`
    );
  }

  // Step 3: Normalize to standard format
  return normalizeUsageData(rawData, provider);
}

///// Response Parsers /////

/**
 * Parse Kimi API response and extract raw usage data.
 * Per D-04: Independent parser for Kimi-specific format.
 * Per D-05: Direct field access to response.limits[0].
 * Per D-06: Strict validation with APIError on failure.
 * @param {object} response - Raw API response from Kimi
 * @returns {{ used: number, total: number, reset: string }} Raw usage data (reset is ISO string)
 * @throws {APIError} If response format is invalid
 */
function parseKimiResponse(response) {
  // Strict validation per D-06
  if (!response || typeof response !== 'object') {
    throw new APIError(
      'Invalid Kimi API response: expected JSON object. ' +
      `Got ${response === null ? 'null' : typeof response}.`
    );
  }

  // Per D-05: Kimi uses response.limits[0]
  if (!response.limits || !Array.isArray(response.limits)) {
    throw new APIError(
      'Invalid Kimi API response: missing or malformed limits array. ' +
      'Expected { usage: [...], limits: [...] } structure.'
    );
  }

  const quota = response.limits[0];
  if (!quota) {
    throw new APIError(
      'Invalid Kimi API response: limits array is empty. ' +
      'Expected at least one quota entry.'
    );
  }

  // Validate required fields
  if (typeof quota.used !== 'number') {
    throw new APIError(
      `Invalid Kimi quota data: 'used' must be a number. ` +
      `Got ${quota.used === undefined ? 'undefined' : typeof quota.used}.`
    );
  }

  if (typeof quota.total !== 'number') {
    throw new APIError(
      `Invalid Kimi quota data: 'total' must be a number. ` +
      `Got ${quota.total === undefined ? 'undefined' : typeof quota.total}.`
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

/**
 * Parse GLM API response and extract raw usage data.
 * Per D-04: Independent parser for GLM-specific format.
 * Per D-05: Direct field access to response.data.limits with TIME_LIMIT type.
 * Per D-06: Strict validation with APIError on failure.
 * @param {object} response - Raw API response from GLM
 * @returns {{ used: number, total: number, reset: number }} Raw usage data (reset is Unix timestamp in seconds)
 * @throws {APIError} If response format is invalid
 */
function parseGLMResponse(response) {
  // Strict validation per D-06
  if (!response || typeof response !== 'object') {
    throw new APIError(
      'Invalid GLM API response: expected JSON object. ' +
      `Got ${response === null ? 'null' : typeof response}.`
    );
  }

  // Per D-05: GLM wraps data in { data: { limits: [...] } }
  if (!response.data || typeof response.data !== 'object') {
    throw new APIError(
      'Invalid GLM API response: missing data object. ' +
      'Expected { data: { limits: [...] } } structure.'
    );
  }

  if (!response.data.limits || !Array.isArray(response.data.limits)) {
    throw new APIError(
      'Invalid GLM API response: missing or malformed data.limits array. ' +
      'Expected { data: { limits: [...] } } structure.'
    );
  }

  // Per API-04: Find TIME_LIMIT entry
  const quota = response.data.limits.find(limit => limit.type === 'TIME_LIMIT');
  if (!quota) {
    throw new APIError(
      'Invalid GLM API response: no TIME_LIMIT entry found in limits array. ' +
      'Expected at least one entry with type="TIME_LIMIT".'
    );
  }

  // Validate required fields
  if (typeof quota.used !== 'number') {
    throw new APIError(
      `Invalid GLM quota data: 'used' must be a number. ` +
      `Got ${quota.used === undefined ? 'undefined' : typeof quota.used}.`
    );
  }

  if (typeof quota.total !== 'number') {
    throw new APIError(
      `Invalid GLM quota data: 'total' must be a number. ` +
      `Got ${quota.total === undefined ? 'undefined' : typeof quota.total}.`
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

///// Caching Layer /////

/**
 * Get cache file path for a given provider.
 * Per D-03: Uses os.tmpdir() for cross-platform temp directory.
 * Per D-04: Filename pattern cc-usage-${provider}-cache.json.
 * @param {string} provider - Provider name ('kimi' or 'glm')
 * @returns {string} Absolute path to cache file
 */
function getCacheFilePath(provider) {
  return join(tmpdir(), `cc-usage-${provider}-cache.json`);
}

/**
 * Read cache file and check TTL expiration.
 * Per D-05: Strict TTL -- expired cache returns null.
 * Per D-08: Fail-open -- any error returns null (never throws).
 * @param {string} filePath - Path to cache file
 * @param {number} maxAgeMs - Maximum age in milliseconds
 * @returns {Promise<object|null>} Cached data or null if expired/missing
 */
async function readCache(filePath, maxAgeMs) {
  try {
    const content = await fsReadFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Strict TTL check per D-05
    if (Date.now() - data.timestamp > maxAgeMs) {
      return null;
    }

    return data;
  } catch {
    return null; // Fail-open per D-08
  }
}

/**
 * Generate a unique temp file path for atomic writes.
 * Uses process.pid + random suffix to prevent collisions between
 * concurrent writes from the same process.
 * @param {string} filePath - Target cache file path
 * @returns {string} Unique temp file path
 */
function getTempFilePath(filePath) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${filePath}.${process.pid}.${Date.now()}-${rand}.tmp`;
}

/**
 * Write data to cache file atomically using write-then-rename.
 * Per D-07: Write to temp file with process.pid suffix, then rename.
 * Per D-08: Fail-open -- errors are silently swallowed.
 * @param {string} filePath - Target cache file path
 * @param {object} data - Data to cache
 * @returns {Promise<void>}
 */
async function writeCache(filePath, data) {
  const tempPath = getTempFilePath(filePath);
  try {
    await fsWriteFile(tempPath, JSON.stringify(data));
    await fsRename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try { await fsUnlink(tempPath); } catch {}
    // Fail-open per D-08: don't throw
  }
}

/**
 * Get usage data with cache-first strategy.
 * Per D-06: Blocking refresh -- wait for API when cache miss.
 * Per D-10: Cache-first flow: read cache -> return if valid -> API call -> write cache -> return data.
 * Per D-02: Cache structure { timestamp, provider, total, used, remaining, percent, reset_display }.
 * @param {number} [cacheDuration=DEFAULT_CONFIG.cacheDuration] - Cache TTL in seconds
 * @param {string} [provider=null] - Provider name for cache lookup (optional)
 * @returns {Promise<{ total: number, used: number, remaining: number, percent: number, reset_display: string, provider: string }>}
 */
async function getCachedUsageData(cacheDuration = DEFAULT_CONFIG.cacheDuration, provider = null) {
  const maxAgeMs = cacheDuration * 1000;

  // Step 1: Try cache read if provider is known
  if (provider) {
    const filePath = getCacheFilePath(provider);
    const cached = await readCache(filePath, maxAgeMs);
    if (cached) return cached;
  }

  // Step 2: Cache miss or unknown provider -- fetch from API
  const data = await getUsageData();

  // Step 3: Write to cache using provider from response
  const filePath = getCacheFilePath(data.provider);
  writeCache(filePath, {
    timestamp: Date.now(),
    provider: data.provider,
    total: data.total,
    used: data.used,
    remaining: data.remaining,
    percent: data.percent,
    reset_display: data.reset_display
  }); // Fire-and-forget per D-10

  // Step 4: Return data
  return data;
}

///// CLI Interface /////
///// Entry Point /////

export {
  VERSION,
  EXIT_CODES,
  DEFAULT_CONFIG,
  CliError,
  UsageError,
  ConfigError,
  NetworkError,
  APIError,
  handleError,
  detectRuntime,
  getRuntimeInfo,
  isSupportedVersion,
  validateRuntime,
  loadDatabaseModule,
  isDatabaseLoaded,
  openDatabase,
  closeDatabase,
  sleep,
  isRetryableError,
  fetchWithTimeout,
  fetchWithRetry,
  expandHomePath,
  CC_SWITCH_DB_PATH,
  getProxyCredentials,
  getEnvCredentials,
  getCredentials,
  getLocalAddressPatterns,
  isProxyEnabled,
  detectProvider,
  buildAPIUrl,
  queryKimiAPI,
  queryGLMAPI,
  queryProviderAPI,
  parseKimiResponse,
  parseGLMResponse,
  formatTimeRemaining,
  normalizeResetTime,
  calculatePercentage,
  normalizeUsageData,
  getUsageData,
  getCacheFilePath,
  readCache,
  writeCache,
  getCachedUsageData,
};
