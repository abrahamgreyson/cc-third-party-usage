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
  getLocalAddressPatterns,
  isProxyEnabled,
  detectProvider,
};
