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
