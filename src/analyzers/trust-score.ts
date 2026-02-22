import type {
  CollectorResult,
  RegistryData,
  GitHubData,
  SecurityData,
  FundingData,
  PopularityData,
  LicenseData,
  TrustMetrics,
} from '../parsers/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by the AllCollectorResults interface (from orchestrator). */
export interface AllCollectorResults {
  registry: CollectorResult<RegistryData>;
  github: CollectorResult<GitHubData>;
  security: CollectorResult<SecurityData>;
  funding: CollectorResult<FundingData>;
  popularity: CollectorResult<PopularityData>;
  license: CollectorResult<LicenseData>;
}

/** Extended trust result that includes the weighted score and metadata. */
export interface TrustScoreResult {
  trustScore: number;
  metrics: TrustMetrics;
  insufficientData: boolean;
  unavailableMetrics: string[];
}

/** Internal representation of a single metric evaluation. */
interface MetricEntry {
  key: keyof TrustMetrics;
  weight: number;
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NA_SCORE = -1;

const DEFAULT_WEIGHTS: Record<keyof TrustMetrics, number> = {
  security: 0.25,
  maintainer: 0.25,
  activity: 0.20,
  popularity: 0.15,
  funding: 0.10,
  license: 0.05,
};

// ---------------------------------------------------------------------------
// TrustScoreEngine
// ---------------------------------------------------------------------------

export class TrustScoreEngine {
  private readonly weights: Record<keyof TrustMetrics, number>;

  constructor(weights?: Partial<Record<keyof TrustMetrics, number>>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Calculate a full trust score from all collector results.
   * Returns the weighted score (0-100), the per-dimension metrics,
   * and metadata about data availability.
   */
  calculate(results: AllCollectorResults): TrustScoreResult {
    const securityRaw = this.calculateSecurityScore(results.security.data);
    const maintainerRaw = this.calculateMaintainerScore(results.github.data);
    const activityRaw = this.calculateActivityScore(results.registry.data, results.github.data);
    const popularityRaw = this.calculatePopularityScore(results.popularity.data);
    const fundingRaw = this.calculateFundingScore(results.funding.data);
    const licenseRaw = this.calculateLicenseScore(results.license.data);

    const entries: MetricEntry[] = [
      { key: 'security', weight: this.weights.security, score: securityRaw },
      { key: 'maintainer', weight: this.weights.maintainer, score: maintainerRaw },
      { key: 'activity', weight: this.weights.activity, score: activityRaw },
      { key: 'popularity', weight: this.weights.popularity, score: popularityRaw },
      { key: 'funding', weight: this.weights.funding, score: fundingRaw },
      { key: 'license', weight: this.weights.license, score: licenseRaw },
    ];

    const unavailableMetrics = entries
      .filter((e) => e.score === NA_SCORE)
      .map((e) => e.key);

    const trustScore = this.computeWeightedScore(entries, unavailableMetrics);

    // Clamp individual metrics for the output (N/A becomes 0 in the final metrics object)
    const metrics: TrustMetrics = {
      security: clamp(securityRaw === NA_SCORE ? 0 : securityRaw),
      maintainer: clamp(maintainerRaw === NA_SCORE ? 0 : maintainerRaw),
      activity: clamp(activityRaw === NA_SCORE ? 0 : activityRaw),
      popularity: clamp(popularityRaw === NA_SCORE ? 0 : popularityRaw),
      funding: clamp(fundingRaw === NA_SCORE ? 0 : fundingRaw),
      license: clamp(licenseRaw === NA_SCORE ? 0 : licenseRaw),
    };

    return {
      trustScore: Math.round(trustScore),
      metrics,
      insufficientData: unavailableMetrics.length >= 3,
      unavailableMetrics,
    };
  }

  // -------------------------------------------------------------------------
  // Individual dimension scorers
  // -------------------------------------------------------------------------

  calculateSecurityScore(data: SecurityData | null): number {
    if (data === null) return NA_SCORE;

    let score = 100;

    // Each vulnerability subtracts 15 points
    score -= data.totalVulnerabilities * 15;

    // Fast patch time bonus: if average patch days <= 7, add up to 5
    if (data.averagePatchDays !== null && data.averagePatchDays > 0 && data.averagePatchDays <= 7) {
      score = Math.min(100, score + 5);
    }

    return clamp(score);
  }

  calculateMaintainerScore(data: GitHubData | null): number {
    if (data === null) return NA_SCORE;

    let ceiling: number;
    if (data.contributorCount <= 1) {
      ceiling = 60;
    } else if (data.contributorCount <= 5) {
      ceiling = 80;
    } else {
      ceiling = 100;
    }

    let score = ceiling;

    // Commit frequency bonus/penalty (30-day window)
    if (data.recentCommitCount === 0) {
      score -= 20;
    } else if (data.recentCommitCount < 5) {
      score -= 10;
    } else if (data.recentCommitCount >= 20) {
      score = Math.min(ceiling, score + 5);
    }

    return clamp(score);
  }

  calculateActivityScore(
    registry: RegistryData | null,
    github: GitHubData | null,
  ): number {
    if (registry === null && github === null) return NA_SCORE;

    let publishScore = 50; // neutral default when registry data is absent
    let commitScore = 50;

    if (registry !== null && registry.lastPublishDate !== null) {
      const lastPublish = new Date(registry.lastPublishDate);
      const monthsSincePublish = monthsBetween(lastPublish, new Date());

      if (monthsSincePublish < 3) {
        publishScore = 100;
      } else if (monthsSincePublish < 6) {
        publishScore = 80;
      } else if (monthsSincePublish < 12) {
        publishScore = 50;
      } else if (monthsSincePublish < 24) {
        publishScore = 20;
      } else {
        publishScore = 0;
      }
    }

    if (github !== null) {
      if (github.recentCommitCount >= 30) {
        commitScore = 100;
      } else if (github.recentCommitCount >= 15) {
        commitScore = 80;
      } else if (github.recentCommitCount >= 5) {
        commitScore = 60;
      } else if (github.recentCommitCount >= 1) {
        commitScore = 40;
      } else {
        commitScore = 10;
      }
    }

    // When both are available, weight publish 60% and commit 40%
    if (registry !== null && github !== null) {
      return clamp(Math.round(publishScore * 0.6 + commitScore * 0.4));
    }

    // Only one source available — use it directly
    return clamp(registry !== null ? publishScore : commitScore);
  }

  calculatePopularityScore(data: PopularityData | null): number {
    if (data === null) return NA_SCORE;

    const dl = data.weeklyDownloads;

    if (dl >= 1_000_000) return 100;
    if (dl >= 100_000) return 85;
    if (dl >= 10_000) return 70;
    if (dl >= 1_000) return 50;
    if (dl >= 100) return 30;
    return 10;
  }

  calculateFundingScore(data: FundingData | null): number {
    if (data === null) return NA_SCORE;

    // Determine the highest tier of funding
    if (data.estimatedAnnualFunding >= 50_000) {
      // Corporate-level funding
      return 90;
    }

    if (data.hasOpenCollective) return 70;
    if (data.hasSponsors) return 60;
    if (data.hasNpmFunding) return 65;

    // No meaningful funding
    return 30;
  }

  calculateLicenseScore(data: LicenseData | null): number {
    if (data === null) return NA_SCORE;

    switch (data.risk) {
      case 'safe':
        return 100;
      case 'cautious':
        return 60;
      case 'risky':
        return 30;
      case 'unknown':
        return 10;
    }
  }

  // -------------------------------------------------------------------------
  // Weighted score computation with N/A redistribution
  // -------------------------------------------------------------------------

  /**
   * Compute the final weighted score. Metrics that returned N/A have their
   * weight redistributed proportionally across the remaining metrics.
   */
  computeWeightedScore(
    metrics: MetricEntry[],
    unavailableMetrics: string[],
  ): number {
    const unavailableSet = new Set(unavailableMetrics);

    const available = metrics.filter((m) => !unavailableSet.has(m.key));

    if (available.length === 0) return 0;

    const totalAvailableWeight = available.reduce((sum, m) => sum + m.weight, 0);

    if (totalAvailableWeight === 0) return 0;

    // Redistribute: each available metric's effective weight is
    // its original weight scaled so all effective weights sum to 1.
    let score = 0;
    for (const m of available) {
      const effectiveWeight = m.weight / totalAvailableWeight;
      score += m.score * effectiveWeight;
    }

    return clamp(Math.round(score));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  return years * 12 + months + (days < 0 ? -0.5 : 0);
}
