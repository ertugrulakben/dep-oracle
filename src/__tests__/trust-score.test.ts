import { describe, it, expect } from 'vitest';
import { TrustScoreEngine } from '../analyzers/trust-score.js';
import type {
  CollectorResult,
  RegistryData,
  GitHubData,
  SecurityData,
  FundingData,
  PopularityData,
  LicenseData,
} from '../parsers/schema.js';
import type { AllCollectorResults } from '../analyzers/trust-score.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRegistry(overrides?: Partial<RegistryData>): CollectorResult<RegistryData> {
  return {
    status: 'success',
    data: {
      packageName: 'test-pkg',
      version: '1.0.0',
      description: 'A test package',
      lastPublishDate: new Date().toISOString(),
      versionCount: 20,
      deprecated: null,
      weeklyDownloads: 50_000,
      license: 'MIT',
      repositoryUrl: 'https://github.com/test/test-pkg',
      ...overrides,
    },
  };
}

function makeGitHub(overrides?: Partial<GitHubData>): CollectorResult<GitHubData> {
  return {
    status: 'success',
    data: {
      owner: 'test',
      repo: 'test-pkg',
      stars: 5000,
      forks: 300,
      openIssues: 10,
      updatedAt: new Date().toISOString(),
      archived: false,
      defaultBranch: 'main',
      contributorCount: 25,
      recentCommitCount: 40,
      lastCommitDate: new Date().toISOString(),
      lastCommitSha: 'abc123',
      hasFundingYml: true,
      ...overrides,
    },
  };
}

function makeSecurity(overrides?: Partial<SecurityData>): CollectorResult<SecurityData> {
  return {
    status: 'success',
    data: {
      packageName: 'test-pkg',
      version: '1.0.0',
      totalVulnerabilities: 0,
      severityCounts: {},
      latestVulnDate: null,
      averagePatchDays: null,
      vulnerabilities: [],
      ...overrides,
    },
  };
}

function makeFunding(overrides?: Partial<FundingData>): CollectorResult<FundingData> {
  return {
    status: 'success',
    data: {
      packageName: 'test-pkg',
      hasSponsors: true,
      hasOpenCollective: true,
      hasNpmFunding: true,
      openCollectiveSlug: 'test-pkg',
      openCollectiveBackers: 50,
      estimatedAnnualFunding: 100_000,
      fundingUrls: ['https://opencollective.com/test-pkg'],
      ...overrides,
    },
  };
}

function makePopularity(overrides?: Partial<PopularityData>): CollectorResult<PopularityData> {
  return {
    status: 'success',
    data: {
      packageName: 'test-pkg',
      weeklyDownloads: 1_000_000,
      monthlyDownloads: 4_000_000,
      trend: 'rising',
      dependentCount: 500,
      ...overrides,
    },
  };
}

function makeLicense(overrides?: Partial<LicenseData>): CollectorResult<LicenseData> {
  return {
    status: 'success',
    data: {
      packageName: 'test-pkg',
      version: '1.0.0',
      raw: 'MIT',
      spdx: 'MIT',
      risk: 'safe',
      osiApproved: true,
      ...overrides,
    },
  };
}

function makeAllResults(overrides?: Partial<AllCollectorResults>): AllCollectorResults {
  return {
    registry: makeRegistry(),
    github: makeGitHub(),
    security: makeSecurity(),
    funding: makeFunding(),
    popularity: makePopularity(),
    license: makeLicense(),
    ...overrides,
  };
}

function nullResult<T>(): CollectorResult<T> {
  return { status: 'error', data: null, error: 'No data' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrustScoreEngine', () => {
  const engine = new TrustScoreEngine();

  // -----------------------------------------------------------------------
  // calculate()
  // -----------------------------------------------------------------------

  describe('calculate()', () => {
    it('returns a valid score between 0 and 100 with all data available', () => {
      const result = engine.calculate(makeAllResults());
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(result.insufficientData).toBe(false);
      expect(result.unavailableMetrics).toHaveLength(0);
    });

    it('redistributes weight when some data is missing', () => {
      const results = makeAllResults({
        security: nullResult<SecurityData>(),
        funding: nullResult<FundingData>(),
      });
      const result = engine.calculate(results);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(result.unavailableMetrics).toContain('security');
      expect(result.unavailableMetrics).toContain('funding');
      expect(result.insufficientData).toBe(true); // 2 missing, threshold is now 2
    });

    it('returns 0 when all data is missing', () => {
      const results: AllCollectorResults = {
        registry: nullResult<RegistryData>(),
        github: nullResult<GitHubData>(),
        security: nullResult<SecurityData>(),
        funding: nullResult<FundingData>(),
        popularity: nullResult<PopularityData>(),
        license: nullResult<LicenseData>(),
      };
      const result = engine.calculate(results);
      expect(result.trustScore).toBe(0);
      expect(result.insufficientData).toBe(true);
      expect(result.unavailableMetrics).toHaveLength(6);
    });

    it('marks insufficientData when 3+ metrics are unavailable', () => {
      const results = makeAllResults({
        security: nullResult<SecurityData>(),
        funding: nullResult<FundingData>(),
        license: nullResult<LicenseData>(),
      });
      const result = engine.calculate(results);
      expect(result.insufficientData).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // calculateSecurityScore
  // -----------------------------------------------------------------------

  describe('calculateSecurityScore()', () => {
    it('returns 100 for 0 vulnerabilities', () => {
      const score = engine.calculateSecurityScore({
        packageName: 'pkg',
        version: '1.0.0',
        totalVulnerabilities: 0,
        severityCounts: {},
        latestVulnDate: null,
        averagePatchDays: null,
        vulnerabilities: [],
      });
      expect(score).toBe(100);
    });

    it('returns 85 for 1 vulnerability (diminishing penalty)', () => {
      const score = engine.calculateSecurityScore({
        packageName: 'pkg',
        version: '1.0.0',
        totalVulnerabilities: 1,
        severityCounts: { high: 1 },
        latestVulnDate: '2024-01-01T00:00:00Z',
        averagePatchDays: null,
        vulnerabilities: [{ id: 'CVE-1', summary: 'x', severity: 'high', published: '2024-01-01T00:00:00Z' }],
      });
      expect(score).toBe(85);
    });

    it('returns 40 for 5 vulnerabilities (diminishing penalty with floor)', () => {
      const score = engine.calculateSecurityScore({
        packageName: 'pkg',
        version: '1.0.0',
        totalVulnerabilities: 5,
        severityCounts: { high: 5 },
        latestVulnDate: '2024-01-01T00:00:00Z',
        averagePatchDays: null,
        vulnerabilities: [],
      });
      // 5+ vulns: max(20, 100 - 5*12) = max(20, 40) = 40
      expect(score).toBe(40);
    });

    it('floors at 20 when vulnerabilities are very high', () => {
      const score = engine.calculateSecurityScore({
        packageName: 'pkg',
        version: '1.0.0',
        totalVulnerabilities: 10,
        severityCounts: { critical: 10 },
        latestVulnDate: '2024-01-01T00:00:00Z',
        averagePatchDays: null,
        vulnerabilities: [],
      });
      // 10 vulns: max(20, 100 - 10*12) = max(20, -20) = 20
      expect(score).toBe(20);
    });

    it('adds +10 bonus for fast patch time (<= 7 days)', () => {
      const baseScore = engine.calculateSecurityScore({
        packageName: 'pkg',
        version: '1.0.0',
        totalVulnerabilities: 1,
        severityCounts: { low: 1 },
        latestVulnDate: '2024-01-01T00:00:00Z',
        averagePatchDays: 3,
        vulnerabilities: [],
      });
      // 1 vuln = 85, fast patch bonus (+10) = 95
      expect(baseScore).toBe(95);
    });

    it('returns -1 (N/A) for null data', () => {
      const score = engine.calculateSecurityScore(null);
      expect(score).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // calculateMaintainerScore
  // -----------------------------------------------------------------------

  describe('calculateMaintainerScore()', () => {
    it('caps at 60 for 1 contributor', () => {
      const score = engine.calculateMaintainerScore({
        owner: 'x', repo: 'y', stars: 100, forks: 10, openIssues: 1,
        updatedAt: new Date().toISOString(), archived: false, defaultBranch: 'main',
        contributorCount: 1, recentCommitCount: 30,
        lastCommitDate: new Date().toISOString(), lastCommitSha: 'a',
        hasFundingYml: false,
      });
      // ceiling 60, recentCommitCount >= 20 gives +5 but capped to ceiling
      expect(score).toBeLessThanOrEqual(60);
    });

    it('caps at 80 for 3 contributors', () => {
      const score = engine.calculateMaintainerScore({
        owner: 'x', repo: 'y', stars: 100, forks: 10, openIssues: 1,
        updatedAt: new Date().toISOString(), archived: false, defaultBranch: 'main',
        contributorCount: 3, recentCommitCount: 30,
        lastCommitDate: new Date().toISOString(), lastCommitSha: 'a',
        hasFundingYml: false,
      });
      expect(score).toBeLessThanOrEqual(80);
    });

    it('allows up to 100 for 10+ contributors', () => {
      const score = engine.calculateMaintainerScore({
        owner: 'x', repo: 'y', stars: 1000, forks: 100, openIssues: 5,
        updatedAt: new Date().toISOString(), archived: false, defaultBranch: 'main',
        contributorCount: 10, recentCommitCount: 25,
        lastCommitDate: new Date().toISOString(), lastCommitSha: 'a',
        hasFundingYml: true,
      });
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(80);
    });

    it('penalizes 0 recent commits', () => {
      const score = engine.calculateMaintainerScore({
        owner: 'x', repo: 'y', stars: 100, forks: 10, openIssues: 1,
        updatedAt: new Date().toISOString(), archived: false, defaultBranch: 'main',
        contributorCount: 10, recentCommitCount: 0,
        lastCommitDate: new Date().toISOString(), lastCommitSha: 'a',
        hasFundingYml: false,
      });
      // ceiling 100, score -= 20 = 80
      expect(score).toBe(80);
    });

    it('returns -1 for null data', () => {
      expect(engine.calculateMaintainerScore(null)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // calculateActivityScore
  // -----------------------------------------------------------------------

  describe('calculateActivityScore()', () => {
    it('returns high score for recent publish and active commits', () => {
      const score = engine.calculateActivityScore(
        { packageName: 'p', version: '1.0.0', description: null, lastPublishDate: new Date().toISOString(), versionCount: 10, deprecated: null, weeklyDownloads: 1000, license: 'MIT', repositoryUrl: null },
        { owner: 'x', repo: 'y', stars: 100, forks: 10, openIssues: 1, updatedAt: new Date().toISOString(), archived: false, defaultBranch: 'main', contributorCount: 5, recentCommitCount: 35, lastCommitDate: new Date().toISOString(), lastCommitSha: 'a', hasFundingYml: false },
      );
      // publishScore 100, commitScore 100 -> 100*0.6 + 100*0.4 = 100
      expect(score).toBe(100);
    });

    it('returns low score for old publish date', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 3);
      const score = engine.calculateActivityScore(
        { packageName: 'p', version: '1.0.0', description: null, lastPublishDate: twoYearsAgo.toISOString(), versionCount: 10, deprecated: null, weeklyDownloads: 1000, license: 'MIT', repositoryUrl: null },
        null,
      );
      expect(score).toBe(0);
    });

    it('returns -1 when both registry and github are null', () => {
      expect(engine.calculateActivityScore(null, null)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // calculatePopularityScore
  // -----------------------------------------------------------------------

  describe('calculatePopularityScore()', () => {
    it('returns 100 for 10M+ weekly downloads', () => {
      const score = engine.calculatePopularityScore({
        packageName: 'p', weeklyDownloads: 10_000_000, monthlyDownloads: 40_000_000, trend: 'stable', dependentCount: 1000,
      });
      expect(score).toBe(100);
    });

    it('returns 25 for ~100 weekly downloads', () => {
      const score = engine.calculatePopularityScore({
        packageName: 'p', weeklyDownloads: 100, monthlyDownloads: 400, trend: 'stable', dependentCount: 1,
      });
      expect(score).toBe(25);
    });

    it('returns 10 for very low downloads', () => {
      const score = engine.calculatePopularityScore({
        packageName: 'p', weeklyDownloads: 5, monthlyDownloads: 20, trend: 'declining', dependentCount: 0,
      });
      expect(score).toBe(10);
    });

    it('returns -1 for null data', () => {
      expect(engine.calculatePopularityScore(null)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // calculateFundingScore
  // -----------------------------------------------------------------------

  describe('calculateFundingScore()', () => {
    it('returns 90 for corporate-level funding (>= 50k)', () => {
      const score = engine.calculateFundingScore({
        packageName: 'p', hasSponsors: true, hasOpenCollective: true, hasNpmFunding: true,
        openCollectiveSlug: 'p', openCollectiveBackers: 100, estimatedAnnualFunding: 100_000, fundingUrls: [],
      });
      expect(score).toBe(90);
    });

    it('returns 30 for no funding at all', () => {
      const score = engine.calculateFundingScore({
        packageName: 'p', hasSponsors: false, hasOpenCollective: false, hasNpmFunding: false,
        openCollectiveSlug: null, openCollectiveBackers: 0, estimatedAnnualFunding: 0, fundingUrls: [],
      });
      expect(score).toBe(30);
    });

    it('returns 70 for OpenCollective only', () => {
      const score = engine.calculateFundingScore({
        packageName: 'p', hasSponsors: false, hasOpenCollective: true, hasNpmFunding: false,
        openCollectiveSlug: 'p', openCollectiveBackers: 10, estimatedAnnualFunding: 5_000, fundingUrls: [],
      });
      expect(score).toBe(70);
    });

    it('returns -1 for null data', () => {
      expect(engine.calculateFundingScore(null)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // calculateLicenseScore
  // -----------------------------------------------------------------------

  describe('calculateLicenseScore()', () => {
    it('returns 100 for safe (MIT) license', () => {
      const score = engine.calculateLicenseScore({
        packageName: 'p', version: '1.0.0', raw: 'MIT', spdx: 'MIT', risk: 'safe', osiApproved: true,
      });
      expect(score).toBe(100);
    });

    it('returns 60 for cautious license', () => {
      const score = engine.calculateLicenseScore({
        packageName: 'p', version: '1.0.0', raw: 'LGPL-3.0', spdx: 'LGPL-3.0', risk: 'cautious', osiApproved: true,
      });
      expect(score).toBe(60);
    });

    it('returns 10 for unknown license', () => {
      const score = engine.calculateLicenseScore({
        packageName: 'p', version: '1.0.0', raw: null, spdx: null, risk: 'unknown', osiApproved: false,
      });
      expect(score).toBe(10);
    });

    it('returns -1 for null data', () => {
      expect(engine.calculateLicenseScore(null)).toBe(-1);
    });
  });

  // -----------------------------------------------------------------------
  // computeWeightedScore
  // -----------------------------------------------------------------------

  describe('computeWeightedScore()', () => {
    it('correctly redistributes weight from N/A metrics', () => {
      const metrics = [
        { key: 'security' as const, weight: 0.5, score: 80 },
        { key: 'maintainer' as const, weight: 0.5, score: -1 },
      ];
      const result = engine.computeWeightedScore(metrics, ['maintainer']);
      // Only security available (weight 0.5), score 80. Missing 50% weight.
      // Penalty: (80-50)*0.5 = 15. Final: 80-15 = 65
      expect(result).toBe(65);
    });

    it('returns 0 when all metrics are unavailable', () => {
      const metrics = [
        { key: 'security' as const, weight: 0.5, score: -1 },
        { key: 'maintainer' as const, weight: 0.5, score: -1 },
      ];
      const result = engine.computeWeightedScore(metrics, ['security', 'maintainer']);
      expect(result).toBe(0);
    });

    it('correctly computes with all metrics available', () => {
      const metrics = [
        { key: 'security' as const, weight: 0.5, score: 100 },
        { key: 'maintainer' as const, weight: 0.5, score: 50 },
      ];
      const result = engine.computeWeightedScore(metrics, []);
      // (100 * 0.5 + 50 * 0.5) = 75
      expect(result).toBe(75);
    });
  });

  // -----------------------------------------------------------------------
  // Custom weights
  // -----------------------------------------------------------------------

  describe('custom weights', () => {
    it('respects custom weight overrides', () => {
      const customEngine = new TrustScoreEngine({ security: 1.0, maintainer: 0, activity: 0, popularity: 0, funding: 0, license: 0 });
      const results = makeAllResults();
      const result = customEngine.calculate(results);
      // With security weight = 1.0 and 0 vulns, security score = 100
      // All other weights are 0 so after redistribution: score ~ 100
      expect(result.trustScore).toBe(100);
    });
  });
});
