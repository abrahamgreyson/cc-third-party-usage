import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { loadDatabaseModule, openDatabase, closeDatabase, detectRuntime } from '../usage.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

///// DB-01: bun:sqlite for Bun Runtime /////

describe('DB-01: bun:sqlite for Bun Runtime', () => {
  const testDir = join(tmpdir(), 'usage-test-bun');
  const dbPath = join(testDir, 'test.db');

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    await loadDatabaseModule();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should import bun:sqlite when running under Bun', async () => {
    // This test runs in Bun, so runtime should be 'bun'
    const runtime = detectRuntime();
    expect(runtime).toBe('bun');
  });

  it('should open database using bun:sqlite Database class', async () => {
    const db = await openDatabase(dbPath);
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
    closeDatabase(db);
  });

  it('should execute prepared statements with bun:sqlite', async () => {
    const db = await openDatabase(dbPath);

    // Create table
    db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');

    // Insert with prepared statement
    const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    insert.run('Test User', 'test@example.com');

    // Query with prepared statement
    const select = db.prepare('SELECT * FROM users WHERE name = ?');
    const result = select.get('Test User');

    expect(result).toBeDefined();
    expect(result.name).toBe('Test User');
    expect(result.email).toBe('test@example.com');

    closeDatabase(db);
  });

  it('should handle query errors gracefully', async () => {
    const db = await openDatabase(dbPath);

    // Try to query non-existent table
    expect(() => {
      db.run('SELECT * FROM nonexistent_table');
    }).toThrow();

    closeDatabase(db);
  });

  it('should close database connection properly', async () => {
    const db = await openDatabase(dbPath);
    expect(db).toBeDefined();

    // Should not throw when closing
    expect(() => closeDatabase(db)).not.toThrow();
  });
});
