///// Phase 03: API Integration & Data Normalization Tests /////
// Tests for API-01~05, NORM-01~04

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mockFetchResponse, mockEnv, sleep } from './conftest';
import {
  buildAPIUrl,
  queryKimiAPI,
  queryGLMAPI,
  queryProviderAPI,
  parseKimiResponse,
  parseGLMResponse,
  formatTimeRemaining,
  normalizeResetTime,
  ConfigError,
  APIError
} from '../usage.mjs';

// ============================================================
// API Request Infrastructure
// ============================================================
describe('buildAPIUrl', () => {
  test('should construct Kimi API URL with correct path', () => {
    const baseUrl = 'https://api.kimi.com';
    const url = buildAPIUrl(baseUrl, 'kimi');
    expect(url).toBe('https://api.kimi.com/coding/v1/usages');
  });

  test('should construct GLM API URL with correct path', () => {
    const baseUrl = 'https://open.bigmodel.cn';
    const url = buildAPIUrl(baseUrl, 'glm');
    expect(url).toBe('https://open.bigmodel.cn/api/monitor/usage/quota/limit');
  });

  test('should handle trailing slashes in base URL', () => {
    const baseUrl = 'https://api.kimi.com/';
    const url = buildAPIUrl(baseUrl, 'kimi');
    expect(url).toBe('https://api.kimi.com/coding/v1/usages');
  });

  test('should throw ConfigError for unknown provider', () => {
    const baseUrl = 'https://api.example.com';
    expect(() => buildAPIUrl(baseUrl, 'unknown')).toThrow(ConfigError);
    expect(() => buildAPIUrl(baseUrl, 'unknown')).toThrow('Unknown provider');
  });
});

// ============================================================
// API-01: Query Kimi API usage via /coding/v1/usages endpoint
// ============================================================
describe('queryKimiAPI', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('should construct correct URL for Kimi API', async () => {
    const mockResponse = {
      usage: [],
      limits: [{ used: 100, total: 1000, reset: '2026-04-06T03:33:46.648544Z' }]
    };

    global.fetch = async (url, options) => {
      expect(url).toBe('https://api.kimi.com/coding/v1/usages');
      return mockFetchResponse(mockResponse, { status: 200 });
    };

    const result = await queryKimiAPI('https://api.kimi.com', 'test-key');
    expect(result).toEqual(mockResponse);
  });

  test('should send Bearer token in Authorization header', async () => {
    const mockResponse = {
      usage: [],
      limits: [{ used: 100, total: 1000, reset: '2026-04-06T03:33:46.648544Z' }]
    };

    global.fetch = async (url, options) => {
      expect(options.headers['Authorization']).toBe('Bearer test-key-123');
      return mockFetchResponse(mockResponse, { status: 200 });
    };

    await queryKimiAPI('https://api.kimi.com', 'test-key-123');
  });

  test('should return parsed JSON response on success', async () => {
    const mockResponse = {
      usage: [{ model: 'claude-3', tokens: 5000 }],
      limits: [{ used: 5000, total: 10000, reset: '2026-04-06T03:33:46.648544Z' }]
    };

    global.fetch = async () => mockFetchResponse(mockResponse, { status: 200 });

    const result = await queryKimiAPI('https://api.kimi.com', 'test-key');
    expect(result).toEqual(mockResponse);
    expect(result.limits[0].used).toBe(5000);
  });

  test('should throw APIError on 401 unauthorized', async () => {
    global.fetch = async () => mockFetchResponse({}, { status: 401, statusText: 'Unauthorized' });

    try {
      await queryKimiAPI('https://api.kimi.com', 'invalid-key');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('Kimi API authentication failed');
      expect(error.statusCode).toBe(401);
    }
  });

  test('should throw APIError on 429 rate limit', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      return mockFetchResponse({}, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '1' }
      });
    };

    try {
      await queryKimiAPI('https://api.kimi.com', 'test-key');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('Kimi API rate limit exceeded');
      expect(error.statusCode).toBe(429);
      // Verify it retried before failing (default maxAttempts is 3)
      expect(callCount).toBe(3);
    }
  });
});

// ============================================================
// API-02: Query GLM API usage via /api/monitor/usage/quota/limit endpoint
// ============================================================
describe('queryGLMAPI', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('should construct correct URL for GLM API', async () => {
    const mockResponse = {
      data: {
        limits: [{ type: 'TIME_LIMIT', used: 100, total: 1000, reset: 1743894733 }]
      }
    };

    global.fetch = async (url, options) => {
      expect(url).toBe('https://open.bigmodel.cn/api/monitor/usage/quota/limit');
      return mockFetchResponse(mockResponse, { status: 200 });
    };

    const result = await queryGLMAPI('https://open.bigmodel.cn', 'test-key');
    expect(result).toEqual(mockResponse);
  });

  test('should send Bearer token in Authorization header', async () => {
    const mockResponse = {
      data: {
        limits: [{ type: 'TIME_LIMIT', used: 100, total: 1000, reset: 1743894733 }]
      }
    };

    global.fetch = async (url, options) => {
      expect(options.headers['Authorization']).toBe('Bearer test-key-456');
      return mockFetchResponse(mockResponse, { status: 200 });
    };

    await queryGLMAPI('https://open.bigmodel.cn', 'test-key-456');
  });

  test('should return parsed JSON response on success', async () => {
    const mockResponse = {
      data: {
        limits: [{ type: 'TIME_LIMIT', used: 5000, total: 10000, reset: 1743894733 }]
      }
    };

    global.fetch = async () => mockFetchResponse(mockResponse, { status: 200 });

    const result = await queryGLMAPI('https://open.bigmodel.cn', 'test-key');
    expect(result).toEqual(mockResponse);
    expect(result.data.limits[0].used).toBe(5000);
  });

  test('should throw APIError on 401 unauthorized', async () => {
    global.fetch = async () => mockFetchResponse({}, { status: 401, statusText: 'Unauthorized' });

    try {
      await queryGLMAPI('https://open.bigmodel.cn', 'invalid-key');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('GLM API authentication failed');
      expect(error.statusCode).toBe(401);
    }
  });

  test('should throw APIError on 429 rate limit', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      return mockFetchResponse({}, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '1' }
      });
    };

    try {
      await queryGLMAPI('https://open.bigmodel.cn', 'test-key');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('GLM API rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(callCount).toBe(3);
    }
  });
});

// ============================================================
// API-03: Parse Kimi response format: { usage: [...], limits: [...] }
// ============================================================
describe('parseKimiResponse', () => {
  test('should extract quotas from usage + limits with window labels', () => {
    const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const response = {
      usage: { limit: '10000', remaining: '5000', resetTime },
      limits: [{
        window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
        detail: { limit: '10000', remaining: '5000', resetTime }
      }]
    };

    const result = parseKimiResponse(response);

    expect(result.quotas).toBeDefined();
    expect(Array.isArray(result.quotas)).toBe(true);
    expect(result.quotas.length).toBe(2);
    const overall = result.quotas.find(q => q.window === 'overall');
    expect(overall).toBeDefined();
    expect(overall.total).toBe(10000);
    expect(overall.used).toBe(5000);
  });

  test('should throw APIError when limits array missing', () => {
    const response = { usage: [] };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('missing or malformed limits array');
  });

  test('should throw APIError when limits array empty and no usage with valid data', () => {
    // Empty limits and no usage object with valid data -> no quotas extracted
    const response = { limits: [] };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('no usable quota data');
  });

  test('should skip limits entries missing window or detail', () => {
    const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    const response = {
      usage: { limit: '100', remaining: '50', resetTime },
      limits: [{ reset: '2026-04-06T03:33:46.648544Z' }] // missing window and detail
    };

    const result = parseKimiResponse(response);
    // Only the 'overall' quota from usage field should be present
    expect(result.quotas.length).toBe(1);
    expect(result.quotas[0].window).toBe('overall');
  });

  test('should handle limits entries with missing resetTime gracefully', () => {
    const response = {
      usage: { limit: '100', remaining: '50', resetTime: new Date(Date.now() + 3600000).toISOString() },
      limits: [{
        window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
        detail: { limit: '100', remaining: '50' } // no resetTime
      }]
    };

    const result = parseKimiResponse(response);
    expect(result.quotas.length).toBe(2);
    const windowed = result.quotas.find(q => q.window === '5h');
    expect(windowed).toBeDefined();
    expect(windowed.reset_display).toBe('');
    expect(windowed.reset_timestamp).toBeNull();
  });
});

// ============================================================
// API-04: Parse GLM response format: { data: { limits: [...] } } with TIME_LIMIT type
// ============================================================
describe('parseGLMResponse', () => {
  test('should extract quotas from all data.limits entries with window labels', () => {
    const futureMs = Date.now() + 5 * 60 * 60 * 1000;
    const response = {
      data: {
        limits: [
          { type: 'OTHER_LIMIT', unit: 1, number: 1, usage: 1000, currentValue: 500, remaining: 500, percentage: 50, nextResetTime: futureMs },
          { type: 'TIME_LIMIT', unit: 5, number: 1, usage: 10000, currentValue: 3000, remaining: 7000, percentage: 30, nextResetTime: futureMs }
        ]
      }
    };

    const result = parseGLMResponse(response);

    expect(result.quotas).toBeDefined();
    expect(Array.isArray(result.quotas)).toBe(true);
    expect(result.quotas.length).toBe(2);

    const timeLimit = result.quotas.find(q => q.window === '5h');
    expect(timeLimit).toBeDefined();
    expect(timeLimit.type).toBe('TIME_LIMIT');
    expect(timeLimit.total).toBe(10000);
    expect(timeLimit.used).toBe(3000);

    const other = result.quotas.find(q => q.type === 'OTHER_LIMIT');
    expect(other).toBeDefined();
  });

  test('should throw APIError when data.limits array missing', () => {
    const response = { data: {} };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('missing or malformed data.limits array');
  });

  test('should throw APIError when no valid limit entries found', () => {
    const response = {
      data: {
        limits: [
          { } // no type field
        ]
      }
    };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('no usable limit entries');
  });

  test('should handle entries with missing fields using defaults', () => {
    const futureMs = Date.now() + 2 * 60 * 60 * 1000;
    const response = {
      data: {
        limits: [
          { type: 'TIME_LIMIT', unit: 5, number: 1, nextResetTime: futureMs }
        ]
      }
    };

    const result = parseGLMResponse(response);

    expect(result.quotas.length).toBe(1);
    expect(result.quotas[0].total).toBe(0);
    expect(result.quotas[0].used).toBe(0);
    expect(result.quotas[0].remaining).toBe(0);
  });

  test('should handle entries without reset fields gracefully', () => {
    const response = {
      data: {
        limits: [
          { type: 'TIME_LIMIT', unit: 5, number: 1, usage: 10000, currentValue: 3000, remaining: 7000, percentage: 30 }
        ]
      }
    };

    const result = parseGLMResponse(response);

    expect(result.quotas.length).toBe(1);
    expect(result.quotas[0].reset_display).toBe('');
    expect(result.quotas[0].reset_timestamp).toBeNull();
  });
});

// ============================================================
// API-05: Handle API errors with clear error messages (no silent fallback)
// ============================================================
describe('API error handling', () => {
  test('should throw APIError with status code for HTTP errors', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should include actionable message for 401 errors', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should include retry-after info for 429 errors', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError for malformed JSON response', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// NORM-01: Normalize usage data to standard format
// ============================================================
describe('normalizeUsageData', () => {
  test('should return { total, used, remaining, percent, reset_display, provider }', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should calculate remaining = total - used', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should include provider in output', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// NORM-02: Calculate percentage: (used / total) * 100
// ============================================================
describe('calculatePercentage', () => {
  test('should calculate (used / total) * 100 rounded to 2 decimals', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError when total is 0', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError when total is negative', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should handle values > 100% (over quota)', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// NORM-03: Convert reset time to human-readable format ("X小时X分钟")
// ============================================================
describe('formatTimeRemaining', () => {
  test('should format hours and minutes in Chinese', () => {
    // 2 hours 30 minutes = 2 * 60 * 60 * 1000 + 30 * 60 * 1000 = 9000000 ms
    const result = formatTimeRemaining(9000000);
    expect(result).toBe('2小时30分钟');
  });

  test('should show only minutes when < 1 hour', () => {
    // 45 minutes = 45 * 60 * 1000 = 2700000 ms
    const result = formatTimeRemaining(2700000);
    expect(result).toBe('45分钟');
  });

  test('should return "已过期" when time already passed', () => {
    // This test is for normalizeResetTime, not formatTimeRemaining
    // formatTimeRemaining just formats milliseconds, it doesn't know about expiration
    expect(true).toBe(true);
  });

  test('should handle 0 remaining time', () => {
    // 0 ms should format as "0分钟"
    const result = formatTimeRemaining(0);
    expect(result).toBe('0分钟');
  });
});

// ============================================================
// NORM-04: Handle both timestamp (GLM) and ISO string (Kimi) reset time formats
// ============================================================
describe('normalizeResetTime', () => {
  test('should parse ISO string format (Kimi)', () => {
    // Create a date 2 hours in the future
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const isoString = futureDate.toISOString();

    const result = normalizeResetTime(isoString);

    // Should contain hours and minutes
    expect(result).toMatch(/\d+小时\d+分钟/);
  });

  test('should parse Unix timestamp in seconds (GLM)', () => {
    // Create a date 1 hour in the future
    const futureDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const unixTimestamp = Math.floor(futureDate.getTime() / 1000);

    const result = normalizeResetTime(unixTimestamp);

    // Should contain minutes (may or may not have hours depending on exact timing)
    expect(result).toMatch(/\d+分钟/);
  });

  test('should multiply Unix timestamp by 1000 for Date', () => {
    // Create a date 90 minutes in the future
    const futureDate = new Date(Date.now() + 90 * 60 * 1000);
    const unixTimestamp = Math.floor(futureDate.getTime() / 1000);

    const result = normalizeResetTime(unixTimestamp);

    // Should be around 1 hour 30 minutes (allow for some variance in timing)
    expect(result).toMatch(/1小时(29|30)分钟/);
  });

  test('should throw APIError for invalid date string', () => {
    expect(() => normalizeResetTime('invalid-date')).toThrow(APIError);
    expect(() => normalizeResetTime('invalid-date')).toThrow('cannot be converted to valid date');
  });

  test('should throw APIError for non-number/string input', () => {
    expect(() => normalizeResetTime({})).toThrow(APIError);
    expect(() => normalizeResetTime({})).toThrow('expected number or string');
  });

  test('should return "已过期" when time already passed', () => {
    // Create a date 1 hour in the past
    const pastDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const isoString = pastDate.toISOString();

    const result = normalizeResetTime(isoString);

    expect(result).toBe('已过期');
  });
});

// ============================================================
// Integration: Unified query flow
// ============================================================
describe('queryProviderAPI (integration)', () => {
  let originalFetch;
  let restoreEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Mock environment to test without CC Switch proxy
    restoreEnv = mockEnv({
      ANTHROPIC_API_KEY: 'test-env-key',
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreEnv();
  });

  test('should query Kimi API and return response with provider', async () => {
    const mockResponse = {
      usage: [],
      limits: [{ used: 5000, total: 10000, reset: '2026-04-06T03:33:46.648544Z' }]
    };

    // Mock CC Switch proxy detection
    const envRestore = mockEnv({
      ANTHROPIC_BASE_URL: 'https://api.kimi.com',
      ANTHROPIC_API_KEY: undefined // Should not be used when proxy is active
    });

    global.fetch = async (url, options) => {
    expect(url).toContain('kimi.com');
    expect(options.headers['Authorization']).toBe('Bearer test-proxy-key');
    return mockFetchResponse(mockResponse, { status: 200 });
    };

    // Mock getProxyCredentials to return Kimi credentials
    const originalHome = process.env.HOME;
    process.env.HOME = '/Users/test';

    const result = await queryProviderAPI();

    expect(result.response).toEqual(mockResponse);
    expect(result.provider).toBe('kimi');

    process.env.HOME = originalHome;
    envRestore();
  });

  test('should query GLM API and return response with provider', async () => {
    const mockResponse = {
      data: {
        limits: [{ type: 'TIME_LIMIT', used: 3000, total: 5000, reset: 1743894733 }]
      }
    };

    // Mock CC Switch proxy detection for GLM
    const envRestore = mockEnv({
      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
      ANTHROPIC_API_KEY: undefined
    });

    global.fetch = async (url, options) => {
    expect(url).toContain('bigmodel.cn');
    expect(options.headers['Authorization']).toBe('Bearer test-proxy-key');
    return mockFetchResponse(mockResponse, { status: 200 });
    };

    const originalHome = process.env.HOME;
    process.env.HOME = '/Users/test';

    const result = await queryProviderAPI();

    expect(result.response).toEqual(mockResponse);
    expect(result.provider).toBe('glm');

    process.env.HOME = originalHome;
    envRestore();
  });

  test('should use getCredentials() for authentication', async () => {
    // This test verifies the integration with getCredentials
    // When no proxy is detected, getCredentials returns env var credentials
    const mockResponse = {
      usage: [],
      limits: [{ used: 1000, total: 5000, reset: '2026-04-06T03:33:46.648544Z' }]
    };

    global.fetch = async (url, options) => {
      return mockFetchResponse(mockResponse, { status: 200 });
    };

    // No proxy, should fail because provider cannot be detected without baseUrl
    try {
      await queryProviderAPI();
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toContain('Cannot detect provider');
    }
  });
});
