///// Proxy Detection Tests /////
// Tests for PROXY-01: CC Switch proxy detection via environment variables

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mockEnv } from './conftest.js';
import { isProxyEnabled, getLocalAddressPatterns } from '../usage.mjs';

describe('getLocalAddressPatterns', () => {
  test('returns array of local address patterns', () => {
    const patterns = getLocalAddressPatterns();
    expect(patterns).toEqual(['localhost', '127.0.0.1', '0.0.0.0']);
  });
});

describe('isProxyEnabled', () => {
  let cleanup;

  afterEach(() => {
    if (cleanup) cleanup();
  });

  test('returns true when ANTHROPIC_BASE_URL contains localhost', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: 'http://localhost:8080/api' });
    expect(isProxyEnabled()).toBe(true);
  });

  test('returns true when ANTHROPIC_BASE_URL contains 127.0.0.1', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: 'http://127.0.0.1:8080/api' });
    expect(isProxyEnabled()).toBe(true);
  });

  test('returns true when ANTHROPIC_BASE_URL contains 0.0.0.0', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: 'http://0.0.0.0:8080/api' });
    expect(isProxyEnabled()).toBe(true);
  });

  test('returns true when BASE_URL contains localhost (fallback)', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: undefined, BASE_URL: 'http://localhost:3000' });
    expect(isProxyEnabled()).toBe(true);
  });

  test('returns false when no proxy environment variables set', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: undefined, BASE_URL: undefined });
    expect(isProxyEnabled()).toBe(false);
  });

  test('returns false when BASE_URL is remote URL', () => {
    cleanup = mockEnv({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com' });
    expect(isProxyEnabled()).toBe(false);
  });

  test('prefers ANTHROPIC_BASE_URL over BASE_URL', () => {
    cleanup = mockEnv({
      ANTHROPIC_BASE_URL: 'http://localhost:8080',
      BASE_URL: 'https://api.example.com'
    });
    expect(isProxyEnabled()).toBe(true);
  });
});
