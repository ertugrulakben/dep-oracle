/**
 * Token-bucket rate limiter for controlling outbound HTTP request frequency.
 *
 * Usage:
 * ```ts
 * const limiter = new RateLimiter(10, 60_000); // 10 requests per minute
 * await limiter.acquire(); // blocks if bucket is empty
 * await fetch(url);
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private lastRefill: number;
  private waitQueue: Array<() => void> = [];

  /**
   * @param maxRequests  Maximum number of requests allowed in the window
   * @param windowMs     Window duration in milliseconds
   */
  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.refillIntervalMs = windowMs;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token. Resolves immediately when tokens are available,
   * otherwise waits until the bucket is refilled.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // No tokens available — wait for the next refill cycle
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
      this.scheduleRefill();
    });
  }

  /**
   * Return the number of tokens currently available (without waiting).
   */
  get remaining(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Return the number of milliseconds until the next refill.
   */
  get msUntilRefill(): number {
    const elapsed = Date.now() - this.lastRefill;
    return Math.max(0, this.refillIntervalMs - elapsed);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillIntervalMs) {
      // Full refill
      const periods = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(this.maxTokens, this.tokens + periods * this.maxTokens);
      this.lastRefill = now - (elapsed % this.refillIntervalMs);
      this.drainWaitQueue();
    }
  }

  private scheduleRefill(): void {
    const delay = this.msUntilRefill;
    if (delay <= 0) {
      this.refill();
      return;
    }

    setTimeout(() => {
      this.refill();
    }, delay);
  }

  private drainWaitQueue(): void {
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      this.tokens--;
      const resolve = this.waitQueue.shift();
      resolve?.();
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/**
 * GitHub API rate limiter: 5000 requests per hour (authenticated).
 *
 * GitHub's unauthenticated limit is 60/hr, but dep-oracle is designed to
 * work with a token so we use the authenticated limit.
 */
export const githubRateLimiter = new RateLimiter(5000, 3_600_000);

/**
 * npm registry rate limiter: generous default of 300 requests per minute.
 * The npm registry does not publish official limits, but this is safe.
 */
export const npmRateLimiter = new RateLimiter(300, 60_000);

/**
 * PyPI rate limiter: conservative 100 requests per minute.
 */
export const pypiRateLimiter = new RateLimiter(100, 60_000);
