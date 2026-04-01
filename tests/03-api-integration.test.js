///// Phase 03: API Integration & Data Normalization Tests /////
// Tests for API-01~05, NORM-01~04

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mockFetchResponse, mockEnv, sleep } from './conftest';
import {
  buildAPIUrl,
  queryKimiAPI,
  parseKimiResponse,
  parseGLMResponse,
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
    global.fetch = async () => mockFetchResponse({}, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'retry-after': '60' }
    });

    try {
      await queryKimiAPI('https://api.kimi.com', 'test-key');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('Kimi API rate limit exceeded');
      expect(error.statusCode).toBe(429);
    }
  });
});

// ============================================================
// API-02: Query GLM API usage via /api/monitor/usage/quota/limit endpoint
// ============================================================
describe('queryGLMAPI', () => {
  test('should construct correct URL for GLM API', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should send authorization header (raw token or Bearer)', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should return parsed JSON response on success', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError on 401 unauthorized', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError on 429 rate limit', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// API-03: Parse Kimi response format: { usage: [...], limits: [...] }
// ============================================================
describe('parseKimiResponse', () => {
  test('should extract used/total/reset from limits[0]', () => {
    const response = {
      usage: [],
      limits: [{
        used: 5000,
        total: 10000,
        reset: '2026-04-06T03:33:46.648544Z'
      }]
    };

    const result = parseKimiResponse(response);

    expect(result.used).toBe(5000);
    expect(result.total).toBe(10000);
    expect(result.reset).toBe('2026-04-06T03:33:46.648544Z');
  });

  test('should throw APIError when limits array missing', () => {
    const response = { usage: [] };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('missing or malformed limits array');
  });

  test('should throw APIError when limits array empty', () => {
    const response = { usage: [], limits: [] };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('limits array is empty');
  });

  test('should throw APIError when used/total fields missing', () => {
    const response = {
      usage: [],
      limits: [{ reset: '2026-04-06T03:33:46.648544Z' }]
    };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('used');
  });

  test('should throw APIError when reset field missing', () => {
    const response = {
      usage: [],
      limits: [{ used: 5000, total: 10000 }]
    };

    expect(() => parseKimiResponse(response)).toThrow(APIError);
    expect(() => parseKimiResponse(response)).toThrow('missing reset field');
  });
});

// ============================================================
// API-04: Parse GLM response format: { data: { limits: [...] } } with TIME_LIMIT type
// ============================================================
describe('parseGLMResponse', () => {
  test('should extract used/total/reset from data.limits where type=TIME_LIMIT', () => {
    const response = {
      data: {
        limits: [
          { type: 'OTHER_LIMIT', used: 1000, total: 5000, reset: 1743894733 },
          { type: 'TIME_LIMIT', used: 3000, total: 10000, reset: 1743894733 }
        ]
      }
    };

    const result = parseGLMResponse(response);

    expect(result.used).toBe(3000);
    expect(result.total).toBe(10000);
    expect(result.reset).toBe(1743894733);
  });

  test('should throw APIError when data.limits array missing', () => {
    const response = { data: {} };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('missing or malformed data.limits array');
  });

  test('should throw APIError when no TIME_LIMIT entry found', () => {
    const response = {
      data: {
        limits: [
          { type: 'OTHER_LIMIT', used: 1000, total: 5000, reset: 1743894733 }
        ]
      }
    };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('no TIME_LIMIT entry found');
  });

  test('should throw APIError when used/total fields missing', () => {
    const response = {
      data: {
        limits: [
          { type: 'TIME_LIMIT', reset: 1743894733 }
        ]
      }
    };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('used');
  });

  test('should throw APIError when reset field missing', () => {
    const response = {
      data: {
        limits: [
          { type: 'TIME_LIMIT', used: 3000, total: 10000 }
        ]
      }
    };

    expect(() => parseGLMResponse(response)).toThrow(APIError);
    expect(() => parseGLMResponse(response)).toThrow('missing reset field');
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
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should show only minutes when < 1 hour', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should return "已过期" when time already passed', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should handle 0 remaining time', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// NORM-04: Handle both timestamp (GLM) and ISO string (Kimi) reset time formats
// ============================================================
describe('normalizeResetTime', () => {
  test('should parse ISO string format (Kimi)', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should parse Unix timestamp in seconds (GLM)', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should multiply Unix timestamp by 1000 for Date', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError for invalid date string', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should throw APIError for non-number/string input', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});

// ============================================================
// Integration: Unified query flow
// ============================================================
describe('queryProviderAPI (integration)', () => {
  test('should query Kimi API and return normalized data', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should query GLM API and return normalized data', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  test('should use getCredentials() for authentication', async () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
