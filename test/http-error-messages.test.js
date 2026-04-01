import { describe, it, expect, mock } from 'bun:test';
import { fetchWithRetry, fetchWithTimeout, NetworkError, APIError } from '../usage.mjs';

///// HTTP-05: Clear Error Messages /////

describe('HTTP-05: Clear Error Messages', () => {
  it('should provide actionable message on network failure', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      return Promise.reject(error);
    });

    try {
      await fetchWithRetry('https://test.example.com/api', {
        maxAttempts: 1,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('network');
      expect(error.message).toMatch(/connection|failed/i);
      expect(error.message).toMatch(/check|try/i); // Suggests action
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should provide actionable message on timeout', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 100);
      });
    });

    try {
      await fetchWithTimeout('https://test.example.com/api', {
        timeout: 50,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain('timed out');
      expect(error.message).toMatch(/\d+ms/); // Shows timeout value
      expect(error.message).toMatch(/network|timeout|increase/i); // Suggests action
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should provide actionable message on 4xx client error', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return Promise.resolve(new Response(null, { status: 401, statusText: 'Unauthorized' }));
    });

    try {
      await fetchWithRetry('https://test.example.com/api');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('401');
      expect(error.message).toMatch(/credentials|authentication|unauthorized/i);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should provide actionable message on 5xx server error', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return Promise.resolve(new Response(null, { status: 503, statusText: 'Service Unavailable' }));
    });

    try {
      await fetchWithRetry('https://test.example.com/api', {
        maxAttempts: 1,
        initialDelay: 10,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toContain('503');
      expect(error.message).toMatch(/failed|unavailable/i);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should include request details in error message', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' }));
    });

    try {
      await fetchWithRetry('https://api.example.com/v1/endpoint', {
        method: 'POST',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toMatch(/404|Not Found/i);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should suggest recovery steps in error message', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      const error = new Error('getaddrinfo ENOTFOUND invalid-domain');
      error.code = 'ENOTFOUND';
      return Promise.reject(error);
    });

    try {
      await fetchWithRetry('https://invalid-domain.example.com/api', {
        maxAttempts: 1,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toMatch(/check|verify|connection/i); // Suggests checking
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should not expose sensitive information in error messages', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      return Promise.resolve(new Response(null, { status: 401 }));
    });

    try {
      await fetchWithRetry('https://api.example.com/endpoint', {
        headers: {
          'Authorization': 'Bearer super-secret-token-12345',
        },
      });
    } catch (error) {
      expect(error.message).not.toContain('super-secret-token');
      expect(error.message).not.toContain('Bearer');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
