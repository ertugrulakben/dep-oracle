/**
 * PyPIRegistryCollector -- fetches package metadata from the PyPI registry.
 *
 * Data sources:
 *   - https://pypi.org/pypi/{package}/json              (metadata)
 *   - https://pypistats.org/api/packages/{package}/recent (downloads)
 */

import type { CollectorResult, RegistryData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { pypiRateLimiter } from '../utils/rate-limiter.js';
import { BaseCollector } from './base.js';

/** Subset of the PyPI JSON API response we actually use. */
interface PyPIPackageInfo {
  name: string;
  summary?: string;
  version: string;
  license?: string;
  project_urls?: Record<string, string>;
  home_page?: string;
}

interface PyPIRelease {
  upload_time_iso_8601?: string;
  upload_time?: string;
  yanked?: boolean;
  yanked_reason?: string;
}

interface PyPIResponse {
  info: PyPIPackageInfo;
  releases?: Record<string, PyPIRelease[]>;
}

/** Shape returned by the pypistats recent downloads API. */
interface PyPIStatsResponse {
  data?: {
    last_week?: number;
    last_month?: number;
    last_day?: number;
  };
}

export class PyPIRegistryCollector extends BaseCollector<RegistryData> {
  readonly name = 'pypi-registry';

  constructor(cache: CacheManager) {
    super(cache);
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<RegistryData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      const [metadataResult, downloadsResult] = await Promise.allSettled([
        this.fetchMetadata(packageName),
        this.fetchWeeklyDownloads(packageName),
      ]);

      const metadata =
        metadataResult.status === 'fulfilled' ? metadataResult.value : null;
      const downloads =
        downloadsResult.status === 'fulfilled' ? downloadsResult.value : 0;

      if (!metadata) {
        throw new Error(`PyPI registry returned no data for ${packageName}`);
      }

      const versionCount = metadata.releases
        ? Object.keys(metadata.releases).length
        : 0;

      // Determine last publish date from releases
      const lastPublishDate = this.findLastPublishDate(metadata.releases);

      // Check if the requested version is yanked (PyPI equivalent of deprecated)
      const deprecated = this.checkYanked(metadata.releases, version);

      const data: RegistryData = {
        packageName,
        version: version === 'latest' ? metadata.info.version : version,
        description: metadata.info.summary ?? null,
        lastPublishDate,
        versionCount,
        deprecated,
        weeklyDownloads: downloads,
        license: metadata.info.license ?? null,
        repositoryUrl: this.extractRepoUrl(metadata.info),
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `PyPIRegistryCollector failed for ${packageName}@${version}: ${message}`,
      );

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async fetchMetadata(
    packageName: string,
  ): Promise<PyPIResponse | null> {
    await pypiRateLimiter.acquire();

    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    logger.debug(`Fetching PyPI metadata: ${url}`);

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`PyPI registry returned ${res.status} for ${packageName}`);
    }

    return (await res.json()) as PyPIResponse;
  }

  private async fetchWeeklyDownloads(packageName: string): Promise<number> {
    await pypiRateLimiter.acquire();

    const url = `https://pypistats.org/api/packages/${encodeURIComponent(packageName)}/recent`;
    logger.debug(`Fetching PyPI weekly downloads: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        logger.warn(
          `PyPI stats API returned ${res.status} for ${packageName}`,
        );
        return 0;
      }

      const body = (await res.json()) as PyPIStatsResponse;
      return body.data?.last_week ?? 0;
    } catch {
      logger.warn(`Could not fetch PyPI download stats for ${packageName}`);
      return 0;
    }
  }

  /**
   * Find the most recent upload date across all releases.
   */
  private findLastPublishDate(
    releases: Record<string, PyPIRelease[]> | undefined,
  ): string | null {
    if (!releases) return null;

    const dates: number[] = [];

    for (const files of Object.values(releases)) {
      for (const file of files) {
        const dateStr = file.upload_time_iso_8601 ?? file.upload_time;
        if (dateStr) {
          const ts = new Date(dateStr).getTime();
          if (!isNaN(ts)) dates.push(ts);
        }
      }
    }

    if (dates.length === 0) return null;

    dates.sort((a, b) => b - a);
    return new Date(dates[0]).toISOString();
  }

  /**
   * Check if the requested version is yanked (PyPI's deprecation mechanism).
   * Returns the yank reason string, or null if not yanked.
   */
  private checkYanked(
    releases: Record<string, PyPIRelease[]> | undefined,
    version: string,
  ): string | null {
    if (!releases || version === 'latest') return null;

    const files = releases[version];
    if (!files || files.length === 0) return null;

    // A version is considered yanked if any of its files are yanked
    const yankedFile = files.find((f) => f.yanked);
    if (yankedFile) {
      return yankedFile.yanked_reason || 'This version has been yanked';
    }

    return null;
  }

  /**
   * Extract a normalised repository URL from PyPI project_urls or home_page.
   */
  private extractRepoUrl(info: PyPIPackageInfo): string | null {
    const projectUrls = info.project_urls ?? {};

    // PyPI project_urls commonly use these keys for source code
    const repoKeys = [
      'Source',
      'Source Code',
      'Repository',
      'GitHub',
      'Code',
      'Homepage',
      'source',
      'source_code',
      'repository',
      'github',
      'code',
      'homepage',
    ];

    for (const key of repoKeys) {
      const url = projectUrls[key];
      if (url && (url.includes('github.com') || url.includes('gitlab.com') || url.includes('bitbucket.org'))) {
        return url.replace(/\.git$/, '');
      }
    }

    // Fallback: check all project_urls for a GitHub/GitLab/Bitbucket link
    for (const url of Object.values(projectUrls)) {
      if (url && (url.includes('github.com') || url.includes('gitlab.com') || url.includes('bitbucket.org'))) {
        return url.replace(/\.git$/, '');
      }
    }

    // Last resort: home_page
    const homePage = info.home_page;
    if (homePage && (homePage.includes('github.com') || homePage.includes('gitlab.com'))) {
      return homePage.replace(/\.git$/, '');
    }

    return null;
  }
}
