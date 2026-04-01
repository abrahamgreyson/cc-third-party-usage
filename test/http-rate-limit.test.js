import { describe, it, expect, mock } from 'bun:test';
import { fetchWithRetry, DEFAULT_CONFIG } from '../usage.mjs';

///// HTTP-04: Rate Limit (429) Handling /////

describe('HTTP-04: Rate Limit (429) Handling', () => {
  it('should respect Retry-After header on 429 response', async () => {
    let attempts = 0;
    const start = Date.now();

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(new Response(null, {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '1' } // 1 second
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const response = await fetchWithRetry('https://test.example.com/api');
      expect(attempts).toBe(2);
      expect(response.ok).toBe(true);

      // Should have waited at least 1 second from Retry-After
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(900);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should use exponential backoff if Retry-After not present', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(new Response(null, { status: 429 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const start = Date.now();
      await fetchWithRetry('https://test.example.com/api', {
        initialDelay: 100,
      });
      const elapsed = Date.now() - start;

      expect(attempts).toBe(3);
      // Should have taken at least 100 + 200 = 300ms for delays
      expect(elapsed).toBeGreaterThan(250);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should cap retry delay at 10 seconds max', async () => {
    // This is verified by checking the maxDelay configuration
    expect(DEFAULT_CONFIG.maxRetryDelay).toBe(10000);
  });

  it('should parse Retry-After as seconds when numeric', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.resolve(new Response(null, {
          status: 429,
          headers: { 'Retry-After': '1' } // 1 second
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    try {
      const start = Date.now();
      const response = await fetchWithRetry('https://test.example.com/api');
      const elapsed = Date.now() - start;

      // Should have waited approximately 1 second from Retry-After: 1
      expect(attempts).toBe(2);
      expect(elapsed).toBeGreaterThan(900);
      expect(response.ok).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle missing Retry-After header gracefully', async () => {
    let attempts = 0;

    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      attempts++;
      if (attempts < 2) {
        // 429 without Retry-After header
        return Promise.resolve(new Response(null, { status: 429 }));
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
});
