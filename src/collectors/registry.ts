/**
 * RegistryCollector -- fetches package metadata from the npm registry.
 *
 * Data sources:
 *   - https://registry.npmjs.org/{package}          (metadata)
 *   - https://api.npmjs.org/downloads/point/last-week/{package}  (downloads)
 */

import type { CollectorResult, RegistryData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { BaseCollector } from './base.js';

/** Shape returned by the npm downloads API. */
interface NpmDownloadsResponse {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

/** Subset of the npm registry packument we actually use. */
interface NpmPackument {
  name: string;
  description?: string;
  'dist-tags'?: Record<string, string>;
  time?: Record<string, string>;
  versions?: Record<string, NpmVersionInfo>;
  repository?: { type?: string; url?: string } | string;
  license?: string;
}

interface NpmVersionInfo {
  deprecated?: string;
  [key: string]: unknown;
}

export class RegistryCollector extends BaseCollector<RegistryData> {
  readonly name = 'registry';

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
      const [packument, downloads] = await Promise.all([
        this.fetchPackument(packageName),
        this.fetchWeeklyDownloads(packageName),
      ]);

      const versionCount = packument.versions
        ? Object.keys(packument.versions).length
        : 0;

      // Determine last publish date from the time map
      const timeEntries = packument.time ?? {};
      const publishDates = Object.entries(timeEntries)
        .filter(([key]) => key !== 'created' && key !== 'modified')
        .map(([, value]) => new Date(value).getTime())
        .sort((a, b) => b - a);

      const lastPublishDate = publishDates.length > 0
        ? new Date(publishDates[0]).toISOString()
        : null;

      // Check if the requested version is deprecated
      const versionInfo = packument.versions?.[version];
      const deprecated = versionInfo?.deprecated
        ? String(versionInfo.deprecated)
        : null;

      const data: RegistryData = {
        packageName,
        version,
        description: packument.description ?? null,
        lastPublishDate,
        versionCount,
        deprecated,
        weeklyDownloads: downloads,
        license: packument.license ?? null,
        repositoryUrl: this.extractRepoUrl(packument),
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`RegistryCollector failed for ${packageName}@${version}: ${message}`);

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

  private async fetchPackument(packageName: string): Promise<NpmPackument> {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    logger.debug(`Fetching packument: ${url}`);

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`npm registry returned ${res.status} for ${packageName}`);
    }

    return (await res.json()) as NpmPackument;
  }

  private async fetchWeeklyDownloads(packageName: string): Promise<number> {
    const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`;
    logger.debug(`Fetching weekly downloads: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        logger.warn(`Downloads API returned ${res.status} for ${packageName}`);
        return 0;
      }

      const body = (await res.json()) as NpmDownloadsResponse;
      return body.downloads ?? 0;
    } catch {
      logger.warn(`Could not fetch download stats for ${packageName}`);
      return 0;
    }
  }

  /**
   * Extract a normalised GitHub/repo URL from the packument.
   * npm stores repo URLs in several formats; we normalise to https.
   */
  private extractRepoUrl(packument: NpmPackument): string | null {
    const repo = packument.repository;
    if (!repo) return null;

    const raw = typeof repo === 'string' ? repo : repo.url;
    if (!raw) return null;

    // Normalise git+https://..., git://..., git+ssh://git@github.com/... etc.
    return raw
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '');
  }
}
