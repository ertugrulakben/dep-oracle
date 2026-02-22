/**
 * FundingCollector -- best-effort detection of project funding channels.
 *
 * Data sources:
 *   - GitHub FUNDING.yml (via GitHub API)
 *   - OpenCollective public profile JSON
 *   - npm registry "funding" field
 *
 * Many packages will have no funding info at all; the collector returns
 * sensible defaults in that case and never throws.
 */

import type { CollectorResult, FundingData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { githubRateLimiter, npmRateLimiter } from '../utils/rate-limiter.js';
import { BaseCollector } from './base.js';

/** Simplified OpenCollective profile shape. */
interface OpenCollectiveProfile {
  slug: string;
  name?: string;
  currency?: string;
  balance?: number;
  yearlyBudget?: number;
  backersCount?: number;
  contributorsCount?: number;
  isActive?: boolean;
}

export class FundingCollector extends BaseCollector<FundingData> {
  readonly name = 'funding';

  private readonly githubToken: string | undefined;

  constructor(cache: CacheManager, githubToken?: string) {
    super(cache);
    this.githubToken = githubToken ?? process.env.GITHUB_TOKEN;
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<FundingData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      // Gather information from multiple sources in parallel.
      const [repoSlug, npmFunding] = await Promise.all([
        this.resolveRepoSlug(packageName),
        this.fetchNpmFunding(packageName),
      ]);

      // Fire secondary lookups in parallel once we know the repo slug.
      const [fundingYml, openCollective] = await Promise.all([
        repoSlug
          ? this.checkFundingYml(repoSlug.owner, repoSlug.repo)
          : Promise.resolve(null),
        this.fetchOpenCollective(packageName),
      ]);

      const hasSponsors = fundingYml !== null && fundingYml.length > 0;
      const hasOpenCollective = openCollective !== null && (openCollective.isActive ?? false);
      const hasNpmFunding = npmFunding !== null;

      // Rough funding estimate based on available signals.
      let estimatedAnnualFunding = 0;
      if (openCollective?.yearlyBudget) {
        // OpenCollective reports in cents for some currencies.
        estimatedAnnualFunding = openCollective.yearlyBudget > 1_000_000
          ? Math.round(openCollective.yearlyBudget / 100)
          : openCollective.yearlyBudget;
      }

      const data: FundingData = {
        packageName,
        hasSponsors,
        hasOpenCollective,
        hasNpmFunding,
        openCollectiveSlug: openCollective?.slug ?? null,
        openCollectiveBackers: openCollective?.backersCount ?? 0,
        estimatedAnnualFunding,
        fundingUrls: this.buildFundingUrls(npmFunding, fundingYml, openCollective),
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`FundingCollector failed for ${packageName}@${version}: ${message}`);

      // Return defaults -- funding is entirely optional.
      const data: FundingData = {
        packageName,
        hasSponsors: false,
        hasOpenCollective: false,
        hasNpmFunding: false,
        openCollectiveSlug: null,
        openCollectiveBackers: 0,
        estimatedAnnualFunding: 0,
        fundingUrls: [],
      };

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // npm registry funding field
  // ---------------------------------------------------------------------------

  private async fetchNpmFunding(
    packageName: string,
  ): Promise<string | string[] | null> {
    try {
      const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
      await npmRateLimiter.acquire();
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) return null;

      const body = (await res.json()) as {
        funding?: string | { url?: string } | Array<string | { url?: string }>;
      };

      if (!body.funding) return null;

      if (typeof body.funding === 'string') return body.funding;
      if (Array.isArray(body.funding)) {
        return body.funding.map((f) =>
          typeof f === 'string' ? f : f.url ?? '',
        ).filter(Boolean);
      }
      if (typeof body.funding === 'object' && body.funding.url) {
        return body.funding.url;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // GitHub FUNDING.yml
  // ---------------------------------------------------------------------------

  private async checkFundingYml(
    owner: string,
    repo: string,
  ): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/.github/FUNDING.yml`;
    logger.debug(`Funding: checking FUNDING.yml ${url}`);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (this.githubToken) {
        headers.Authorization = `Bearer ${this.githubToken}`;
      }

      await githubRateLimiter.acquire();
      const res = await fetch(url, { headers });
      if (!res.ok) return null;

      return await res.text();
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // OpenCollective
  // ---------------------------------------------------------------------------

  private async fetchOpenCollective(
    packageName: string,
  ): Promise<OpenCollectiveProfile | null> {
    // OpenCollective slugs are typically the package name (without scope).
    const slug = packageName.replace(/^@[^/]+\//, '');
    const url = `https://opencollective.com/${encodeURIComponent(slug)}.json`;
    logger.debug(`Funding: checking OpenCollective ${url}`);

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) return null;

      return (await res.json()) as OpenCollectiveProfile;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Repo slug resolution (shared helper)
  // ---------------------------------------------------------------------------

  private async resolveRepoSlug(
    packageName: string,
  ): Promise<{ owner: string; repo: string } | null> {
    try {
      const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
      await npmRateLimiter.acquire();
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) return null;

      const body = (await res.json()) as {
        repository?: { url?: string } | string;
      };

      const repoField = body.repository;
      const raw = typeof repoField === 'string' ? repoField : repoField?.url;
      if (!raw) return null;

      const normalised = raw
        .replace(/^git\+/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
        .replace(/^git@github\.com:/, 'https://github.com/')
        .replace(/\.git$/, '');

      const match = normalised.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return null;

      return { owner: match[1], repo: match[2] };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private buildFundingUrls(
    npmFunding: string | string[] | null,
    fundingYml: string | null,
    oc: OpenCollectiveProfile | null,
  ): string[] {
    const urls: string[] = [];

    // From npm
    if (npmFunding) {
      if (typeof npmFunding === 'string') {
        urls.push(npmFunding);
      } else {
        urls.push(...npmFunding);
      }
    }

    // From FUNDING.yml -- parse known keys
    if (fundingYml) {
      const ghMatch = fundingYml.match(/github:\s*(.+)/i);
      if (ghMatch) {
        const sponsors = ghMatch[1].trim()
          .replace(/^\[/, '').replace(/]$/, '')
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter(Boolean);
        const GITHUB_USERNAME = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
        for (const sponsor of sponsors) {
          if (GITHUB_USERNAME.test(sponsor)) {
            urls.push(`https://github.com/sponsors/${sponsor}`);
          }
        }
      }

      const ocMatch = fundingYml.match(/open_collective:\s*(\S+)/i);
      if (ocMatch) {
        urls.push(`https://opencollective.com/${ocMatch[1].trim()}`);
      }

      const kofiMatch = fundingYml.match(/ko_fi:\s*(\S+)/i);
      if (kofiMatch) {
        urls.push(`https://ko-fi.com/${kofiMatch[1].trim()}`);
      }

      const patreonMatch = fundingYml.match(/patreon:\s*(\S+)/i);
      if (patreonMatch) {
        urls.push(`https://patreon.com/${patreonMatch[1].trim()}`);
      }
    }

    // OpenCollective
    if (oc?.slug) {
      const ocUrl = `https://opencollective.com/${oc.slug}`;
      if (!urls.includes(ocUrl)) {
        urls.push(ocUrl);
      }
    }

    return [...new Set(urls)];
  }
}
