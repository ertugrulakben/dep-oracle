/**
 * SecurityCollector -- queries the OSV.dev API for known vulnerabilities
 * affecting an npm package.
 *
 * Data source:
 *   POST https://api.osv.dev/v1/query
 */

import type { CollectorResult, SecurityData } from '../parsers/schema.js';
import type { CacheManager } from '../cache/store.js';
import { logger } from '../utils/logger.js';
import { BaseCollector } from './base.js';

/** Subset of the OSV vulnerability schema we use. */
interface OsvVulnerability {
  id: string;
  summary?: string;
  modified: string;
  published?: string;
  severity?: OsvSeverity[];
  database_specific?: {
    severity?: string;
    [key: string]: unknown;
  };
  affected?: OsvAffected[];
}

interface OsvSeverity {
  type: string;
  score: string;
}

interface OsvAffected {
  package?: { name?: string; ecosystem?: string };
  ranges?: OsvRange[];
  versions?: string[];
}

interface OsvRange {
  type: string;
  events: Array<{ introduced?: string; fixed?: string }>;
}

interface OsvQueryResponse {
  vulns?: OsvVulnerability[];
}

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export class SecurityCollector extends BaseCollector<SecurityData> {
  readonly name = 'security';

  constructor(cache: CacheManager) {
    super(cache);
  }

  async collect(
    packageName: string,
    version: string,
  ): Promise<CollectorResult<SecurityData>> {
    // Check cache first
    const cached = await this.getCached(packageName, version);
    if (cached) return cached;

    try {
      const vulns = await this.queryOsv(packageName);

      const totalVulnerabilities = vulns.length;

      // Count vulnerabilities by severity
      const severityCounts: Record<SeverityLevel, number> = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unknown: 0,
      };

      for (const vuln of vulns) {
        const severity = this.extractSeverity(vuln);
        severityCounts[severity]++;
      }

      // Find the latest vulnerability date
      const vulnDates = vulns
        .map((v) => new Date(v.published ?? v.modified).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => b - a);

      const latestVulnDate = vulnDates.length > 0
        ? new Date(vulnDates[0]).toISOString()
        : null;

      // Estimate average patch time in days.
      // For each vuln that has a "fixed" event we compute introduced -> fixed delta.
      const patchDays = this.estimateAveragePatchDays(vulns);

      const data: SecurityData = {
        packageName,
        version,
        totalVulnerabilities,
        severityCounts,
        latestVulnDate,
        averagePatchDays: patchDays,
        vulnerabilities: vulns.map((v) => ({
          id: v.id,
          summary: v.summary ?? null,
          severity: this.extractSeverity(v),
          published: v.published ?? v.modified,
        })),
      };

      await this.setCache(packageName, version, data);

      return {
        status: 'success',
        data,
        collectedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`SecurityCollector failed for ${packageName}@${version}: ${message}`);

      return {
        status: 'error',
        data: null,
        error: message,
        collectedAt: new Date().toISOString(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // OSV API
  // ---------------------------------------------------------------------------

  private async queryOsv(packageName: string): Promise<OsvVulnerability[]> {
    const url = 'https://api.osv.dev/v1/query';
    logger.debug(`OSV: querying vulnerabilities for ${packageName}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: {
          name: packageName,
          ecosystem: 'npm',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`OSV API returned ${res.status}`);
    }

    const body = (await res.json()) as OsvQueryResponse;
    return body.vulns ?? [];
  }

  // ---------------------------------------------------------------------------
  // Severity extraction
  // ---------------------------------------------------------------------------

  /**
   * Determine the highest severity label for a vulnerability.
   *
   * OSV may provide CVSS vectors, database-specific severity strings, or
   * nothing at all. We try multiple sources in order of preference.
   */
  private extractSeverity(vuln: OsvVulnerability): SeverityLevel {
    // 1. Try CVSS score from severity array
    if (vuln.severity && vuln.severity.length > 0) {
      for (const s of vuln.severity) {
        const level = this.cvssToLevel(s.score);
        if (level !== 'unknown') return level;
      }
    }

    // 2. Try database_specific.severity string
    const dbSeverity = vuln.database_specific?.severity;
    if (typeof dbSeverity === 'string') {
      const normalised = dbSeverity.toLowerCase().trim();
      if (normalised === 'critical') return 'critical';
      if (normalised === 'high') return 'high';
      if (normalised === 'moderate' || normalised === 'medium') return 'medium';
      if (normalised === 'low') return 'low';
    }

    return 'unknown';
  }

  /**
   * Map a CVSS 3.x vector string to a severity level by extracting the
   * base score. If the string looks like a plain number, use it directly.
   */
  private cvssToLevel(scoreOrVector: string): SeverityLevel {
    let numeric: number;

    if (scoreOrVector.startsWith('CVSS:')) {
      // Extract base score: it is not embedded literally in the vector, so
      // we fall back to a simpler heuristic based on the Attack Complexity
      // and Impact metrics. A proper CVSS calculator is out of scope here,
      // so we return 'unknown' and let database_specific take over.
      return 'unknown';
    }

    numeric = parseFloat(scoreOrVector);
    if (isNaN(numeric)) return 'unknown';

    if (numeric >= 9.0) return 'critical';
    if (numeric >= 7.0) return 'high';
    if (numeric >= 4.0) return 'medium';
    if (numeric > 0) return 'low';

    return 'unknown';
  }

  // ---------------------------------------------------------------------------
  // Patch-time estimation
  // ---------------------------------------------------------------------------

  /**
   * Estimate average number of days between a vulnerability being introduced
   * and being fixed. Uses the range events in the OSV affected data.
   *
   * When no usable data is available, returns `null`.
   */
  private estimateAveragePatchDays(vulns: OsvVulnerability[]): number | null {
    const daysPerVuln: number[] = [];

    for (const vuln of vulns) {
      if (!vuln.affected) continue;

      for (const affected of vuln.affected) {
        if (!affected.ranges) continue;

        for (const range of affected.ranges) {
          let introduced: string | undefined;
          let fixed: string | undefined;

          for (const event of range.events) {
            if (event.introduced) introduced = event.introduced;
            if (event.fixed) fixed = event.fixed;
          }

          // We can only compute a meaningful delta when we have dates
          // (ECOSYSTEM or SEMVER ranges use version strings, not dates).
          // For GIT ranges the events are commit SHAs.
          // Fall back to published -> modified as a proxy.
          if (introduced && fixed) {
            // These are typically version strings, not dates. Skip.
            continue;
          }
        }
      }

      // Proxy: time from published to last modified (often the fix date).
      const published = vuln.published ? new Date(vuln.published).getTime() : NaN;
      const modified = new Date(vuln.modified).getTime();

      if (!isNaN(published) && !isNaN(modified) && modified > published) {
        const days = (modified - published) / (1000 * 60 * 60 * 24);
        if (days > 0 && days < 3650) {
          // Sanity: ignore anything over 10 years
          daysPerVuln.push(days);
        }
      }
    }

    if (daysPerVuln.length === 0) return null;

    const total = daysPerVuln.reduce((sum, d) => sum + d, 0);
    return Math.round(total / daysPerVuln.length);
  }
}
