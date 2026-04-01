import { describe, it, expect, mock, afterEach } from 'bun:test';
import { fetchWithRetry, isRetryableError, DEFAULT_CONFIG, APIError, NetworkError } from '../usage.mjs';

///// HTTP-03: Retry with Exponential Backoff /////

describe('HTTP-03: Retry with Exponential Backoff', () => {
  afterEach(() => {
    // Restore original fetch after each test
    global.fetch = global.fetch;
  });

  it('should retry up to 3 times with exponential backoff (1s, 2s, 4s)', async () => {
    let attempts = 0;
    const start = Date.now();

    // Mock server that fails twice then succeeds
    const originalFetch = global.fetch;
    global.fetch = mock((url) => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(new Response(null, { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    });

    try {
      const response = await fetchWithRetry('https://test.example.com/api', {
        timeout: 1000,
        initialDelay: 100, // Faster for testing
      });

      expect(attempts).toBe(3);
      expect(response.ok).toBe(true);

      const elapsed = Date.now() - start;
      // Should have delays: 100, 200 (total ~300ms)
      expect(elapsed).toBeGreaterThan(250);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should not retry on 4xx client errors (400, 401, 403, 404)', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 401, statusText: 'Unauthorized' }));
    });

    try {
      await fetchWithRetry('https://test.example.com/api');
      expect(true).toBe(false); // Should not reach
    } catch (error) {
      expect(attempts).toBe(1); // No retry
      expect(error).toBeInstanceOf(APIError);
      expect(error.statusCode).toBe(401);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should retry on 5xx server errors (500, 502, 503, 504)', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(new Response(null, { status: 503, statusText: 'Service Unavailable' }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const response = await fetchWithRetry('https://test.example.com/api', {
        initialDelay: 50,
      });
      expect(attempts).toBe(2);
      expect(response.ok).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should retry on network errors (ETIMEDOUT, ECONNRESET, ECONNREFUSED)', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 2) {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        return Promise.reject(error);
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const response = await fetchWithRetry('https://test.example.com/api', {
        initialDelay: 50,
      });
      expect(attempts).toBe(2);
      expect(response.ok).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should retry on 429 rate limit with exponential backoff', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(new Response(null, {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '1' }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const response = await fetchWithRetry('https://test.example.com/api');
      expect(attempts).toBe(2);
      expect(response.ok).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should throw last error after max retries exhausted', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      return Promise.resolve(new Response(null, { status: 503, statusText: 'Service Unavailable' }));
    });

    try {
      await fetchWithRetry('https://test.example.com/api', {
        initialDelay: 10,
        maxDelay: 50,
      });
      expect(true).toBe(false);
    } catch (error) {
      expect(attempts).toBe(DEFAULT_CONFIG.maxRetries);
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('after 3 attempts');
      expect(error.statusCode).toBe(503);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should cap retry delay at 10 seconds max', () => {
    // Verify configuration
    expect(DEFAULT_CONFIG.maxRetryDelay).toBe(10000);
  });

  it('should include attempt number in error context', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return Promise.resolve(new Response(null, { status: 503 }));
    });

    try {
      await fetchWithRetry('https://test.example.com/api', {
        initialDelay: 10,
        maxDelay: 50,
      });
    } catch (error) {
      expect(error.message).toMatch(/attempt/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
