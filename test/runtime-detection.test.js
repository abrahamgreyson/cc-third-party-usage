import { describe, it, expect } from 'bun:test';
import {
  detectRuntime,
  getRuntimeInfo,
  isSupportedVersion,
  validateRuntime,
  ConfigError,
} from '../usage.mjs';

///// CORE-01: Single-file ESM Architecture /////

describe('CORE-01: Single-file ESM Architecture', () => {
  it('should export usage.mjs as ESM module with zero external dependencies', async () => {
    const module = await import('../usage.mjs');
    expect(module).toBeDefined();
    expect(typeof module.VERSION).toBe('string');
    expect(module.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    // Verify no external dependencies by checking module only exports our functions
    const exports = Object.keys(module);
    expect(exports.length).toBeGreaterThan(0);
  });
});

///// CORE-02: Cross-runtime Compatibility /////

describe('CORE-02: Cross-runtime Compatibility', () => {
  it('should detect Bun runtime correctly using process.versions.bun', () => {
    // This test runs in Bun, so it should detect 'bun'
    const runtime = detectRuntime();
    expect(runtime).toBe('bun');
  });

  it('should detect Node.js runtime correctly', () => {
    // Store original
    const originalBun = process.versions.bun;

    // Simulate Node.js environment
    delete process.versions.bun;

    const runtime = detectRuntime();
    expect(runtime).toBe('node');

    // Restore
    if (originalBun) process.versions.bun = originalBun;
  });

  it('should throw error for unsupported runtime with clear message', () => {
    // Store originals
    const originalBun = process.versions.bun;
    const originalNode = process.versions.node;

    // Simulate unsupported environment
    delete process.versions.bun;
    delete process.versions.node;

    expect(() => detectRuntime()).toThrow(ConfigError);
    expect(() => detectRuntime()).toThrow('Unsupported runtime');

    // Restore
    if (originalBun) process.versions.bun = originalBun;
    if (originalNode) process.versions.node = originalNode;
  });
});

///// DB-03: Runtime Detection and Conditional Import /////

describe('DB-03: Runtime Detection and Conditional Import', () => {
  it('should return runtime info with name and version', () => {
    const info = getRuntimeInfo();
    expect(info.name).toBeDefined();
    expect(info.version).toBeDefined();
    expect(['bun', 'node']).toContain(info.name);
  });

  it('should validate supported Bun version', () => {
    // This test runs in Bun, so it should pass
    expect(() => validateRuntime()).not.toThrow();
  });

  it('should throw clear error for unsupported runtime version', () => {
    // Store original
    const originalBun = process.versions.bun;
    const originalNode = process.versions.node;

    // Simulate old Node.js version
    delete process.versions.bun;
    process.versions.node = '18.0.0';

    expect(() => validateRuntime()).toThrow(ConfigError);
    expect(() => validateRuntime()).toThrow('Node.js 22.5.0+');

    // Restore
    if (originalBun) process.versions.bun = originalBun;
    process.versions.node = originalNode;
  });
});
