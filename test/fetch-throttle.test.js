///// Fetch Throttle Tests /////
// Tests for the background-fetch throttle (spawn-storm prevention).

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DEFAULT_CONFIG,
  getFetchStampPath,
  shouldThrottleFetch,
  markFetchSpawned,
} from '../usage.mjs';

const STAMP_PATH = getFetchStampPath();

function removeStamp() {
  try { unlinkSync(STAMP_PATH); } catch { /* not present */ }
}

function ensureStampDir() {
  try { mkdirSync(join(tmpdir(), 'cc-usage-cache'), { recursive: true }); } catch {}
}

describe('getFetchStampPath', () => {
  test('lives in the shared cache directory under os.tmpdir()', () => {
    expect(getFetchStampPath()).toContain(tmpdir());
    expect(getFetchStampPath()).toContain('cc-usage-fetch-stamp.json');
  });
});

describe('shouldThrottleFetch', () => {
  beforeEach(() => { ensureStampDir(); removeStamp(); });
  afterEach(() => { removeStamp(); });

  test('returns false when no stamp exists (cold start fetches)', () => {
    expect(existsSync(STAMP_PATH)).toBe(false);
    expect(shouldThrottleFetch(30000)).toBe(false);
  });

  test('returns true within the throttle window after a spawn', () => {
    markFetchSpawned();
    // A 30s window, measured immediately after marking → throttled.
    expect(shouldThrottleFetch(30000)).toBe(true);
  });

  test('returns false when window is 0ms (boundary)', () => {
    markFetchSpawned();
    expect(shouldThrottleFetch(0)).toBe(false);
  });

  test('fail-open on corrupted stamp file', () => {
    writeFileSync(STAMP_PATH, 'not-json');
    expect(shouldThrottleFetch(30000)).toBe(false);
  });

  test('fail-open when lastSpawnAt is not a number', () => {
    writeFileSync(STAMP_PATH, JSON.stringify({ lastSpawnAt: 'oops' }));
    expect(shouldThrottleFetch(30000)).toBe(false);
  });
});

describe('markFetchSpawned', () => {
  beforeEach(() => { ensureStampDir(); removeStamp(); });
  afterEach(() => { removeStamp(); });

  test('writes a stamp with a numeric lastSpawnAt', () => {
    markFetchSpawned();
    expect(existsSync(STAMP_PATH)).toBe(true);
    const parsed = JSON.parse(readFileSync(STAMP_PATH, 'utf-8'));
    expect(typeof parsed.lastSpawnAt).toBe('number');
    expect(parsed.lastSpawnAt).toBeLessThanOrEqual(Date.now());
  });

  test('round-trips with shouldThrottleFetch', () => {
    markFetchSpawned();
    expect(shouldThrottleFetch(DEFAULT_CONFIG.fetchThrottle * 1000)).toBe(true);
    removeStamp();
    expect(shouldThrottleFetch(DEFAULT_CONFIG.fetchThrottle * 1000)).toBe(false);
  });
});
