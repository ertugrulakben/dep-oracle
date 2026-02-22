import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the max token count immediately', async () => {
    const limiter = new RateLimiter(3, 60_000);
    // Should resolve immediately for the first 3
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.remaining).toBe(0);
  });

  it('remaining returns the correct token count', () => {
    const limiter = new RateLimiter(5, 60_000);
    expect(limiter.remaining).toBe(5);
  });

  it('remaining decreases after acquire()', async () => {
    const limiter = new RateLimiter(5, 60_000);
    await limiter.acquire();
    expect(limiter.remaining).toBe(4);
    await limiter.acquire();
    expect(limiter.remaining).toBe(3);
  });

  it('refills tokens after the window elapses', async () => {
    const limiter = new RateLimiter(2, 1000); // 2 per second
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.remaining).toBe(0);

    // Advance time past the refill window
    vi.advanceTimersByTime(1100);
    expect(limiter.remaining).toBeGreaterThan(0);
  });

  it('msUntilRefill returns a non-negative number', () => {
    const limiter = new RateLimiter(10, 5000);
    expect(limiter.msUntilRefill).toBeGreaterThanOrEqual(0);
    expect(limiter.msUntilRefill).toBeLessThanOrEqual(5000);
  });

  it('queues waiting callers when tokens are exhausted', async () => {
    const limiter = new RateLimiter(1, 500);
    await limiter.acquire(); // use the one token

    let resolved = false;
    const pending = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not resolve yet
    expect(resolved).toBe(false);

    // Advance time to trigger refill
    vi.advanceTimersByTime(600);

    await pending;
    expect(resolved).toBe(true);
  });
});
