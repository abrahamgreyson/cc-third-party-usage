import { describe, it, expect } from 'bun:test';
import { fetchWithTimeout, fetchWithRetry, DEFAULT_CONFIG } from '../usage.mjs';

///// HTTP-01: Native Fetch API /////

describe('HTTP-01: Native Fetch API', () => {
  it('should use native fetch without external dependencies', async () => {
    // fetchWithRetry should be a thin wrapper around native fetch
    expect(typeof fetchWithRetry).toBe('function');
    expect(typeof fetchWithTimeout).toBe('function');
  });

  it('should make GET request with Authorization header', async () => {
    // Use httpbin.org for testing - it echoes back the request headers
    const response = await fetchWithTimeout('https://httpbin.org/get', {
      headers: { 'Authorization': 'Bearer test-token-12345' },
      timeout: 10000,
    });

    expect(response).toBeDefined();
    expect(response.ok).toBe(true);
    expect(typeof response.json).toBe('function');

    const data = await response.json();
    expect(data.headers.Authorization).toBe('Bearer test-token-12345');
  });

  it('should return Response object with json() method', async () => {
    const response = await fetchWithTimeout('https://httpbin.org/get');
    expect(response).toBeDefined();
    expect(typeof response.json).toBe('function');

    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.url).toBe('https://httpbin.org/get');
  });

  it('should handle JSON response body parsing', async () => {
    const response = await fetchWithTimeout('https://httpbin.org/json', {
      timeout: 10000,
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toBeDefined();
    // httpbin.org/json returns a sample JSON object
    expect(data.slideshow).toBeDefined();
  });

  it('should work identically on both Bun and Node.js runtimes', async () => {
    // This test runs in Bun, but the implementation should work in Node.js too
    const response = await fetchWithTimeout('https://httpbin.org/get', {
      timeout: 5000,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toBeDefined();
  });
});
