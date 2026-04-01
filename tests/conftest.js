///// Test Fixtures /////
// Shared test utilities for Phase 1 test infrastructure

import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Creates a temporary SQLite database for testing.
 * Returns the database path and a cleanup function.
 *
 * @param {string} [dbPath] - Optional custom path for the database
 * @returns {{ path: string, cleanup: () => void }}
 */
export function createTestDatabase(dbPath) {
  const tempDir = mkdtempSync(join(tmpdir(), 'cc-usage-test-'));
  const finalPath = dbPath || join(tempDir, `test-${randomBytes(8).toString('hex')}.db`);

  // Ensure parent directory exists
  const parentDir = finalPath.substring(0, finalPath.lastIndexOf('/'));
  if (parentDir && !existsSync(parentDir)) {
    mkdtempSync(parentDir);
  }

  return {
    path: finalPath,
    cleanup: () => {
      try {
        if (existsSync(finalPath)) {
          rmSync(finalPath, { force: true });
        }
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Creates a mock Response object for fetch testing.
 * Mimics the standard Response interface with status, headers, and json() method.
 *
 * @param {any} data - The data to return from json()
 * @param {object} [options] - Response options
 * @param {number} [options.status=200] - HTTP status code
 * @param {string} [options.statusText='OK'] - HTTP status text
 * @param {object} [options.headers={}] - Response headers
 * @returns {{ ok: boolean, status: number, statusText: string, headers: { get: (key: string) => string | null }, json: () => Promise<any> }}
 */
export function mockFetchResponse(data, options = {}) {
  const {
    status = 200,
    statusText = 'OK',
    headers = {}
  } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (key) => headers[key?.toLowerCase()] || null
    },
    json: () => Promise.resolve(data)
  };
}

/**
 * Helper to assert that a promise resolves within a time limit.
 * Races the promise against a timeout and rejects if timeout occurs.
 *
 * @param {Promise<any>} promise - The promise to test
 * @param {number} ms - Maximum time in milliseconds
 * @returns {Promise<any>} - Resolves with the promise result or rejects with timeout error
 */
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Promise did not resolve within ${ms}ms`));
      }, ms);
    })
  ]);
}

/**
 * Promise-based delay for async testing.
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} - Resolves after the specified delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock database result for SQLite testing.
 *
 * @param {any[]} rows - Array of row objects
 * @returns {{ rows: any[], changes: number, lastInsertRowid: number | bigint }}
 */
export function mockDbResult(rows = [], changes = 0, lastInsertRowid = 0) {
  return {
    rows,
    changes,
    lastInsertRowid
  };
}

/**
 * Creates mock environment variables for testing.
 * Returns a function to restore the original environment.
 *
 * @param {object} vars - Environment variables to set
 * @returns {() => void} - Cleanup function to restore original env
 */
export function mockEnv(vars) {
  const original = {};

  for (const [key, value] of Object.entries(vars)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 * Generates a random port number for test servers.
 *
 * @returns {number} - Random port between 10000 and 65535
 */
export function randomPort() {
  return Math.floor(Math.random() * (65535 - 10000) + 10000);
}

/**
 * Creates a mock CC Switch database for testing proxy credential extraction.
 * Creates an in-memory SQLite database with the CC Switch providers schema.
 *
 * @param {object} [config] - Configuration options
 * @param {string} [config.apiKey='test-api-key-12345'] - API key to store
 * @param {string} [config.baseUrl='https://open.bigmodel.cn/api/anthropic'] - Base URL to store
 * @param {string} [config.providerId='default'] - Provider ID
 * @param {string} [config.providerName='GLM - test'] - Provider name
 * @returns {Promise<{ db: any, path: string, cleanup: () => void }>}
 */
export async function createMockCCSwitchDatabase(config = {}) {
  const {
    apiKey = 'test-api-key-12345',
    baseUrl = 'https://open.bigmodel.cn/api/anthropic',
    providerId = 'default',
    providerName = 'GLM - test'
  } = config;

  // Load database module (handles bun:sqlite vs node:sqlite)
  const { loadDatabaseModule } = await import('../usage.mjs');
  const Database = await loadDatabaseModule();

  // Create in-memory database
  const db = new Database(':memory:');
  const path = ':memory:';

  // Create providers table
  db.run(`
    CREATE TABLE providers (
      id TEXT PRIMARY KEY,
      name TEXT,
      settings_config TEXT
    )
  `);

  // Insert default provider with settings_config JSON
  const settingsConfig = {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: baseUrl
    }
  };

  db.run(
    'INSERT INTO providers (id, name, settings_config) VALUES (?, ?, ?)',
    [providerId, providerName, JSON.stringify(settingsConfig)]
  );

  // Return database and cleanup function
  return {
    db,
    path,
    cleanup: () => {
      try {
        db.close();
      } catch {
        // Ignore cleanup errors for in-memory databases
      }
    }
  };
}
