import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { openDatabase, closeDatabase } from '../usage.mjs';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

///// DB-04: WAL Mode for Concurrent Access /////

describe('DB-04: WAL Mode for Concurrent Access', () => {
  const testDir = join(tmpdir(), 'usage-test-wal');
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

  it('should enable WAL mode on database open', async () => {
    const db = await openDatabase(dbPath);
    expect(db).toBeDefined();

    // Verify WAL mode is enabled
    const result = db.prepare('PRAGMA journal_mode').get();
    expect(result.journal_mode.toLowerCase()).toBe('wal');

    closeDatabase(db);
  });

  it('should allow concurrent reads with WAL enabled', async () => {
    const db1 = await openDatabase(dbPath);

    // Create table and insert data
    db1.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
    db1.run('INSERT INTO test (value) VALUES (?)', ['test-value']);

    // Open second connection for concurrent read
    const db2 = await openDatabase(dbPath);
    const result = db2.prepare('SELECT * FROM test').all();
    expect(result.length).toBe(1);
    expect(result[0].value).toBe('test-value');

    closeDatabase(db1);
    closeDatabase(db2);
  });

  it('should verify journal_mode is WAL after open', async () => {
    const db = await openDatabase(dbPath);
    const result = db.prepare('PRAGMA journal_mode').get();
    expect(result.journal_mode.toLowerCase()).toBe('wal');
    closeDatabase(db);
  });

  it('should handle concurrent read/write without SQLITE_BUSY errors', async () => {
    const db1 = await openDatabase(dbPath);
    const db2 = await openDatabase(dbPath);

    // Create table
    db1.run('CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, value TEXT)');

    // Writer
    db1.run('INSERT INTO concurrent_test (value) VALUES (?)', ['write-1']);

    // Reader
    const result = db2.prepare('SELECT * FROM concurrent_test').all();
    expect(result.length).toBe(1);

    closeDatabase(db1);
    closeDatabase(db2);
  });

  it('should persist WAL setting across database connections', async () => {
    // Open and close first connection
    const db1 = await openDatabase(dbPath);
    db1.run('CREATE TABLE persist_test (id INTEGER PRIMARY KEY)');
    closeDatabase(db1);

    // Open second connection and verify WAL mode persists
    const db2 = await openDatabase(dbPath);
    const result = db2.prepare('PRAGMA journal_mode').get();
    expect(result.journal_mode.toLowerCase()).toBe('wal');
    closeDatabase(db2);
  });
});
