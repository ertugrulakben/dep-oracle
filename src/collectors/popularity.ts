/**
 * PopularityCollector -- measures package adoption through download counts
 * and trend analysis.
 *
 * Data sources:
 *   - https://api.npmjs.org/downloads/point/last-week/{package}
 *   - https://api.npmjs.org/downloads/point/last-month/{package}
 *   - npm registry (dependent count, if available)
 */

import type { CollectorResult, PopularityData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { BaseCollector } from './base.js';

interface NpmDownloadsResponse {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

type DownloadTrend = 'rising' | 'stable' | 'declining';

export class PopularityCollector extends BaseCollector<PopularityData> {
  readonly name = 'popularity';

  constructor(cache: CacheManager) {
    super(cache);
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<PopularityData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      const [weeklyDownloads, monthlyDownloads, dependentCount] =
        await Promise.all([
          this.fetchDownloads(packageName, 'last-week'),
          this.fetchDownloads(packageName, 'last-month'),
          this.fetchDependentCount(packageName),
        ]);

      // Trend calculation: compare weekly vs monthly weekly-average.
      const monthlyWeeklyAvg = monthlyDownloads / 4;
      let trend: DownloadTrend = 'stable';

      if (monthlyWeeklyAvg > 0) {
        const ratio = weeklyDownloads / monthlyWeeklyAvg;
        if (ratio > 1.1) {
          trend = 'rising';
        } else if (ratio < 0.9) {
          trend = 'declining';
        }
      }

      const data: PopularityData = {
        packageName,
        weeklyDownloads,
        monthlyDownloads,
        trend,
        dependentCount,
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`PopularityCollector failed for ${packageName}@${version}: ${message}`);

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // npm downloads API
  // ---------------------------------------------------------------------------

  private async fetchDownloads(
    packageName: string,
    period: 'last-week' | 'last-month',
  ): Promise<number> {
    const url = `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`;
    logger.debug(`Popularity: fetching ${period} downloads: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        logger.warn(`Downloads API returned ${res.status} for ${packageName} (${period})`);
        return 0;
      }

      const body = (await res.json()) as NpmDownloadsResponse;
      return body.downloads ?? 0;
    } catch {
      logger.warn(`Could not fetch ${period} downloads for ${packageName}`);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Dependent count
  // ---------------------------------------------------------------------------

  /**
   * Attempt to get the number of packages that depend on this one.
   *
   * The npm registry search API exposes a "dependents" count via the
   * /-/v1/search endpoint. This is an approximation.
   */
  private async fetchDependentCount(packageName: string): Promise<number> {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(packageName)}&size=1`;
    logger.debug(`Popularity: fetching dependent count: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) return 0;

      const body = (await res.json()) as {
        objects?: Array<{
          package: { name: string };
          searchScore?: number;
          // The npm search API does not directly expose dependent count,
          // but the registry CDN response sometimes does.
        }>;
      };

      // If the first result is an exact match we could use its score as a
      // proxy, but the number is not directly available. Return 0 for now
      // and rely on the registry packument approach below.
      if (body.objects && body.objects.length > 0) {
        const exactMatch = body.objects.find(
          (o) => o.package.name === packageName,
        );
        if (exactMatch) {
          // searchScore is not the dependent count, but we try a second
          // lookup from the packument "users" field (rarely populated).
          return await this.fetchDependentCountFromRegistry(packageName);
        }
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Secondary lookup: the npm registry exposes dependent info via the
   * abbreviated packument endpoint.
   */
  private async fetchDependentCountFromRegistry(
    packageName: string,
  ): Promise<number> {
    try {
      // The dependents count is not directly in the registry JSON.
      // We use the npm website API as a best-effort approach.
      const url = `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'text/html',
          'X-Spiferack': '1', // npm returns JSON when this header is set
        },
      });

      if (!res.ok) return 0;

      const body = (await res.json()) as {
        dependents?: { dependentsCount?: number };
      };

      return body.dependents?.dependentsCount ?? 0;
    } catch {
      // This endpoint is undocumented and may change -- fail silently.
      return 0;
    }
  }
}
