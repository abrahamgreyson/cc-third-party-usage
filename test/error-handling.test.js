import { describe, it, expect } from 'bun:test';
import {
  CliError,
  UsageError,
  ConfigError,
  NetworkError,
  APIError,
  EXIT_CODES,
} from '../usage.mjs';

///// CORE-03: Fail-fast Error Handling /////

describe('CORE-03: Fail-fast Error Handling', () => {
  it('should throw UsageError with actionable message', () => {
    const error = new UsageError('Test usage error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CliError);
    expect(error.name).toBe('UsageError');
    expect(error.exitCode).toBe(EXIT_CODES.ERROR);
    expect(error.message).toBe('Test usage error');
  });

  it('should throw ConfigError with actionable message', () => {
    const error = new ConfigError('API key not found in environment');
    expect(error).toBeInstanceOf(CliError);
    expect(error.name).toBe('ConfigError');
    expect(error.exitCode).toBe(EXIT_CODES.CONFIG_ERROR);
  });

  it('should throw APIError with actionable message', () => {
    const error = new APIError('API request failed', 500);
    expect(error).toBeInstanceOf(CliError);
    expect(error.name).toBe('APIError');
    expect(error.exitCode).toBe(EXIT_CODES.API_ERROR);
    expect(error.statusCode).toBe(500);
  });

  it('should throw NetworkError with actionable message', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new NetworkError('Failed to connect to API server', originalError);
    expect(error).toBeInstanceOf(CliError);
    expect(error.name).toBe('NetworkError');
    expect(error.exitCode).toBe(EXIT_CODES.NETWORK_ERROR);
    expect(error.originalError).toBe(originalError);
  });
});

///// CORE-04: Semantic Exit Codes /////

describe('CORE-04: Semantic Exit Codes', () => {
  it('should have SUCCESS exit code 0', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it('should have ERROR exit code 1', () => {
    expect(EXIT_CODES.ERROR).toBe(1);
  });

  it('should have CONFIG_ERROR exit code 2', () => {
    expect(EXIT_CODES.CONFIG_ERROR).toBe(2);
  });

  it('should have NETWORK_ERROR exit code 3', () => {
    expect(EXIT_CODES.NETWORK_ERROR).toBe(3);
  });

  it('should have API_ERROR exit code 4', () => {
    expect(EXIT_CODES.API_ERROR).toBe(4);
  });
});
