/**
 * `dep-oracle compare <packageA> <packageB>` command.
 *
 * Compare two packages side-by-side with trust scores, metrics,
 * zombie status, and trend direction.
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

export function createCompareCommand(): Command {
  return new Command('compare')
    .description('Compare two packages side-by-side')
    .argument('<packageA>', 'First package name')
    .argument('<packageB>', 'Second package name')
    .option('--ecosystem <type>', 'Package ecosystem: npm or pypi', 'npm')
    .option('--offline', 'Use cached data only')
    .option('--verbose', 'Enable verbose logging output')
    .option('--json', 'Output as JSON')
    .action(async (packageA: string, packageB: string, opts: CompareOptions) => {
      const exitCode = await runCompare(packageA, packageB, opts);
      process.exit(exitCode);
    });
}

// ---------------------------------------------------------------------------
// Compare implementation
// ---------------------------------------------------------------------------

interface CompareOptions {
  ecosystem?: 'npm' | 'pypi';
  offline?: boolean;
  json?: boolean;
}

interface PackageReport {
  name: string;
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
  alternatives: string[];
}

async function runCompare(
  packageA: string,
  packageB: string,
  opts: CompareOptions,
): Promise<number> {
  const spinner = ora({ text: 'Loading configuration...', isSilent: !!opts.json });

  try {
    spinner.start(`Comparing ${packageA} vs ${packageB}...`);

    const config = await loadConfig({
      offline: opts.offline ?? false,
    });

    const cache = new CacheManager();
    const orchestrator = new CollectorOrchestrator(cache, {
      offline: config.offline,
      githubToken: config.githubToken,
      concurrency: config.concurrency,
    });
    const trustEngine = new TrustScoreEngine(config.weights);
    const zombieDetector = new ZombieDetector();
    const trendPredictor = new TrendPredictor();
    const migrationAdvisor = new MigrationAdvisor();

    const ecosystem = opts.ecosystem ?? 'npm';

    // Analyze both packages in parallel
    const [reportA, reportB] = await Promise.all([
      analyzeOne(packageA, ecosystem, orchestrator, trustEngine, zombieDetector, trendPredictor, migrationAdvisor),
      analyzeOne(packageB, ecosystem, orchestrator, trustEngine, zombieDetector, trendPredictor, migrationAdvisor),
    ]);

    spinner.stop();
    cache.close();

    if (opts.json) {
      const winner =
        reportA.trustScore > reportB.trustScore ? packageA :
        reportA.trustScore < reportB.trustScore ? packageB : 'tie';

      console.log(JSON.stringify({
        comparison: { packageA: reportA, packageB: reportB, winner, scoreDifference: Math.abs(reportA.trustScore - reportB.trustScore) },
      }, null, 2));
    } else {
      printComparison(reportA, reportB);
    }

    return 0;
  } catch (err) {
    spinner.fail('Comparison failed');
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    console.error(chalk.red(`Error: ${message}`));
    return 4;
  }
}

// ---------------------------------------------------------------------------
// Analyze a single package
// ---------------------------------------------------------------------------

async function analyzeOne(
  name: string,
  ecosystem: 'npm' | 'pypi',
  orchestrator: CollectorOrchestrator,
  trustEngine: TrustScoreEngine,
  zombieDetector: ZombieDetector,
  trendPredictor: TrendPredictor,
  migrationAdvisor: MigrationAdvisor,
): Promise<PackageReport> {
  const collected = await orchestrator.collectAll(name, 'latest', ecosystem);
  const trustResult = trustEngine.calculate(collected);
  const zombieResult = zombieDetector.detect(collected.registry.data, collected.github.data);
  const trendResult = trendPredictor.predict(collected.registry.data, collected.popularity.data, collected.github.data);

  let alternatives: string[] = [];
  if (trustResult.trustScore < 50 || zombieResult.isZombie) {
    const suggestions = migrationAdvisor.suggest(name, 'comparison query');
    alternatives = suggestions.map((s) => s.alternative);
  }

  return {
    name,
    version: 'latest',
    trustScore: trustResult.trustScore,
    metrics: trustResult.metrics,
    isZombie: zombieResult.isZombie,
    zombieReason: zombieResult.reason,
    trend: trendResult.trend === 'unknown' ? 'stable' : trendResult.trend,
    alternatives,
  };
}

// ---------------------------------------------------------------------------
// Terminal comparison printer
// ---------------------------------------------------------------------------

function printComparison(a: PackageReport, b: PackageReport): void {
  const winner =
    a.trustScore > b.trustScore ? a.name :
    a.trustScore < b.trustScore ? b.name : null;

  console.log('');
  console.log(chalk.bold('dep-oracle compare'));
  console.log(chalk.dim('='.repeat(60)));
  console.log('');

  // Header
  console.log(
    padRight('', 16) +
    padRight(chalk.bold(a.name), 22) +
    padRight(chalk.bold(b.name), 22),
  );
  console.log(chalk.dim('-'.repeat(60)));

  // Trust Score
  const aColor = scoreColor(a.trustScore);
  const bColor = scoreColor(b.trustScore);
  printRow('Trust Score', aColor(String(a.trustScore)), bColor(String(b.trustScore)));

  // Metrics
  const metricNames: Array<[string, keyof PackageReport['metrics']]> = [
    ['Security', 'security'],
    ['Maintainer', 'maintainer'],
    ['Activity', 'activity'],
    ['Popularity', 'popularity'],
    ['Funding', 'funding'],
    ['License', 'license'],
  ];

  for (const [label, key] of metricNames) {
    const aVal = a.metrics[key];
    const bVal = b.metrics[key];
    printRow(label, colorMetric(aVal), colorMetric(bVal));
  }

  // Zombie
  printRow(
    'Zombie',
    a.isZombie ? chalk.red('YES') : chalk.green('No'),
    b.isZombie ? chalk.red('YES') : chalk.green('No'),
  );

  // Trend
  printRow(
    'Trend',
    trendColor(a.trend),
    trendColor(b.trend),
  );

  console.log(chalk.dim('-'.repeat(60)));

  // Winner
  if (winner) {
    console.log('');
    console.log(chalk.green.bold(`  Winner: ${winner}`) + chalk.dim(` (+${Math.abs(a.trustScore - b.trustScore)} points)`));
  } else {
    console.log('');
    console.log(chalk.yellow.bold('  Result: Tie'));
  }

  // Alternatives
  if (a.alternatives.length > 0) {
    console.log(chalk.dim(`\n  ${a.name} alternatives: ${a.alternatives.join(', ')}`));
  }
  if (b.alternatives.length > 0) {
    console.log(chalk.dim(`  ${b.name} alternatives: ${b.alternatives.join(', ')}`));
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printRow(label: string, valA: string, valB: string): void {
  console.log(
    padRight(chalk.dim(label), 16) +
    padRight(valA, 22) +
    padRight(valB, 22),
  );
}

function scoreColor(score: number): (s: string) => string {
  return score >= 70 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
}

function colorMetric(val: number): string {
  const color = val >= 70 ? chalk.green : val >= 50 ? chalk.yellow : chalk.red;
  return color(String(val));
}

function trendColor(trend: string): string {
  return trend === 'rising' ? chalk.green('rising') :
    trend === 'declining' ? chalk.red('declining') :
    chalk.dim('stable');
}

function padRight(str: string, width: number): string {
  const stripped = str.replace(/\u001B\[\d+m/g, '');
  const padding = Math.max(0, width - stripped.length);
  return str + ' '.repeat(padding);
}
