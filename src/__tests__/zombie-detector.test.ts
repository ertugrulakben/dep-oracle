import { describe, it, expect } from 'vitest';
import { ZombieDetector } from '../analyzers/zombie-detector.js';
import type { RegistryData, GitHubData } from '../parsers/schema.js';

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

describe('ZombieDetector', () => {
  const detector = new ZombieDetector();

  it('marks an active package with recent commits and publish as NOT zombie', () => {
    const result = detector.detect(makeRegistry(), makeGitHub());
    expect(result.isZombie).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.reason).toContain('actively maintained');
  });

  it('marks a package with no commits for 24+ months as zombie (critical)', () => {
    const result = detector.detect(
      makeRegistry(),
      makeGitHub({ lastCommitDate: monthsAgo(30), recentCommitCount: 0 }),
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('No commits');
  });

  it('marks a package with stale commits (12+ months) AND stale publish (12+ months) as zombie warning', () => {
    const result = detector.detect(
      makeRegistry({ lastPublishDate: monthsAgo(14) }),
      makeGitHub({ lastCommitDate: monthsAgo(14), recentCommitCount: 0 }),
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('warning');
  });

  it('marks a deprecated package as zombie (critical)', () => {
    const result = detector.detect(
      makeRegistry({ deprecated: 'This package is no longer maintained' }),
      makeGitHub(),
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('deprecated');
  });

  it('marks a package with 0 contributors as zombie (critical)', () => {
    const result = detector.detect(
      makeRegistry(),
      makeGitHub({ contributorCount: 0 }),
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('0 active maintainers');
  });

  it('returns not zombie when both registry and github are null (safe default)', () => {
    const result = detector.detect(null, null);
    expect(result.isZombie).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.lastActivity).toBeNull();
  });

  it('returns zombie warning when only commit data is stale and registry is null', () => {
    const result = detector.detect(
      null,
      makeGitHub({ lastCommitDate: monthsAgo(14), recentCommitCount: 0 }),
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('warning');
    expect(result.reason).toContain('registry data unavailable');
  });

  it('returns zombie warning when only publish is stale and github is null', () => {
    const result = detector.detect(
      makeRegistry({ lastPublishDate: monthsAgo(18) }),
      null,
    );
    expect(result.isZombie).toBe(true);
    expect(result.severity).toBe('warning');
    expect(result.reason).toContain('GitHub data unavailable');
  });

  it('tracks lastActivity correctly from the most recent date', () => {
    const recent = new Date();
    const old = new Date();
    old.setFullYear(old.getFullYear() - 1);

    const result = detector.detect(
      makeRegistry({ lastPublishDate: recent.toISOString() }),
      makeGitHub({ lastCommitDate: old.toISOString(), recentCommitCount: 5 }),
    );
    expect(result.isZombie).toBe(false);
    expect(result.lastActivity).not.toBeNull();
    // lastActivity should be the publish date (more recent)
    expect(result.lastActivity!.getTime()).toBeGreaterThanOrEqual(old.getTime());
  });

  it('does NOT flag a package with 11 month commit gap as zombie if publish is fresh', () => {
    const result = detector.detect(
      makeRegistry({ lastPublishDate: new Date().toISOString() }),
      makeGitHub({ lastCommitDate: monthsAgo(11), recentCommitCount: 0 }),
    );
    expect(result.isZombie).toBe(false);
  });
});
