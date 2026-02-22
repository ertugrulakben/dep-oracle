import type { RegistryData, GitHubData } from '../parsers/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZombieSeverity = 'none' | 'warning' | 'critical';

export interface ZombieResult {
  isZombie: boolean;
  severity: ZombieSeverity;
  lastActivity: Date | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTHS_12 = 12;
const MONTHS_24 = 24;

// ---------------------------------------------------------------------------
// ZombieDetector
// ---------------------------------------------------------------------------

export class ZombieDetector {
  /**
   * Detect whether a package shows signs of abandonment ("zombie" status).
   *
   * Rules applied in priority order:
   * 1. Deprecated flag on the registry -> critical
   * 2. 0 active maintainers (contributorCount === 0) -> critical
   * 3. No commits in 24+ months -> critical
   * 4. No commits in 12+ months AND no publish in 12+ months -> warning
   */
  detect(
    registry: RegistryData | null,
    github: GitHubData | null,
  ): ZombieResult {
    const now = new Date();
    const reasons: string[] = [];

    // Track the most recent activity date from any source
    let lastActivity: Date | null = null;

    // -----------------------------------------------------------------------
    // Parse dates
    // -----------------------------------------------------------------------
    let lastPublishDate: Date | null = null;
    let monthsSincePublish: number | null = null;

    if (registry !== null && registry.lastPublishDate !== null) {
      lastPublishDate = new Date(registry.lastPublishDate);
      monthsSincePublish = monthsBetween(lastPublishDate, now);
      lastActivity = laterDate(lastActivity, lastPublishDate);
    }

    let lastCommitDate: Date | null = null;
    let monthsSinceCommit: number | null = null;

    if (github !== null && github.lastCommitDate !== null) {
      lastCommitDate = new Date(github.lastCommitDate);
      monthsSinceCommit = monthsBetween(lastCommitDate, now);
      lastActivity = laterDate(lastActivity, lastCommitDate);
    }

    // -----------------------------------------------------------------------
    // Rule 1: Deprecated
    // -----------------------------------------------------------------------
    if (registry !== null && registry.deprecated !== null) {
      reasons.push('Package is marked as deprecated');
      return {
        isZombie: true,
        severity: 'critical',
        lastActivity,
        reason: reasons.join('; '),
      };
    }

    // -----------------------------------------------------------------------
    // Rule 2: Zero active maintainers
    // -----------------------------------------------------------------------
    if (github !== null && github.contributorCount === 0) {
      reasons.push('0 active maintainers/contributors');
      return {
        isZombie: true,
        severity: 'critical',
        lastActivity,
        reason: reasons.join('; '),
      };
    }

    // -----------------------------------------------------------------------
    // Rule 3: No commits in 24+ months
    // -----------------------------------------------------------------------
    if (monthsSinceCommit !== null && monthsSinceCommit >= MONTHS_24) {
      reasons.push(
        `No commits in ${Math.round(monthsSinceCommit)} months, last commit ${formatDate(lastCommitDate!)}`,
      );
      return {
        isZombie: true,
        severity: 'critical',
        lastActivity,
        reason: reasons.join('; '),
      };
    }

    // -----------------------------------------------------------------------
    // Rule 4: No commits in 12+ months AND no publish in 12+ months
    // -----------------------------------------------------------------------
    const commitStale =
      monthsSinceCommit !== null && monthsSinceCommit >= MONTHS_12;
    const publishStale =
      monthsSincePublish !== null && monthsSincePublish >= MONTHS_12;

    if (commitStale && publishStale) {
      const parts: string[] = [];
      if (monthsSinceCommit !== null) {
        parts.push(`No commits in ${Math.round(monthsSinceCommit)} months`);
      }
      if (lastPublishDate !== null) {
        parts.push(`last publish ${formatDate(lastPublishDate)}`);
      }
      return {
        isZombie: true,
        severity: 'warning',
        lastActivity,
        reason: parts.join(', '),
      };
    }

    // Also flag warning when only one signal is available and it is stale
    if (commitStale && monthsSincePublish === null) {
      reasons.push(
        `No commits in ${Math.round(monthsSinceCommit!)} months (registry data unavailable)`,
      );
      return {
        isZombie: true,
        severity: 'warning',
        lastActivity,
        reason: reasons.join('; '),
      };
    }

    if (publishStale && monthsSinceCommit === null) {
      reasons.push(
        `No publish in ${Math.round(monthsSincePublish!)} months (GitHub data unavailable)`,
      );
      return {
        isZombie: true,
        severity: 'warning',
        lastActivity,
        reason: reasons.join('; '),
      };
    }

    // -----------------------------------------------------------------------
    // Not a zombie
    // -----------------------------------------------------------------------
    return {
      isZombie: false,
      severity: 'none',
      lastActivity,
      reason: 'Package is actively maintained',
    };
  }
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

function laterDate(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b;
  if (b === null) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
