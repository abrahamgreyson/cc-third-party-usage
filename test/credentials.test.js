///// Unified Credential Resolution Tests /////
// Tests for PROV-02~03: Credential resolution from proxy or environment

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mockEnv, createMockCCSwitchDatabase } from '../tests/conftest.js';
import { ConfigError } from '../usage.mjs';
// import { getCredentials, getEnvCredentials } from '../usage.mjs';

describe('getCredentials', () => {
  // Tests for unified credential resolution

  test.skip('when proxy enabled, extracts credentials from CC Switch database', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_BASE_URL: 'http://localhost:8080/api'
    });

    try {
      // Mock or use actual database path
      // const credentials = await getCredentials();
      // expect(credentials.apiKey).toBeDefined();
      // expect(credentials.baseUrl).toBeDefined();
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy enabled, detects provider from baseUrl', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_BASE_URL: 'http://localhost:8080/api'
    });

    try {
      // const credentials = await getCredentials();
      // expect(credentials.provider).toMatch(/^(kimi|glm)$/);
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy enabled, returns { apiKey, baseUrl, provider }', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_BASE_URL: 'http://localhost:8080/api'
    });

    try {
      // const credentials = await getCredentials();
      // expect(credentials).toHaveProperty('apiKey');
      // expect(credentials).toHaveProperty('baseUrl');
      // expect(credentials).toHaveProperty('provider');
      // expect(typeof credentials.apiKey).toBe('string');
      // expect(typeof credentials.baseUrl).toBe('string');
      // expect(typeof credentials.provider).toBe('string');
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy disabled, reads ANTHROPIC_API_KEY from environment', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: 'test-api-key-67890',
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });

    try {
      // const credentials = await getCredentials();
      // expect(credentials.apiKey).toBe('test-api-key-67890');
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy disabled, reads ANTHROPIC_AUTH_TOKEN as fallback', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_AUTH_TOKEN: 'test-auth-token-12345',
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });

    try {
      // const credentials = await getCredentials();
      // expect(credentials.apiKey).toBe('test-auth-token-12345');
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy disabled, returns { apiKey, provider: null }', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: 'test-api-key',
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });

    try {
      // const credentials = await getCredentials();
      // expect(credentials.apiKey).toBe('test-api-key');
      // expect(credentials.provider).toBeNull();
      // expect(credentials.baseUrl).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy disabled and no env vars, throws ConfigError', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_AUTH_TOKEN: undefined,
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });

    try {
      // await expect(getCredentials()).rejects.toThrow(ConfigError);
    } finally {
      cleanup();
    }
  });

  test.skip('when proxy enabled but database fails, throws ConfigError (no fallback)', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_BASE_URL: 'http://localhost:8080/api'
    });

    try {
      // Database doesn't exist or is invalid
      // await expect(getCredentials()).rejects.toThrow(ConfigError);
    } finally {
      cleanup();
    }
  });

  test.skip('error message suggests setting env vars when no credentials found', async () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_AUTH_TOKEN: undefined,
      ANTHROPIC_BASE_URL: undefined,
      BASE_URL: undefined
    });

    try {
      // try {
      //   await getCredentials();
      // } catch (error) {
      //   expect(error).toBeInstanceOf(ConfigError);
      //   expect(error.message).toMatch(/ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN/);
      // }
    } finally {
      cleanup();
    }
  });
});

describe('getEnvCredentials', () => {
  // Tests for environment variable fallback

  test.skip('returns apiKey from ANTHROPIC_API_KEY when set', () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: 'test-api-key-12345'
    });

    try {
      // const credentials = getEnvCredentials();
      // expect(credentials.apiKey).toBe('test-api-key-12345');
    } finally {
      cleanup();
    }
  });

  test.skip('returns apiKey from ANTHROPIC_AUTH_TOKEN as fallback', () => {
    const cleanup = mockEnv({
      ANTHROPIC_AUTH_TOKEN: 'test-auth-token',
      ANTHROPIC_API_KEY: undefined
    });

    try {
      // const credentials = getEnvCredentials();
      // expect(credentials.apiKey).toBe('test-auth-token');
    } finally {
      cleanup();
    }
  });

  test.skip('prefers ANTHROPIC_API_KEY over ANTHROPIC_AUTH_TOKEN', () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: 'preferred-key',
      ANTHROPIC_AUTH_TOKEN: 'fallback-key'
    });

    try {
      // const credentials = getEnvCredentials();
      // expect(credentials.apiKey).toBe('preferred-key');
    } finally {
      cleanup();
    }
  });

  test.skip('throws ConfigError when no env vars set', () => {
    const cleanup = mockEnv({
      ANTHROPIC_API_KEY: undefined,
      ANTHROPIC_AUTH_TOKEN: undefined
    });

    try {
      // expect(() => getEnvCredentials()).toThrow(ConfigError);
    } finally {
      cleanup();
    }
  });
});
