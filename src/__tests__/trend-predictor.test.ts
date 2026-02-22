import { describe, it, expect } from 'vitest';
import { TrendPredictor } from '../analyzers/trend-predictor.js';
import type { RegistryData, PopularityData, GitHubData } from '../parsers/schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRegistry(overrides?: Partial<RegistryData>): RegistryData {
  return {
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
  };
}

function makePopularity(overrides?: Partial<PopularityData>): PopularityData {
  return {
    packageName: 'test-pkg',
    weeklyDownloads: 500_000,
    monthlyDownloads: 2_000_000,
    trend: 'stable',
    dependentCount: 100,
    ...overrides,
  };
}

function makeGitHub(overrides?: Partial<GitHubData>): GitHubData {
  return {
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
  };
}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrendPredictor', () => {
  const predictor = new TrendPredictor();

  it('predicts rising for package with rising downloads, active commits, recent publish', () => {
    const result = predictor.predict(
      makeRegistry({ lastPublishDate: new Date().toISOString() }),
      makePopularity({ trend: 'rising' }),
      makeGitHub({ recentCommitCount: 50, stars: 10000, forks: 5000 }),
    );
    expect(result.trend).toBe('rising');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.riskProjection3m).toBeGreaterThanOrEqual(0);
  });

  it('predicts declining for package with declining downloads, no commits, old publish', () => {
    const result = predictor.predict(
      makeRegistry({ lastPublishDate: monthsAgo(18), deprecated: null }),
      makePopularity({ trend: 'declining' }),
      makeGitHub({ recentCommitCount: 0, stars: 100, forks: 5 }),
    );
    expect(result.trend).toBe('declining');
    expect(result.riskProjection3m).toBeLessThan(0);
  });

  it('predicts stable for package with stable downloads and moderate commits', () => {
    const result = predictor.predict(
      makeRegistry({ lastPublishDate: monthsAgo(4) }),
      makePopularity({ trend: 'stable' }),
      makeGitHub({ recentCommitCount: 12 }),
    );
    expect(result.trend).toBe('stable');
  });

  it('returns unknown when all data is null', () => {
    const result = predictor.predict(null, null, null);
    expect(result.trend).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.riskProjection3m).toBe(0);
    expect(result.reason).toContain('Insufficient data');
  });

  it('strongly predicts declining for deprecated packages', () => {
    const result = predictor.predict(
      makeRegistry({ deprecated: 'Use alternative-pkg instead' }),
      makePopularity({ trend: 'declining' }),
      makeGitHub({ recentCommitCount: 0 }),
    );
    expect(result.trend).toBe('declining');
    expect(result.riskProjection3m).toBeLessThan(0);
    expect(result.reason).toContain('deprecated');
  });

  it('provides a human-readable reason', () => {
    const result = predictor.predict(
      makeRegistry(),
      makePopularity({ trend: 'rising' }),
      makeGitHub({ recentCommitCount: 35 }),
    );
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(10);
  });

  it('has confidence between 0 and 1', () => {
    const result = predictor.predict(
      makeRegistry(),
      makePopularity(),
      makeGitHub(),
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('provides positive riskProjection3m for rising trends', () => {
    const result = predictor.predict(
      makeRegistry({ lastPublishDate: new Date().toISOString() }),
      makePopularity({ trend: 'rising' }),
      makeGitHub({ recentCommitCount: 50, stars: 10000, forks: 5000 }),
    );
    expect(result.riskProjection3m).toBeGreaterThanOrEqual(0);
  });

  it('recognizes high fork-to-star ratio as community interest', () => {
    const result = predictor.predict(
      null,
      null,
      makeGitHub({ stars: 100, forks: 50, recentCommitCount: 35 }),
    );
    expect(result.reason).toContain('fork-to-star');
  });

  it('considers mature packages with 50+ versions as stable signal', () => {
    const result = predictor.predict(
      makeRegistry({ versionCount: 100, lastPublishDate: monthsAgo(4) }),
      null,
      null,
    );
    expect(result.reason).toContain('Mature package');
  });
});
