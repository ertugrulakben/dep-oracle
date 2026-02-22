/**
 * CollectorOrchestrator -- coordinates all collectors and runs them in parallel
 * with controlled concurrency.
 *
 * Usage:
 *   const orchestrator = new CollectorOrchestrator(cacheManager, { offline: false });
 *   const results = await orchestrator.collectAll('express', '4.18.2');
 */

import pLimit from 'p-limit';

import type {
  CollectorResult,
  RegistryData,
  GitHubData,
  SecurityData,
  FundingData,
  PopularityData,
  LicenseData,
} from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';

import { RegistryCollector } from './registry.js';
import { PyPIRegistryCollector } from './pypi-registry.js';
import { GitHubCollector } from './github.js';
import { SecurityCollector } from './security.js';
import { FundingCollector } from './funding.js';
import { PopularityCollector } from './popularity.js';
import { LicenseCollector } from './license.js';
import type { BaseCollector } from './base.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AllCollectorResults {
  registry: CollectorResult<RegistryData>;
  github: CollectorResult<GitHubData>;
  security: CollectorResult<SecurityData>;
  funding: CollectorResult<FundingData>;
  popularity: CollectorResult<PopularityData>;
  license: CollectorResult<LicenseData>;
}

export interface OrchestratorOptions {
  /** When true, only cached data is returned. No network requests. */
  offline?: boolean;
  /** GitHub personal access token for higher rate limits. */
  githubToken?: string;
  /** Maximum concurrent collector tasks (default: 10). */
  concurrency?: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class CollectorOrchestrator {
  private readonly cache: CacheManager;
  private readonly options: Required<OrchestratorOptions>;

  private readonly registryCollector: RegistryCollector;
  private readonly pypiRegistryCollector: PyPIRegistryCollector;
  private readonly githubCollector: GitHubCollector;
  private readonly securityCollector: SecurityCollector;
  private readonly fundingCollector: FundingCollector;
  private readonly popularityCollector: PopularityCollector;
  private readonly licenseCollector: LicenseCollector;

  constructor(cache: CacheManager, options: OrchestratorOptions = {}) {
    this.cache = cache;
    this.options = {
      offline: options.offline ?? false,
      githubToken: options.githubToken ?? process.env.GITHUB_TOKEN ?? '',
      concurrency: options.concurrency ?? 10,
    };

    this.registryCollector = new RegistryCollector(this.cache);
    this.pypiRegistryCollector = new PyPIRegistryCollector(this.cache);
    this.githubCollector = new GitHubCollector(this.cache, this.options.githubToken || undefined);
    this.securityCollector = new SecurityCollector(this.cache);
    this.fundingCollector = new FundingCollector(this.cache, this.options.githubToken || undefined);
    this.popularityCollector = new PopularityCollector(this.cache);
    this.licenseCollector = new LicenseCollector(this.cache);
  }

  /**
   * Run all collectors for the given package and version.
   *
   * In online mode every collector is invoked (cache-first). In offline mode
   * only the cache is consulted; if there is no cached entry the result gets
   * `status: 'offline'` with `data: null`.
   */
  async collectAll(
    packageName: string,
    version: string,
    ecosystem: 'npm' | 'pypi' = 'npm',
  ): Promise<AllCollectorResults> {
    logger.info(
      `Collecting data for ${packageName}@${version} (ecosystem=${ecosystem}, offline=${String(this.options.offline)})`,
    );

    const limit = pLimit(this.options.concurrency);

    type CollectorEntry<T> = {
      key: keyof AllCollectorResults;
      collector: BaseCollector<T>;
    };

    // Select the appropriate registry collector based on ecosystem
    const activeRegistryCollector =
      ecosystem === 'pypi'
        ? this.pypiRegistryCollector
        : this.registryCollector;

    // Map ecosystem to OSV ecosystem identifier
    const osvEcosystem = ecosystem === 'pypi' ? 'PyPI' : 'npm';

    // Type-safe collector list. We use `unknown` for the heterogeneous array
    // and cast at assignment time.
    const entries: Array<CollectorEntry<unknown>> = [
      { key: 'registry', collector: activeRegistryCollector as BaseCollector<unknown> },
      { key: 'github', collector: this.githubCollector as BaseCollector<unknown> },
      { key: 'security', collector: this.securityCollector as BaseCollector<unknown> },
      { key: 'funding', collector: this.fundingCollector as BaseCollector<unknown> },
      { key: 'popularity', collector: this.popularityCollector as BaseCollector<unknown> },
      { key: 'license', collector: this.licenseCollector as BaseCollector<unknown> },
    ];

    const results = {} as AllCollectorResults;

    const COLLECTOR_TIMEOUT = 30_000; // 30 seconds per collector

    const tasks = entries.map(({ key, collector }) =>
      limit(async () => {
        let result: CollectorResult<unknown>;

        if (this.options.offline) {
          result = await this.offlineCollect(collector, packageName, version);
        } else {
          try {
            // Pass ecosystem to the security collector
            if (key === 'security') {
              result = await Promise.race([
                this.securityCollector.collect(packageName, version, osvEcosystem),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Collector timeout')), COLLECTOR_TIMEOUT),
                ),
              ]);
            } else {
              result = await Promise.race([
                this.onlineCollect(collector, packageName, version),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Collector timeout')), COLLECTOR_TIMEOUT),
                ),
              ]);
            }
          } catch {
            logger.warn(`[${collector.name}] ${packageName}@${version} => timeout (${COLLECTOR_TIMEOUT}ms)`);
            result = {
              status: 'error',
              data: null,
              error: `Timeout after ${COLLECTOR_TIMEOUT / 1000}s`,
              collectedAt: new Date().toISOString(),
            };
          }
        }

        logger.info(
          `[${collector.name}] ${packageName}@${version} => ${result.status}`,
        );

        (results as unknown as Record<string, CollectorResult<unknown>>)[key] = result;
      }),
    );

    await Promise.all(tasks);

    return results;
  }

  // ---------------------------------------------------------------------------
  // Online / Offline strategies
  // ---------------------------------------------------------------------------

  /**
   * Normal collection: delegate to the collector which checks cache internally.
   */
  private async onlineCollect<T>(
    collector: BaseCollector<T>,
    packageName: string,
    version: string,
  ): Promise<CollectorResult<T>> {
    try {
      return await collector.collect(packageName, version);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Unhandled error in ${collector.name}: ${message}`);

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Offline collection: only look in the cache. If nothing is cached return
   * a result with `status: 'offline'`.
   */
  private async offlineCollect<T>(
    collector: BaseCollector<T>,
    packageName: string,
    version: string,
  ): Promise<CollectorResult<T>> {
    try {
      const key = `${collector.name}:${packageName}@${version}`;
      const cached = await this.cache.get<T>(key);

      if (cached !== null && cached !== undefined) {
        logger.debug(`Offline cache hit: ${key}`);
        return {
          status: 'cached',
          data: cached,
          collectedAt: new Date().toISOString(),
        };
      }

      return {
        status: 'offline',
        data: null,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Offline cache read failed for ${collector.name}: ${message}`);

      return {
        status: 'offline',
        data: null,
        collectedAt: new Date().toISOString(),
      };
    }
  }
}
