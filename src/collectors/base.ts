/**
 * Abstract base class for all data collectors.
 *
 * Every collector extends BaseCollector<T> and returns CollectorResult<T>.
 * Provides transparent caching: subclasses call getCached / setCache and the
 * base takes care of serialisation through CacheManager.
 */

import type { CollectorResult } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';

export abstract class BaseCollector<T> {
  /** Human-readable collector name used in logs and cache keys. */
  abstract readonly name: string;

  protected readonly cache: CacheManager;

  /** Default cache TTL in seconds (24 hours). */
  protected readonly defaultTTL: number = 86_400;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Collect data for the given package + version. */
  abstract collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<T>>;

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  /** Build a deterministic cache key. */
  protected cacheKey(pkg: string, version: string): string {
    return `${this.name}:${pkg}@${version}`;
  }

  /**
   * Return a cached CollectorResult if one exists, otherwise `null`.
   *
   * When a cache hit is found the result is returned with `status: 'cached'`
   * so callers can differentiate between fresh and cached data.
   */
  protected async getCached(
    pkg: string,
    version: string,
  ): Promise<CollectorResult<T> | null> {
    const key = this.cacheKey(pkg, version);

    try {
      const cached = await this.cache.get<T>(key);
      if (cached !== null && cached !== undefined) {
        logger.debug(`Cache hit for ${key}`);
        return {
          status: 'cached',
          data: cached,
          collectedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      logger.warn(
        `Cache read failed for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return null;
  }

  /**
   * Persist collector data in the cache.
   *
   * Failures are logged but never thrown -- caching is best-effort.
   */
  protected async setCache(
    pkg: string,
    version: string,
    data: T,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    const key = this.cacheKey(pkg, version);

    try {
      await this.cache.set<T>(key, data, ttl);
      logger.debug(`Cache set for ${key} (ttl=${ttl}s)`);
    } catch (err) {
      logger.warn(
        `Cache write failed for ${key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
