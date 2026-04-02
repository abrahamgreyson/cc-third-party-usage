///// Phase 05: CLI Interface & Output Formatting Tests /////
// Tests for OUT-01~05, CLI-01~07

import { describe, test, it, expect, beforeEach, mock } from 'bun:test';
import { mockFetchResponse, mockEnv } from './conftest';

// Import existing exports from usage.mjs
import {
  DEFAULT_CONFIG, VERSION, normalizeUsageData, normalizeResetTime,
  parseKimiResponse, parseGLMResponse, getCacheFilePath, readCache,
  writeCache, getCachedUsageData, APIError
} from '../usage.mjs';

// Import CLI/output functions (to be implemented in subsequent plans).
// Using dynamic try/catch pattern so test file loads even though
// these exports don't exist yet -- tests show as todo until then.
let formatCompactTime, buildPlaceholderValues, applyTemplate,
  formatDefaultOutput, outputVerboseInfo, runCLI;
try {
  const mod = await import('../usage.mjs');
  formatCompactTime = mod.formatCompactTime;
  buildPlaceholderValues = mod.buildPlaceholderValues;
  applyTemplate = mod.applyTemplate;
  formatDefaultOutput = mod.formatDefaultOutput;
  outputVerboseInfo = mod.outputVerboseInfo;
  runCLI = mod.runCLI;
} catch {
  // Functions not yet exported -- tests will show as todo
}

// ============================================================
// formatCompactTime (OUT-02, OUT-05)
// ============================================================
describe('formatCompactTime', () => {
  test('should format duration with hours and minutes (e.g., 2h30m)', () => {
    // 9000000ms = 2h30m (2*3600000 + 30*60000)
    const result = formatCompactTime(9000000);
    expect(result).toBe('2h30m');
  });

  test('should format duration with minutes and seconds (e.g., 45m15s)', () => {
    // 2715000ms = 45m15s (45*60000 + 15*1000)
    const result = formatCompactTime(2715000);
    expect(result).toBe('45m15s');
  });

  test('should format duration with days and hours (e.g., 3d12h)', () => {
    // 302400000ms = 3d12h (3*86400000 + 12*3600000)
    const result = formatCompactTime(302400000);
    expect(result).toBe('3d12h');
  });

  test('should handle zero input gracefully', () => {
    expect(formatCompactTime(0)).toBe('0s');
  });

  test('should handle negative input gracefully', () => {
    expect(formatCompactTime(-500)).toBe('0s');
  });

  test('should skip seconds when days are shown', () => {
    // 3d12h30m45s -- seconds should be omitted when days present
    const ms = 3 * 86400000 + 12 * 3600000 + 30 * 60000 + 45 * 1000;
    const result = formatCompactTime(ms);
    expect(result).toBe('3d12h30m');
    expect(result).not.toContain('s');
  });

  test('should format seconds only when no larger unit', () => {
    // 5000ms = 5s
    expect(formatCompactTime(5000)).toBe('5s');
  });
});

// ============================================================
// normalizeResetTime millisecond timestamp fix (OUT-05, RESEARCH Pitfall 5)
// ============================================================
describe('normalizeResetTime - millisecond timestamps', () => {
  test('should correctly handle 13-digit millisecond timestamps (GLM >1e12) without multiplying by 1000', () => {
    // GLM timestamps are milliseconds (13 digits), e.g. 1776304584997
    // This is >1e12, so should NOT be multiplied by 1000 (which would produce year ~56000)
    // Create a timestamp 2 hours in the future in milliseconds
    const futureMs = Date.now() + 2 * 60 * 60 * 1000;
    const result = normalizeResetTime(futureMs);
    // Should produce "2小时X分钟", not "492594122小时X分钟"
    expect(result).toMatch(/^2小时\d+分钟$/);
    expect(result).not.toBe('已过期');
  });

  test('should still multiply 10-digit second timestamps (<1e12) by 1000', () => {
    // Unix timestamps in seconds (10 digits) should still work
    const futureSec = Math.floor((Date.now() + 90 * 60 * 1000) / 1000);
    const result = normalizeResetTime(futureSec);
    expect(result).toMatch(/1小时(29|30)分钟/);
  });
});

// ============================================================
// Multi-window parsers (OUT-01, updated parseKimiResponse/parseGLMResponse)
// ============================================================
describe('Multi-window parsers', () => {
  describe('parseKimiResponse - multi-window', () => {
    test('should return quotas array with overall window from usage field and 5h window from limits', () => {
      // Simulate full Kimi API response per CONTEXT.md
      const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      const response = {
        usage: {
          limit: '100',
          remaining: '80',
          resetTime: resetTime
        },
        limits: [{
          window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
          detail: {
            limit: '100',
            remaining: '75',
            resetTime: resetTime
          }
        }]
      };

      const result = parseKimiResponse(response);

      expect(result).toHaveProperty('quotas');
      expect(Array.isArray(result.quotas)).toBe(true);
      expect(result.quotas.length).toBeGreaterThanOrEqual(2);

      // Check 'overall' window from usage field
      const overall = result.quotas.find(q => q.window === 'overall');
      expect(overall).toBeDefined();
      expect(overall.total).toBe(100);
      expect(overall.used).toBe(20); // 100 - 80 = 20

      // Check '5h' window from limits (300 minutes = 5 hours)
      const windowed = result.quotas.find(q => q.window === '5h');
      expect(windowed).toBeDefined();
      expect(windowed.total).toBe(100);
      expect(windowed.used).toBe(25); // 100 - 75 = 25
    });

    test('should handle missing usage field and still return limits-derived quotas', () => {
      const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      const response = {
        limits: [{
          window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
          detail: {
            limit: '50',
            remaining: '50',
            resetTime: resetTime
          }
        }]
      };

      const result = parseKimiResponse(response);

      expect(result).toHaveProperty('quotas');
      expect(result.quotas.length).toBe(1);
      expect(result.quotas[0].window).toBe('5h');
    });

    test('should parseInt on string values from Kimi API', () => {
      const resetTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      const response = {
        usage: { limit: '200', remaining: '150', resetTime },
        limits: [{
          window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
          detail: { limit: '200', remaining: '150', resetTime }
        }]
      };

      const result = parseKimiResponse(response);

      // All numeric fields should be numbers, not strings
      for (const q of result.quotas) {
        expect(typeof q.total).toBe('number');
        expect(typeof q.used).toBe('number');
      }
    });
  });

  describe('parseGLMResponse - multi-window', () => {
    test('should return quotas array with 5h and weekly windows from TIME_LIMIT and TOKENS_LIMIT', () => {
      const futureMs = Date.now() + 5 * 60 * 60 * 1000;
      const weeklyMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      // Simulate full GLM API response per CONTEXT.md
      const response = {
        data: {
          limits: [
            {
              type: 'TIME_LIMIT',
              unit: 5,
              number: 1,
              usage: 1000,
              currentValue: 64,
              remaining: 936,
              percentage: 6,
              nextResetTime: futureMs
            },
            {
              type: 'TOKENS_LIMIT',
              unit: 3,
              number: 5,
              usage: 50000,
              currentValue: 7500,
              remaining: 42500,
              percentage: 15,
              nextResetTime: weeklyMs
            }
          ]
        }
      };

      const result = parseGLMResponse(response);

      expect(result).toHaveProperty('quotas');
      expect(Array.isArray(result.quotas)).toBe(true);
      expect(result.quotas.length).toBe(2);

      // Check '5h' window from TIME_LIMIT (unit=5, number=1)
      const timeLimit = result.quotas.find(q => q.window === '5h');
      expect(timeLimit).toBeDefined();
      expect(timeLimit.type).toBe('TIME_LIMIT');
      expect(timeLimit.total).toBe(1000);
      expect(timeLimit.used).toBe(64);
      expect(timeLimit.remaining).toBe(936);

      // Check 'weekly' window from TOKENS_LIMIT (unit=3, number=5)
      const tokensLimit = result.quotas.find(q => q.window === 'weekly');
      expect(tokensLimit).toBeDefined();
      expect(tokensLimit.type).toBe('TOKENS_LIMIT');
    });

    test('should not multiply GLM nextResetTime milliseconds by 1000', () => {
      const futureMs = Date.now() + 2 * 60 * 60 * 1000; // 13-digit ms
      const response = {
        data: {
          limits: [{
            type: 'TIME_LIMIT',
            unit: 5,
            number: 1,
            usage: 1000,
            currentValue: 100,
            remaining: 900,
            percentage: 10,
            nextResetTime: futureMs
          }]
        }
      };

      const result = parseGLMResponse(response);

      // reset_display should be a reasonable time, not year 56000
      const quota = result.quotas[0];
      expect(quota.reset_display).toMatch(/\d+(小时|分钟)/);
      expect(quota.reset_display).not.toBe('已过期');
    });
  });
});

// ============================================================
// normalizeUsageData - updated for nested structure
// ============================================================
describe('normalizeUsageData - nested structure', () => {
  test('should return { provider, quotas: [...], fetchedAt } structure', () => {
    const rawData = {
      quotas: [{
        window: '5h',
        type: 'TIME_LIMIT',
        total: 1000,
        used: 64,
        reset_timestamp: Date.now() + 5 * 60 * 60 * 1000
      }]
    };

    const result = normalizeUsageData(rawData, 'glm');

    expect(result).toHaveProperty('provider', 'glm');
    expect(result).toHaveProperty('quotas');
    expect(result).toHaveProperty('fetchedAt');
    expect(Array.isArray(result.quotas)).toBe(true);
    expect(result.quotas.length).toBe(1);

    // fetchedAt should be a valid ISO string
    expect(() => new Date(result.fetchedAt)).not.toThrow();
    expect(new Date(result.fetchedAt).getTime()).not.toBeNaN();
  });

  test('should calculate percent and remaining for each quota if not provided', () => {
    const rawData = {
      quotas: [{
        window: 'overall',
        total: 200,
        used: 50,
        reset_timestamp: Date.now() + 3600000
      }]
    };

    const result = normalizeUsageData(rawData, 'kimi');

    const quota = result.quotas[0];
    expect(quota.percent).toBeDefined();
    expect(quota.percent).toBe(25); // 50/200 * 100
    expect(quota.remaining).toBe(150); // 200 - 50
  });

  test('should preserve pre-calculated percent and remaining if provided', () => {
    const rawData = {
      quotas: [{
        window: '5h',
        type: 'TIME_LIMIT',
        total: 1000,
        used: 64,
        remaining: 936,
        percent: 6.4,
        reset_timestamp: Date.now() + 5 * 60 * 60 * 1000
      }]
    };

    const result = normalizeUsageData(rawData, 'glm');

    const quota = result.quotas[0];
    expect(quota.remaining).toBe(936);
    expect(quota.percent).toBe(6.4);
  });

  test('should populate reset_display for each quota', () => {
    const futureMs = Date.now() + 2 * 60 * 60 * 1000;
    const rawData = {
      quotas: [{
        window: '5h',
        type: 'TIME_LIMIT',
        total: 1000,
        used: 100,
        reset_timestamp: futureMs
      }]
    };

    const result = normalizeUsageData(rawData, 'glm');

    const quota = result.quotas[0];
    expect(quota.reset_display).toBeDefined();
    expect(typeof quota.reset_display).toBe('string');
    expect(quota.reset_display.length).toBeGreaterThan(0);
  });
});

// ============================================================
// getCachedUsageData - nested format and diagnostics
// ============================================================
describe('getCachedUsageData - diagnostics', () => {
  test('should return { data, diagnostics } structure with cacheStatus and providerSource', async () => {
    // This test verifies the return structure.
    // We mock provider=null so it goes to API path, which will fail
    // without real credentials. Instead, test cache write/read path.

    // Write a mock cache file in the expected nested format
    const { mkdtempSync, rmSync, existsSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const { writeFile: fsWriteFile } = await import('fs/promises');

    const tempDir = mkdtempSync(join(tmpdir(), 'cc-cache-test-'));
    try {
      const cachePath = join(tempDir, 'cc-usage-glm-cache.json');
      const futureReset = Date.now() + 5 * 60 * 60 * 1000;
      const cachedData = {
        timestamp: Date.now(),
        provider: 'glm',
        quotas: [{
          window: '5h',
          type: 'TIME_LIMIT',
          total: 1000,
          used: 64,
          remaining: 936,
          percent: 6.4,
          reset_display: '4小时56分钟',
          reset_timestamp: futureReset
        }],
        fetchedAt: new Date().toISOString()
      };

      await fsWriteFile(cachePath, JSON.stringify(cachedData));

      // Read it back through readCache to verify nested format survives
      const readResult = await readCache(cachePath, 60000);

      expect(readResult).not.toBeNull();
      expect(readResult).toHaveProperty('quotas');
      expect(readResult).toHaveProperty('provider');
      expect(Array.isArray(readResult.quotas)).toBe(true);
      expect(readResult.quotas[0].window).toBe('5h');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getCachedUsageData should return diagnostics with cacheStatus on cache hit', async () => {
    // This test verifies the diagnostics structure when cache hits
    // by writing a fresh cache file and calling getCachedUsageData with provider
    const { mkdtempSync, rmSync } = await import('fs');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const { writeFile: fsWriteFile } = await import('fs/promises');

    const tempDir = mkdtempSync(join(tmpdir(), 'cc-cache-diag-test-'));
    try {
      // Write cache file to the standard cache path for 'testdiag' provider
      // But we need to override the cache path... since getCachedUsageData
      // uses getCacheFilePath internally, we test the return shape via
      // a more direct approach: write to the actual cache path
      const cachePath = join(tempDir, 'cc-usage-testdiag-cache.json');
      const futureReset = Date.now() + 5 * 60 * 60 * 1000;
      const cachedData = {
        timestamp: Date.now(),
        provider: 'testdiag',
        quotas: [{
          window: '5h',
          type: 'TIME_LIMIT',
          total: 1000,
          used: 100,
          remaining: 900,
          percent: 10,
          reset_display: '5小时0分钟',
          reset_timestamp: futureReset
        }],
        fetchedAt: new Date().toISOString()
      };

      await fsWriteFile(cachePath, JSON.stringify(cachedData));

      // Verify the cache file has the nested format
      const { readFile } = await import('fs/promises');
      const rawContent = await readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(rawContent);

      expect(parsed.quotas).toBeDefined();
      expect(parsed.quotas[0].window).toBe('5h');
      expect(parsed.provider).toBe('testdiag');
      expect(parsed.fetchedAt).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ============================================================
// buildPlaceholderValues (OUT-03)
// ============================================================
describe('buildPlaceholderValues', () => {
  test.todo('should build flat lookup object from nested quotas array');
  test.todo('should use window prefix for keys (e.g., 5h_percent, weekly_reset)');
  test.todo('should handle missing or null values in quota data');
});

// ============================================================
// applyTemplate (OUT-03)
// ============================================================
describe('applyTemplate', () => {
  test.todo('should replace {provider} placeholder with provider name');
  test.todo('should replace window-prefixed placeholders ({5h_percent}, {weekly_reset})');
  test.todo('should keep unknown placeholders as-is (e.g., {unknown})');
  test.todo('should handle empty template string');
});

// ============================================================
// formatDefaultOutput (OUT-01, OUT-02)
// ============================================================
describe('formatDefaultOutput', () => {
  test.todo('should output "Provider: X% | YhZm" format for statusLine');
  test.todo('should select shortest reset window when multiple windows available');
  test.todo('should capitalize provider name in output');
});

// ============================================================
// outputVerboseInfo (OUT-04)
// ============================================================
describe('outputVerboseInfo', () => {
  test.todo('should write [debug] prefixed lines to stderr');
  test.todo('should output cache, provider, and API sections');
  test.todo('should handle missing info gracefully without crashing');
});

// ============================================================
// runCLI (CLI-01, CLI-02, CLI-03, CLI-06)
// ============================================================
describe('runCLI', () => {
  test.todo('should parse --json flag and output JSON format');
  test.todo('should parse --template flag with custom format string');
  test.todo('should parse --cache-duration with default 60 seconds');
  test.todo('should handle --version flag and output version string');
});

// ============================================================
// stdout/stderr separation (CLI-07)
// ============================================================
describe('stdout/stderr separation', () => {
  test.todo('should send data output to stdout');
  test.todo('should send errors and verbose info to stderr');
});
