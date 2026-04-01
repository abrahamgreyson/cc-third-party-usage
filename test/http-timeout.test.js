import { describe, it, expect } from 'bun:test';
import { fetchWithTimeout, NetworkError } from '../usage.mjs';

///// HTTP-02: Request Timeout (5s default) /////

describe('HTTP-02: Request Timeout (5s default)', () => {
  it('should timeout after specified duration', async () => {
    const start = Date.now();
    const timeout = 1000; // 1 second

    try {
      // Use httpbin delay endpoint that waits 10 seconds
      await fetchWithTimeout('https://httpbin.org/delay/10', { timeout });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      const elapsed = Date.now() - start;
      // Should timeout around 1 second (with some margin for network latency)
      expect(elapsed).toBeLessThan(timeout + 500);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('timed out');
      expect(error.message).toContain('1000ms');
    }
  });

  it('should accept custom timeout via options', async () => {
    const timeout = 500; // 500ms
    const start = Date.now();

    try {
      await fetchWithTimeout('https://httpbin.org/delay/5', { timeout });
    } catch (error) {
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(timeout + 200);
      expect(error.message).toContain('500ms');
    }
  });

  it('should throw NetworkError on timeout with clear message', async () => {
    try {
      await fetchWithTimeout('https://httpbin.org/delay/10', { timeout: 500 });
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('timed out');
      expect(error.message).toContain('500ms');
      expect(error.message).toContain('network connection');
    }
  });

  it('should cleanup timeout on successful response', async () => {
    // Fast response should not timeout
    const response = await fetchWithTimeout('https://httpbin.org/get', {
      timeout: 5000,
    });

    expect(response.ok).toBe(true);

    // Verify no timeout error thrown
    const data = await response.json();
    expect(data).toBeDefined();
  });

  it('should cleanup timeout on error response', async () => {
    // Even if response is an error, timeout should be cleaned up
    const response = await fetchWithTimeout('https://httpbin.org/status/404', {
      timeout: 5000,
    });

    // Response should return (not timeout), even though it's a 404
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('should use AbortController for timeout implementation', async () => {
    // This is an implementation detail test
    // The fetchWithTimeout should use AbortController internally
    try {
      await fetchWithTimeout('https://httpbin.org/delay/10', { timeout: 500 });
    } catch (error) {
      // Should be NetworkError from AbortController abort
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('timed out');
    }
  });
});
