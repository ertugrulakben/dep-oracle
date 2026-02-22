import type {
  RegistryData,
  PopularityData,
  GitHubData,
} from '../parsers/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = 'rising' | 'stable' | 'declining' | 'unknown';

export interface TrendResult {
  /** Overall trend direction. */
  trend: TrendDirection;
  /** Confidence in the prediction (0-1). */
  confidence: number;
  /**
   * Estimated trust score change over the next 3 months.
   * Negative values indicate a projected decline (e.g. -5 means the score
   * is expected to drop by roughly 5 points).
   */
  riskProjection3m: number;
  /** Human-readable explanation of the trend assessment. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum signals required for a high-confidence prediction. */
const HIGH_CONFIDENCE_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// TrendPredictor
// ---------------------------------------------------------------------------

export class TrendPredictor {
  /**
   * Predict the trajectory of a package based on registry, popularity,
   * and GitHub signals.
   */
  predict(
    registry: RegistryData | null,
    popularity: PopularityData | null,
    github: GitHubData | null,
  ): TrendResult {
    const signals: TrendSignal[] = [];
    const reasons: string[] = [];

    // -----------------------------------------------------------------------
    // Signal 1: Download trend from PopularityData
    // -----------------------------------------------------------------------
    if (popularity !== null) {
      switch (popularity.trend) {
        case 'rising':
          signals.push({ direction: 'rising', weight: 0.4 });
          reasons.push('Downloads are trending upward');
          break;
        case 'declining':
          signals.push({ direction: 'declining', weight: 0.4 });
          reasons.push('Downloads are trending downward');
          break;
        case 'stable':
          signals.push({ direction: 'stable', weight: 0.3 });
          reasons.push('Downloads are stable');
          break;
      }
    }

    // -----------------------------------------------------------------------
    // Signal 2: Commit frequency from GitHub
    // -----------------------------------------------------------------------
    if (github !== null) {
      const commits30d = github.recentCommitCount;

      if (commits30d >= 30) {
        signals.push({ direction: 'rising', weight: 0.3 });
        reasons.push(`High commit activity (${commits30d} commits in 30 days)`);
      } else if (commits30d >= 10) {
        signals.push({ direction: 'stable', weight: 0.2 });
        reasons.push(`Moderate commit activity (${commits30d} commits in 30 days)`);
      } else if (commits30d >= 1) {
        signals.push({ direction: 'stable', weight: 0.15 });
        reasons.push(`Low commit activity (${commits30d} commits in 30 days)`);
      } else {
        signals.push({ direction: 'declining', weight: 0.3 });
        reasons.push('No commits in the last 30 days');
      }
    }

    // -----------------------------------------------------------------------
    // Signal 3: Version release cadence from RegistryData
    // -----------------------------------------------------------------------
    if (registry !== null) {
      if (registry.lastPublishDate !== null) {
        const lastPublish = new Date(registry.lastPublishDate);
        const monthsSincePublish = monthsBetween(lastPublish, new Date());

        if (monthsSincePublish < 2) {
          signals.push({ direction: 'rising', weight: 0.2 });
          reasons.push('Recent version published within last 2 months');
        } else if (monthsSincePublish < 6) {
          signals.push({ direction: 'stable', weight: 0.15 });
          reasons.push(`Last publish ${Math.round(monthsSincePublish)} months ago`);
        } else if (monthsSincePublish < 12) {
          signals.push({ direction: 'declining', weight: 0.2 });
          reasons.push(`No new version in ${Math.round(monthsSincePublish)} months`);
        } else {
          signals.push({ direction: 'declining', weight: 0.3 });
          reasons.push(`No new version in ${Math.round(monthsSincePublish)} months — possibly abandoned`);
        }
      }

      // Version count as a maturity signal
      if (registry.versionCount > 50) {
        signals.push({ direction: 'stable', weight: 0.1 });
        reasons.push(`Mature package with ${registry.versionCount} versions`);
      }

      // Deprecated flag is a strong declining signal (string | null)
      if (registry.deprecated !== null) {
        signals.push({ direction: 'declining', weight: 0.5 });
        reasons.push('Package is marked as deprecated');
      }
    }

    // -----------------------------------------------------------------------
    // Signal 4: Star/fork ratio as community interest (GitHub)
    // -----------------------------------------------------------------------
    if (github !== null && github.stars > 0) {
      const forkRatio = github.forks / github.stars;
      if (forkRatio > 0.3) {
        // High fork ratio suggests active community interest
        signals.push({ direction: 'rising', weight: 0.1 });
        reasons.push('High fork-to-star ratio indicates active community');
      }
    }

    // -----------------------------------------------------------------------
    // Aggregate signals
    // -----------------------------------------------------------------------
    if (signals.length === 0) {
      return {
        trend: 'unknown',
        confidence: 0,
        riskProjection3m: 0,
        reason: 'Insufficient data to determine trend',
      };
    }

    const { trend, confidence } = this.aggregateSignals(signals);
    const riskProjection3m = this.calculateRiskProjection(trend, confidence, signals);

    return {
      trend,
      confidence: Math.round(confidence * 100) / 100,
      riskProjection3m: Math.round(riskProjection3m),
      reason: reasons.join('. ') + '.',
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Aggregate multiple trend signals into a single direction and confidence.
   * Uses weighted voting: each signal votes for its direction with its weight.
   */
  private aggregateSignals(signals: TrendSignal[]): {
    trend: TrendDirection;
    confidence: number;
  } {
    const votes: Record<Exclude<TrendDirection, 'unknown'>, number> = {
      rising: 0,
      stable: 0,
      declining: 0,
    };

    let totalWeight = 0;

    for (const signal of signals) {
      votes[signal.direction] += signal.weight;
      totalWeight += signal.weight;
    }

    // Find the winning direction
    let maxVote = 0;
    let trend: TrendDirection = 'stable';

    for (const [direction, vote] of Object.entries(votes)) {
      if (vote > maxVote) {
        maxVote = vote;
        trend = direction as TrendDirection;
      }
    }

    // Confidence is based on:
    // 1. How dominant the winning direction is (proportion of total weight)
    // 2. How many signals we have (more signals = higher confidence)
    const dominance = totalWeight > 0 ? maxVote / totalWeight : 0;
    const signalCountFactor = Math.min(signals.length / HIGH_CONFIDENCE_THRESHOLD, 1);
    const confidence = Math.min(dominance * signalCountFactor, 1);

    return { trend, confidence };
  }

  /**
   * Estimate how much the trust score might change in 3 months based on
   * the trend and confidence.
   */
  private calculateRiskProjection(
    trend: TrendDirection,
    confidence: number,
    signals: TrendSignal[],
  ): number {
    // Base projection ranges
    const projectionMap: Record<TrendDirection, number> = {
      rising: 5,
      stable: 0,
      declining: -10,
      unknown: 0,
    };

    let base = projectionMap[trend];

    // Scale by confidence
    base *= confidence;

    // Strong negative signals amplify the projection
    const decliningWeight = signals
      .filter((s) => s.direction === 'declining')
      .reduce((sum, s) => sum + s.weight, 0);

    if (decliningWeight > 0.5) {
      // Multiple strong declining signals — amplify the negative projection
      base -= Math.round(decliningWeight * 5);
    }

    // Clamp to reasonable range
    return Math.max(-20, Math.min(10, base));
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TrendSignal {
  direction: 'rising' | 'stable' | 'declining';
  weight: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  return years * 12 + months + (days < 0 ? -0.5 : 0);
}
