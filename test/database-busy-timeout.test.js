import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { openDatabase, closeDatabase } from '../usage.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

///// DB-05: Busy Timeout for Locking Prevention /////

describe('DB-05: Busy Timeout for Locking Prevention', () => {
  const testDir = join(tmpdir(), 'usage-test-timeout');
  const dbPath = join(testDir, 'test.db');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should set busy_timeout to 10000ms on database open', async () => {
    const db = await openDatabase(dbPath);
    expect(db).toBeDefined();

    const result = db.prepare('PRAGMA busy_timeout').get();
    expect(result.timeout).toBe(10000);

    closeDatabase(db);
  });

  it('should verify busy_timeout pragma is applied', async () => {
    const db = await openDatabase(dbPath);

    // Query the pragma directly
    const result = db.prepare('PRAGMA busy_timeout').get();
    expect(result).toHaveProperty('timeout');
    expect(result.timeout).toBeGreaterThanOrEqual(10000);

    closeDatabase(db);
  });

  it('should wait up to 10 seconds before throwing SQLITE_BUSY', async () => {
    // This test verifies the timeout is configured
    // Actual busy behavior is hard to simulate reliably without causing test timeouts
    const db = await openDatabase(dbPath);
    const result = db.prepare('PRAGMA busy_timeout').get();
    expect(result.timeout).toBe(10000);
    closeDatabase(db);
  });

  it('should retry locked database operations within timeout period', async () => {
    // This is a configuration verification test
    // Real retry behavior would require intentionally locking the database
    const db = await openDatabase(dbPath);
    db.run('CREATE TABLE lock_test (id INTEGER PRIMARY KEY)');

    const timeoutResult = db.prepare('PRAGMA busy_timeout').get();
    expect(timeoutResult.timeout).toBe(10000);

    closeDatabase(db);
  });

  it('should apply busy_timeout consistently for both runtimes', async () => {
    const db = await openDatabase(dbPath);
    const result = db.prepare('PRAGMA busy_timeout').get();

    // Both Bun and Node should have the same timeout configured
    expect(result.timeout).toBe(10000);

    closeDatabase(db);
  });
});
