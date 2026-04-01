///// Provider Detection Tests /////
// Tests for PROV-01: Provider type detection based on baseUrl domain

import { describe, test, expect } from 'bun:test';
import { ConfigError, EXIT_CODES } from '../usage.mjs';
import { detectProvider } from '../usage.mjs';

describe('detectProvider', () => {
  test('returns "kimi" for https://api.kimi.com/coding/', () => {
    expect(detectProvider('https://api.kimi.com/coding/')).toBe('kimi');
  });

  test('returns "kimi" for https://kimi.com/v1/usages', () => {
    expect(detectProvider('https://kimi.com/v1/usages')).toBe('kimi');
  });

  test('returns "glm" for https://open.bigmodel.cn/api/anthropic', () => {
    expect(detectProvider('https://open.bigmodel.cn/api/anthropic')).toBe('glm');
  });

  test('returns "glm" for https://bigmodel.cn/api/paas/v4', () => {
    expect(detectProvider('https://bigmodel.cn/api/paas/v4')).toBe('glm');
  });

  test('throws ConfigError for unsupported domain (ark.cn-beijing.volces.com)', () => {
    expect(() => detectProvider('https://ark.cn-beijing.volces.com/api/coding'))
      .toThrow(ConfigError);
  });

  test('throws ConfigError for unsupported domain (api.openai.com)', () => {
    expect(() => detectProvider('https://api.openai.com/v1'))
      .toThrow(ConfigError);
  });

  test('throws ConfigError for invalid URL (not-a-url)', () => {
    expect(() => detectProvider('not-a-valid-url'))
      .toThrow(ConfigError);
  });

  test('throws ConfigError for invalid URL (missing protocol)', () => {
    expect(() => detectProvider('api.example.com/v1'))
      .toThrow(ConfigError);
  });

  test('handles subdomains correctly (api.kimi.com returns kimi)', () => {
    expect(detectProvider('https://api.kimi.com/v1')).toBe('kimi');
  });

  test('error message includes unsupported hostname', () => {
    try {
      detectProvider('https://unsupported.example.com/api');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toContain('unsupported.example.com');
      expect(error.exitCode).toBe(EXIT_CODES.CONFIG_ERROR);
    }
  });

  test('error message suggests supported providers', () => {
    try {
      detectProvider('https://api.unknown.com/v1');
    } catch (error) {
      expect(error.message).toContain('kimi.com');
      expect(error.message).toContain('bigmodel.cn');
    }
  });
});
