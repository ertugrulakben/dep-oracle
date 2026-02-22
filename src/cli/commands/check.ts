/**
 * `dep-oracle check <package>` command.
 *
 * Check the trust score of a single package without scanning the whole project.
 * Supports the `package@version` syntax.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { loadConfig } from '../config.js';
import { CacheManager } from '../../cache/store.js';
import { CollectorOrchestrator } from '../../collectors/orchestrator.js';
import { TrustScoreEngine } from '../../analyzers/trust-score.js';
import { ZombieDetector } from '../../analyzers/zombie-detector.js';
import { TyposquatDetector } from '../../analyzers/typosquat.js';
import { TrendPredictor } from '../../analyzers/trend-predictor.js';
import { MigrationAdvisor } from '../../analyzers/migration-advisor.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

export function createCheckCommand(): Command {
  return new Command('check')
    .description('Check trust score for a single package')
    .argument('<package>', 'Package name (e.g. express, lodash@4.17.21)')
    .option('--offline', 'Use cached data only')
    .option('--verbose', 'Enable verbose logging output')
    .option('--json', 'Output as JSON')
    .action(async (packageArg: string, opts: CheckOptions) => {
      const exitCode = await runCheck(packageArg, opts);
      process.exit(exitCode);
    });
}

// ---------------------------------------------------------------------------
// Check implementation
// ---------------------------------------------------------------------------

interface CheckOptions {
  offline?: boolean;
  json?: boolean;
}

async function runCheck(packageArg: string, opts: CheckOptions): Promise<number> {
  const spinner = ora({ text: 'Loading configuration...', isSilent: !!opts.json });

  try {
    // Parse package@version
    const { name, version } = parsePackageArg(packageArg);

    spinner.start(`Checking ${name}@${version}...`);

    // Load config
    const config = await loadConfig({
      offline: opts.offline ?? false,
    });

    // Initialize infrastructure
    const cache = new CacheManager();
    const orchestrator = new CollectorOrchestrator(cache, {
      offline: config.offline,
      githubToken: config.githubToken,
      concurrency: config.concurrency,
    });
    const trustEngine = new TrustScoreEngine(config.weights);
    const zombieDetector = new ZombieDetector();
    const typosquatDetector = new TyposquatDetector();
    const trendPredictor = new TrendPredictor();
    const migrationAdvisor = new MigrationAdvisor();

    // Collect data
    const collected = await orchestrator.collectAll(name, version);

    // Analyze
    const trustResult = trustEngine.calculate(collected);

    const zombieResult = zombieDetector.detect(
      collected.registry.data,
      collected.github.data,
    );

    const typosquatResult = typosquatDetector.check(name);

    const trendResult = trendPredictor.predict(
      collected.registry.data,
      collected.popularity.data,
      collected.github.data,
    );

    // Migration suggestions
    let alternatives: string[] = [];
    if (trustResult.trustScore < 50 || zombieResult.isZombie) {
      const reason = zombieResult.isZombie
        ? zombieResult.reason
        : `Low trust score (${trustResult.trustScore})`;
      const suggestions = migrationAdvisor.suggest(name, reason);
      alternatives = suggestions.map((s) => s.alternative);
    }

    spinner.stop();
    cache.close();

    // Build report object
    const trendValue = trendResult.trend === 'unknown' ? 'stable' : trendResult.trend;
    const typosquatRisk = typosquatResult.isRisky
      ? Math.max(0.5, 1 - typosquatResult.distance * 0.2)
      : 0;

    const report = {
      package: name,
      version,
      trustScore: trustResult.trustScore,
      metrics: trustResult.metrics,
      isZombie: zombieResult.isZombie,
      zombieReason: zombieResult.reason,
      trend: trendValue,
      trendConfidence: trendResult.confidence,
      trendReason: trendResult.reason,
      typosquatRisk,
      typosquatSimilarTo: typosquatResult.similarPackages,
      alternatives,
      insufficientData: trustResult.insufficientData,
      unavailableMetrics: trustResult.unavailableMetrics,
    };

    // Output
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printCheckReport(report);
    }

    // Exit code based on trust score
    if (trustResult.trustScore < 30) return 1;
    if (typosquatResult.isRisky) return 3;
    if (zombieResult.isZombie) return 2;
    return 0;
  } catch (err) {
    spinner.fail('Check failed');
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    console.error(chalk.red(`Error: ${message}`));
    return 4;
  }
}

// ---------------------------------------------------------------------------
// Package argument parser
// ---------------------------------------------------------------------------

function parsePackageArg(arg: string): { name: string; version: string } {
  // Handle scoped packages: @scope/name@version
  if (arg.startsWith('@')) {
    const slashIdx = arg.indexOf('/');
    if (slashIdx === -1) {
      return { name: arg, version: 'latest' };
    }
    const afterScope = arg.slice(slashIdx + 1);
    const atIdx = afterScope.lastIndexOf('@');
    if (atIdx > 0) {
      const name = arg.slice(0, slashIdx + 1 + atIdx);
      const version = afterScope.slice(atIdx + 1);
      return { name, version };
    }
    return { name: arg, version: 'latest' };
  }

  // Regular packages: name@version
  const atIdx = arg.lastIndexOf('@');
  if (atIdx > 0) {
    return {
      name: arg.slice(0, atIdx),
      version: arg.slice(atIdx + 1),
    };
  }

  return { name: arg, version: 'latest' };
}

// ---------------------------------------------------------------------------
// Terminal report printer
// ---------------------------------------------------------------------------

interface CheckReport {
  package: string;
  version: string;
  trustScore: number;
  metrics: {
    security: number;
    maintainer: number;
    activity: number;
    popularity: number;
    funding: number;
    license: number;
  };
  isZombie: boolean;
  zombieReason: string;
  trend: string;
  trendConfidence: number;
  trendReason: string;
  typosquatRisk: number;
  typosquatSimilarTo: string[];
  alternatives: string[];
  insufficientData: boolean;
  unavailableMetrics: string[];
}

function printCheckReport(report: CheckReport): void {
  const scoreColor =
    report.trustScore >= 70 ? chalk.green :
    report.trustScore >= 50 ? chalk.yellow :
    chalk.red;

  console.log('');
  console.log(chalk.bold(`${report.package}@${report.version}`));
  console.log(chalk.dim('='.repeat(50)));
  console.log('');

  // Trust Score
  console.log(`  Trust Score:  ${scoreColor(String(report.trustScore) + '/100')}`);
  console.log('');

  // Metrics breakdown
  console.log(chalk.bold('  Metrics:'));
  const metricEntries: Array<[string, number]> = [
    ['Security', report.metrics.security],
    ['Maintainer', report.metrics.maintainer],
    ['Activity', report.metrics.activity],
    ['Popularity', report.metrics.popularity],
    ['Funding', report.metrics.funding],
    ['License', report.metrics.license],
  ];

  for (const [label, score] of metricEntries) {
    const unavailable = report.unavailableMetrics.includes(label.toLowerCase());
    const bar = buildScoreBar(score, unavailable);
    console.log(`    ${padLabel(label, 12)} ${bar}  ${unavailable ? chalk.dim('N/A') : score}`);
  }

  console.log('');

  // Flags
  if (report.isZombie) {
    console.log(chalk.red(`  ZOMBIE: ${report.zombieReason}`));
  }

  if (report.typosquatRisk > 0.5) {
    console.log(
      chalk.magenta(`  TYPOSQUAT RISK: Similar to ${report.typosquatSimilarTo.join(', ')}`),
    );
  }

  // Trend
  const trendIcon =
    report.trend === 'rising' ? chalk.green('rising') :
    report.trend === 'declining' ? chalk.red('declining') :
    chalk.dim('stable');
  console.log(`  Trend: ${trendIcon} (confidence: ${Math.round(report.trendConfidence * 100)}%)`);
  if (report.trendReason) {
    console.log(chalk.dim(`    ${report.trendReason}`));
  }

  // Alternatives
  if (report.alternatives.length > 0) {
    console.log('');
    console.log(chalk.bold('  Suggested alternatives:'));
    for (const alt of report.alternatives) {
      console.log(`    - ${alt}`);
    }
  }

  // Insufficient data warning
  if (report.insufficientData) {
    console.log('');
    console.log(
      chalk.yellow(`  Warning: Insufficient data for ${report.unavailableMetrics.join(', ')}. Score may be unreliable.`),
    );
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildScoreBar(score: number, unavailable: boolean): string {
  const width = 20;
  if (unavailable) {
    return chalk.dim('[' + '?'.repeat(width) + ']');
  }

  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 70 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
  return '[' + color('#'.repeat(filled)) + chalk.dim('.'.repeat(empty)) + ']';
}

function padLabel(label: string, width: number): string {
  return label + ' '.repeat(Math.max(0, width - label.length));
}
