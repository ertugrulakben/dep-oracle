/**
 * GitHubCollector -- fetches repository health metrics from the GitHub REST API.
 *
 * Data sources:
 *   - /repos/{owner}/{repo}                          (stars, forks, issues)
 *   - /repos/{owner}/{repo}/contributors              (contributor count via Link header)
 *   - /repos/{owner}/{repo}/commits                   (recent activity, latest commit)
 *   - /repos/{owner}/{repo}/contents/.github/FUNDING.yml  (sponsor / funding info)
 *
 * An optional GITHUB_TOKEN env var is used to raise rate limits from 60 to
 * 5 000 requests / hour.
 */

import type { CollectorResult, GitHubData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { githubRateLimiter, npmRateLimiter } from '../utils/rate-limiter.js';
import { BaseCollector } from './base.js';

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  archived: boolean;
  disabled: boolean;
  default_branch: string;
}

interface GitHubCommitItem {
  sha: string;
  commit: {
    committer: { date: string } | null;
    message: string;
  };
}

export class GitHubCollector extends BaseCollector<GitHubData> {
  readonly name = 'github';

  private readonly token: string | undefined;

  constructor(cache: CacheManager, githubToken?: string) {
    super(cache);
    this.token = githubToken ?? process.env.GITHUB_TOKEN;
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<GitHubData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      const repoSlug = await this.resolveRepoSlug(packageName);

      if (!repoSlug) {
        return {
          status: 'error',
          data: null,
          error: 'No GitHub repository found',
          collectedAt: new Date().toISOString(),
        };
      }

      const { owner, repo } = repoSlug;

      // Fire all requests in parallel -- each one is independently safe.
      const [repoInfo, contributorCount, recentCommitCount, latestCommit, hasFunding] =
        await Promise.all([
          this.fetchRepoInfo(owner, repo),
          this.fetchContributorCount(owner, repo),
          this.fetchRecentCommitCount(owner, repo),
          this.fetchLatestCommit(owner, repo),
          this.checkFundingYml(owner, repo),
        ]);

      const data: GitHubData = {
        owner,
        repo,
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        openIssues: repoInfo.open_issues_count,
        updatedAt: repoInfo.updated_at,
        archived: repoInfo.archived,
        defaultBranch: repoInfo.default_branch,
        contributorCount,
        recentCommitCount,
        lastCommitDate: latestCommit
          ? latestCommit.commit.committer?.date ?? null
          : null,
        lastCommitSha: latestCommit?.sha ?? null,
        hasFundingYml: hasFunding,
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`GitHubCollector failed for ${packageName}@${version}: ${message}`);

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Repo slug resolution
  // ---------------------------------------------------------------------------

  /**
   * Determine the GitHub owner/repo from the npm registry metadata.
   * Falls back to a well-known heuristic for scoped packages.
   */
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

      return this.parseGitHubUrl(raw);
    } catch {
      return null;
    }
  }

  /** Extract owner/repo from a variety of GitHub URL formats. */
  private parseGitHubUrl(
    raw: string,
  ): { owner: string; repo: string } | null {
    const normalised = raw
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '');

    const match = normalised.match(
      /github\.com\/([^/]+)\/([^/]+)/,
    );

    if (!match) return null;

    const owner = match[1];
    const repo = match[2];
    // Validate GitHub owner/repo format
    const GITHUB_NAME = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
    if (!GITHUB_NAME.test(owner) || !GITHUB_NAME.test(repo)) return null;

    return { owner, repo };
  }

  // ---------------------------------------------------------------------------
  // GitHub API calls
  // ---------------------------------------------------------------------------

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) {
      h.Authorization = `Bearer ${this.token}`;
    }
    return h;
  }

  private async fetchRepoInfo(
    owner: string,
    repo: string,
  ): Promise<GitHubRepoResponse> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    logger.debug(`GitHub: fetching repo info ${url}`);

    await githubRateLimiter.acquire();
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} for ${url}`);
    }
    return (await res.json()) as GitHubRepoResponse;
  }

  /**
   * Get total contributor count using the Link header pagination trick.
   * We request per_page=1&anon=true and read the `last` page number.
   */
  private async fetchContributorCount(
    owner: string,
    repo: string,
  ): Promise<number> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`;
    logger.debug(`GitHub: fetching contributor count ${url}`);

    try {
      await githubRateLimiter.acquire();
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return 0;

      const count = this.extractLastPage(res.headers.get('link'));
      // If there is no Link header the repo has a single page of contributors.
      if (count !== null) return count;

      // Fallback: count items in the response body.
      const body = (await res.json()) as unknown[];
      return body.length;
    } catch {
      return 0;
    }
  }

  /**
   * Count commits in the last 30 days via the same Link-header trick.
   */
  private async fetchRecentCommitCount(
    owner: string,
    repo: string,
  ): Promise<number> {
    const since = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=1`;
    logger.debug(`GitHub: fetching recent commit count ${url}`);

    try {
      await githubRateLimiter.acquire();
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return 0;

      const count = this.extractLastPage(res.headers.get('link'));
      if (count !== null) return count;

      const body = (await res.json()) as unknown[];
      return body.length;
    } catch {
      return 0;
    }
  }

  /** Fetch the single most-recent commit. */
  private async fetchLatestCommit(
    owner: string,
    repo: string,
  ): Promise<GitHubCommitItem | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
    logger.debug(`GitHub: fetching latest commit ${url}`);

    try {
      await githubRateLimiter.acquire();
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return null;

      const body = (await res.json()) as GitHubCommitItem[];
      return body[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check whether the repository contains a .github/FUNDING.yml file.
   * A 200 response means the file exists.
   */
  private async checkFundingYml(
    owner: string,
    repo: string,
  ): Promise<boolean> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/.github/FUNDING.yml`;
    logger.debug(`GitHub: checking FUNDING.yml ${url}`);

    try {
      await githubRateLimiter.acquire();
      const res = await fetch(url, { headers: this.headers() });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Parse the GitHub `Link` header and return the last page number.
   *
   *   Link: <...?page=42>; rel="last", <...?page=2>; rel="next"
   *
   * Returns `null` when there is no last page (single page of results).
   */
  private extractLastPage(linkHeader: string | null): number | null {
    if (!linkHeader) return null;

    const match = linkHeader.match(
      /[?&]page=(\d+)[^>]*>;\s*rel="last"/,
    );

    return match ? parseInt(match[1], 10) : null;
  }
}
