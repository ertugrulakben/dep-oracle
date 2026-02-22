/**
 * dep-oracle -- public API for programmatic use.
 *
 * This module re-exports the key types, parsers, collectors, analyzers,
 * and cache infrastructure so consumers can integrate dep-oracle into
 * their own tooling without going through the CLI.
 *
 * Usage:
 *   import { NpmParser, CollectorOrchestrator, TrustScoreEngine } from 'dep-oracle';
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  DependencyTree,
  DependencyNode,
  TrustReport,
  ScanResult,
  Config,
  CollectorResult,
  CollectorStatus,
  TrustMetrics,
  Registry,
  RegistryData,
  GitHubData,
  SecurityData,
  FundingData,
  PopularityData,
  LicenseData,
  DownloadTrend,
  LicenseRisk,
  VulnerabilityEntry,
} from './parsers/schema.js';

// ---------------------------------------------------------------------------
// Schema utilities
// ---------------------------------------------------------------------------

export {
  ConfigSchema,
  DependencyNodeSchema,
  DependencyTreeSchema,
  TrustReportSchema,
  ScanResultSchema,
  TrustMetricsSchema,
  createDependencyNode,
  createDependencyTree,
  collectorSuccess,
  collectorError,
  collectorCached,
  collectorOffline,
} from './parsers/schema.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export { BaseParser } from './parsers/base.js';
export { NpmParser } from './parsers/npm.js';
export { PythonParser } from './parsers/python.js';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export { CacheManager } from './cache/store.js';

// ---------------------------------------------------------------------------
// Collectors
// ---------------------------------------------------------------------------

export { CollectorOrchestrator } from './collectors/orchestrator.js';
export type { AllCollectorResults, OrchestratorOptions } from './collectors/orchestrator.js';

// ---------------------------------------------------------------------------
// Analyzers
// ---------------------------------------------------------------------------

export { TrustScoreEngine } from './analyzers/trust-score.js';
export type { TrustScoreResult } from './analyzers/trust-score.js';

export { ZombieDetector } from './analyzers/zombie-detector.js';
export type { ZombieResult, ZombieSeverity } from './analyzers/zombie-detector.js';

export { BlastRadiusCalculator } from './analyzers/blast-radius.js';
export type { BlastRadiusResult } from './analyzers/blast-radius.js';

export { TyposquatDetector } from './analyzers/typosquat.js';
export type { TyposquatResult } from './analyzers/typosquat.js';

export { TrendPredictor } from './analyzers/trend-predictor.js';
export type { TrendResult, TrendDirection } from './analyzers/trend-predictor.js';

export { MigrationAdvisor } from './analyzers/migration-advisor.js';
export type { MigrationSuggestion, MigrationDifficulty } from './analyzers/migration-advisor.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { buildImportGraph, getBlastRadius, getImportingFiles } from './utils/graph.js';
export type { ImportGraph } from './utils/graph.js';

export { logger, createLogger, isDebug, setVerbose, isVerbose } from './utils/logger.js';

export { RateLimiter, githubRateLimiter, npmRateLimiter, pypiRateLimiter } from './utils/rate-limiter.js';

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

export { loadConfig } from './cli/config.js';

// ---------------------------------------------------------------------------
// Convenience API — matches README documentation
// ---------------------------------------------------------------------------

import { resolve } from 'node:path';
import type { DependencyTree, TrustReport, ScanResult } from './parsers/schema.js';
import { NpmParser } from './parsers/npm.js';
import { PythonParser } from './parsers/python.js';
import { CacheManager } from './cache/store.js';
import { CollectorOrchestrator } from './collectors/orchestrator.js';
import { TrustScoreEngine } from './analyzers/trust-score.js';
import { ZombieDetector } from './analyzers/zombie-detector.js';
import { MigrationAdvisor } from './analyzers/migration-advisor.js';
import { TyposquatDetector } from './analyzers/typosquat.js';
import { buildImportGraph, getBlastRadius } from './utils/graph.js';

async function detectProject(dir: string): Promise<DependencyTree | null> {
  const parsers = [new NpmParser(), new PythonParser()];
  for (const parser of parsers) {
    if (await parser.detect(dir)) return parser.parse(dir);
  }
  return null;
}

/**
 * Scan a project directory and return a full trust report.
 *
 * ```typescript
 * import { scan } from 'dep-oracle';
 * const report = await scan({ dir: './my-project' });
 * console.log(report.overallScore);
 * ```
 */
export async function scan(options?: {
  dir?: string;
  githubToken?: string;
  offline?: boolean;
  ecosystem?: 'npm' | 'pypi';
}): Promise<ScanResult> {
  const dir = resolve(options?.dir ?? process.cwd());
  const cache = new CacheManager();
  const orchestrator = new CollectorOrchestrator(cache, {
    githubToken: options?.githubToken,
    offline: options?.offline,
  });
  const trustEngine = new TrustScoreEngine();
  const zombieDetector = new ZombieDetector();
  const migrationAdvisor = new MigrationAdvisor();
  const typosquatDetector = new TyposquatDetector();

  const tree = await detectProject(dir);
  if (!tree) {
    return {
      tree: { root: dir, manifest: '', nodes: new Map(), totalDirect: 0, totalTransitive: 0 },
      reports: [],
      overallScore: 0,
      summary: 'No supported manifest file found.',
    };
  }

  const importGraph = await buildImportGraph(dir);
  const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
  const reports: TrustReport[] = [];

  for (const node of directNodes) {
    const blastRadius = getBlastRadius(node.name, importGraph);
    const nodeEcosystem = options?.ecosystem ?? node.registry;
    const results = await orchestrator.collectAll(node.name, node.version, nodeEcosystem);
    const trustResult = trustEngine.calculate(results);
    const zombie = zombieDetector.detect(results.registry.data, results.github.data);
    const typosquat = typosquatDetector.check(node.name);
    const alternatives = migrationAdvisor
      .suggest(node.name, zombie.isZombie ? 'zombie dependency' : 'low trust score')
      .map((a) => a.alternative);
    const trend = results.popularity.data?.trend ?? 'stable';

    reports.push({
      package: node.name,
      version: node.version,
      trustScore: trustResult.trustScore,
      metrics: trustResult.metrics,
      isZombie: zombie.isZombie,
      blastRadius,
      alternatives,
      trend,
      typosquatRisk: typosquat.isRisky ? 1.0 : 0.0,
    });
  }

  const overallScore =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.trustScore, 0) / reports.length)
      : 0;

  return {
    tree,
    reports,
    overallScore,
    summary:
      `Scanned ${reports.length} direct dependencies. ` +
      `Overall trust score: ${overallScore}/100. ` +
      `${reports.filter((r) => r.isZombie).length} zombie(s) detected.`,
  };
}

/**
 * Check a single package and return its trust report.
 *
 * ```typescript
 * import { checkPackage } from 'dep-oracle';
 * const result = await checkPackage('express');
 * console.log(result.trustScore); // 74
 * ```
 */
export async function checkPackage(
  packageName: string,
  version?: string,
  options?: { githubToken?: string; offline?: boolean; ecosystem?: 'npm' | 'pypi' },
): Promise<TrustReport> {
  const cache = new CacheManager();
  const orchestrator = new CollectorOrchestrator(cache, {
    githubToken: options?.githubToken,
    offline: options?.offline,
  });
  const trustEngine = new TrustScoreEngine();
  const zombieDetector = new ZombieDetector();
  const migrationAdvisor = new MigrationAdvisor();
  const typosquatDetector = new TyposquatDetector();

  const ecosystem = options?.ecosystem ?? 'npm';
  const results = await orchestrator.collectAll(packageName, version ?? 'latest', ecosystem);
  const trustResult = trustEngine.calculate(results);
  const zombie = zombieDetector.detect(results.registry.data, results.github.data);
  const typosquat = typosquatDetector.check(packageName);
  const alternatives = migrationAdvisor
    .suggest(packageName, zombie.isZombie ? 'zombie dependency' : 'low trust score')
    .map((a) => a.alternative);
  const trend = results.popularity.data?.trend ?? 'stable';

  return {
    package: packageName,
    version: version ?? 'latest',
    trustScore: trustResult.trustScore,
    metrics: trustResult.metrics,
    isZombie: zombie.isZombie,
    blastRadius: 0,
    alternatives,
    trend,
    typosquatRisk: typosquat.isRisky ? 1.0 : 0.0,
  };
}
