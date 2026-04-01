///// Provider Detection Tests /////
// Tests for PROV-01: Provider type detection based on baseUrl domain

import { describe, test, expect } from 'bun:test';
import { ConfigError } from '../usage.mjs';
// import { detectProvider, validateProvider } from '../usage.mjs';

describe('detectProvider', () => {
  // Tests for D-05: Domain-based provider detection

  test.skip('returns "kimi" for https://api.kimi.com/coding/', () => {
    // const provider = detectProvider('https://api.kimi.com/coding/');
    // expect(provider).toBe('kimi');
  });

  test.skip('returns "kimi" for https://kimi.com/v1/usages', () => {
    // const provider = detectProvider('https://kimi.com/v1/usages');
    // expect(provider).toBe('kimi');
  });

  test.skip('returns "glm" for https://open.bigmodel.cn/api/anthropic', () => {
    // const provider = detectProvider('https://open.bigmodel.cn/api/anthropic');
    // expect(provider).toBe('glm');
  });

  test.skip('returns "glm" for https://bigmodel.cn/api/paas/v4', () => {
    // const provider = detectProvider('https://bigmodel.cn/api/paas/v4');
    // expect(provider).toBe('glm');
  });

  test.skip('throws ConfigError for unsupported domain (ark.cn-beijing.volces.com)', () => {
    // expect(() => detectProvider('https://ark.cn-beijing.volces.com/api/coding'))
    //   .toThrow(ConfigError);
  });

  test.skip('throws ConfigError for unsupported domain (api.openai.com)', () => {
    // expect(() => detectProvider('https://api.openai.com/v1'))
    //   .toThrow(ConfigError);
  });

  test.skip('throws ConfigError for invalid URL (not-a-url)', () => {
    // expect(() => detectProvider('not-a-url')).toThrow(ConfigError);
  });

  test.skip('throws ConfigError for invalid URL (missing protocol)', () => {
    // expect(() => detectProvider('api.kimi.com/v1')).toThrow(ConfigError);
  });

  test.skip('handles subdomains correctly (api.kimi.com returns kimi)', () => {
    // const provider = detectProvider('https://api.kimi.com/coding/');
    // expect(provider).toBe('kimi');
  });

  test.skip('error message includes unsupported hostname', () => {
    // try {
    //   detectProvider('https://api.openai.com/v1');
    // } catch (error) {
    //   expect(error).toBeInstanceOf(ConfigError);
    //   expect(error.message).toContain('api.openai.com');
    //   expect(error.message).toMatch(/unsupported/i);
    // }
  });
});

describe('validateProvider', () => {
  test.skip('returns true for valid provider "kimi"', () => {
    // expect(validateProvider('kimi')).toBe(true);
  });

  test.skip('returns true for valid provider "glm"', () => {
    // expect(validateProvider('glm')).toBe(true);
  });

  test.skip('throws ConfigError for invalid provider string', () => {
    // expect(() => validateProvider('openai')).toThrow(ConfigError);
  });

  test.skip('error message lists supported providers', () => {
    // try {
    //   validateProvider('invalid');
    // } catch (error) {
    //   expect(error).toBeInstanceOf(ConfigError);
    //   expect(error.message).toContain('kimi');
    //   expect(error.message).toContain('glm');
    // }
  });
});
