/**
 * `dep-oracle scan` command.
 *
 * Core workflow:
 *   1. Load config (cosmiconfig + CLI flags)
 *   2. Detect parser (npm or python)
 *   3. Parse manifest into DependencyTree
 *   4. For each dependency, run collectors via orchestrator
 *   5. Run analyzers (trust score, zombie, blast radius, typosquat, trend, migration)
 *   6. Build ScanResult
 *   7. Output via selected reporter
 */

import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import pLimit from 'p-limit';

import { loadConfig } from '../config.js';
import { NpmParser } from '../../parsers/npm.js';
import { PythonParser } from '../../parsers/python.js';
import { CacheManager } from '../../cache/store.js';
import { CollectorOrchestrator } from '../../collectors/orchestrator.js';
import { TrustScoreEngine } from '../../analyzers/trust-score.js';
import { ZombieDetector } from '../../analyzers/zombie-detector.js';
import { BlastRadiusCalculator } from '../../analyzers/blast-radius.js';
import { TyposquatDetector } from '../../analyzers/typosquat.js';
import { TrendPredictor } from '../../analyzers/trend-predictor.js';
import { MigrationAdvisor } from '../../analyzers/migration-advisor.js';
import type {
  DependencyTree,
  DependencyNode,
  TrustReport,
  ScanResult,
} from '../../parsers/schema.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

const EXIT_OK = 0;
const EXIT_CRITICAL = 1;
const EXIT_ZOMBIE = 2;
const EXIT_TYPOSQUAT = 3;
const EXIT_ERROR = 4;

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

export function createScanCommand(): Command {
  return new Command('scan')
    .description('Scan project dependencies for trust scores and risks')
    .option('-d, --dir <path>', 'Project directory to scan', '.')
    .option('-f, --format <format>', 'Output format: table, json, html, sarif', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .option('--offline', 'Use cached data only, no network requests')
    .option('--min-score <n>', 'Minimum trust score threshold', '50')
    .option('--no-color', 'Disable colored output')
    .option('--verbose', 'Enable verbose logging output')
    .option('--json', 'Shorthand for --format json')
    .action(async (opts) => {
      const exitCode = await runScan(opts);
      process.exit(exitCode);
    });
}

// ---------------------------------------------------------------------------
// Scan implementation
// ---------------------------------------------------------------------------

interface ScanOptions {
  dir: string;
  format: string;
  output?: string;
  offline?: boolean;
  minScore: string;
  color?: boolean;
  json?: boolean;
}

async function runScan(opts: ScanOptions): Promise<number> {
  const spinner = ora({ text: 'Loading configuration...', isSilent: !!opts.json });

  try {
    // --json overrides --format
    const format = opts.json ? 'json' : opts.format;
    const projectDir = resolve(opts.dir);
    const minScore = parseInt(opts.minScore, 10) || 50;

    // 1. Load config
    spinner.start('Loading configuration...');
    const config = await loadConfig({
      minTrustScore: minScore,
      offline: opts.offline ?? false,
    });
    spinner.succeed('Configuration loaded');

    // 2. Detect parser
    spinner.start('Detecting project type...');
    const tree = await detectAndParse(projectDir);

    if (!tree) {
      spinner.fail('No supported manifest file found (package.json, requirements.txt, pyproject.toml)');
      return EXIT_ERROR;
    }

    const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
    const ignoredSet = new Set(config.ignore);
    const nodesToScan = directNodes.filter((n) => !ignoredSet.has(n.name));

    spinner.succeed(
      `Found ${tree.totalDirect} direct + ${tree.totalTransitive} transitive dependencies in ${tree.root}`,
    );

    if (nodesToScan.length === 0) {
      console.log(chalk.yellow('No dependencies to scan (all ignored or none found).'));
      return EXIT_OK;
    }

    // 3. Initialize infrastructure
    const cache = new CacheManager();
    const orchestrator = new CollectorOrchestrator(cache, {
      offline: config.offline,
      githubToken: config.githubToken,
      concurrency: config.concurrency,
    });
    const trustEngine = new TrustScoreEngine(config.weights);
    const zombieDetector = new ZombieDetector();
    const blastCalculator = new BlastRadiusCalculator();
    const typosquatDetector = new TyposquatDetector();
    const trendPredictor = new TrendPredictor();
    const migrationAdvisor = new MigrationAdvisor();

    // 4. Process each dependency
    spinner.start(`Scanning ${nodesToScan.length} dependencies...`);
    const limit = pLimit(config.concurrency);

    const reports: TrustReport[] = await Promise.all(
      nodesToScan.map((node) =>
        limit(async () => {
          try {
            return await analyzePackage(
              node,
              projectDir,
              orchestrator,
              trustEngine,
              zombieDetector,
              blastCalculator,
              typosquatDetector,
              trendPredictor,
              migrationAdvisor,
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to analyze ${node.name}@${node.version}: ${msg}`);
            return createFallbackReport(node);
          }
        }),
      ),
    );

    // Sort reports: lowest trust score first (most risky at top)
    reports.sort((a, b) => a.trustScore - b.trustScore);

    spinner.succeed(`Scanned ${reports.length} dependencies`);

    // 5. Build ScanResult
    const overallScore = calculateOverallScore(reports);
    const summary = buildSummary(reports, overallScore, minScore);

    const scanResult: ScanResult = {
      tree,
      reports,
      overallScore,
      summary,
    };

    // 6. Output
    const output = formatOutput(scanResult, format, minScore);

    if (opts.output) {
      await writeFile(opts.output, output, 'utf-8');
      console.log(chalk.green(`Report written to ${opts.output}`));
    } else {
      console.log(output);
    }

    // 7. Determine exit code
    cache.close();
    return determineExitCode(reports, minScore);
  } catch (err) {
    spinner.fail('Scan failed');
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    console.error(chalk.red(`Error: ${message}`));
    return EXIT_ERROR;
  }
}

// ---------------------------------------------------------------------------
// Parser detection
// ---------------------------------------------------------------------------

async function detectAndParse(projectDir: string): Promise<DependencyTree | null> {
  const parsers = [new NpmParser(), new PythonParser()];

  for (const parser of parsers) {
    if (await parser.detect(projectDir)) {
      logger.info(`Detected ${parser.name} project`);
      return parser.parse(projectDir);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Per-package analysis pipeline
// ---------------------------------------------------------------------------

async function analyzePackage(
  node: DependencyNode,
  projectDir: string,
  orchestrator: CollectorOrchestrator,
  trustEngine: TrustScoreEngine,
  zombieDetector: ZombieDetector,
  blastCalculator: BlastRadiusCalculator,
  typosquatDetector: TyposquatDetector,
  trendPredictor: TrendPredictor,
  migrationAdvisor: MigrationAdvisor,
): Promise<TrustReport> {
  // Collect data from all sources
  const collected = await orchestrator.collectAll(node.name, node.version);

  // Trust score
  const trustResult = trustEngine.calculate(collected);

  // Zombie detection
  const zombieResult = zombieDetector.detect(
    collected.registry.data,
    collected.github.data,
  );

  // Blast radius
  const blastResult = await blastCalculator.calculate(node.name, projectDir);

  // Typosquat check
  const typosquatResult = typosquatDetector.check(node.name);

  // Trend prediction
  const trendResult = trendPredictor.predict(
    collected.registry.data,
    collected.popularity.data,
    collected.github.data,
  );

  // Migration suggestions (only when score is low or package is zombie)
  let alternatives: string[] = [];
  if (trustResult.trustScore < 50 || zombieResult.isZombie) {
    const reason = zombieResult.isZombie
      ? zombieResult.reason
      : `Low trust score (${trustResult.trustScore})`;
    const suggestions = migrationAdvisor.suggest(node.name, reason);
    alternatives = suggestions.map((s) => s.alternative);
  }

  // Map trend direction to the schema's DownloadTrend enum
  const trendValue = trendResult.trend === 'unknown' ? 'stable' : trendResult.trend;

  // Calculate typosquat risk as a probability value
  const typosquatRisk = typosquatResult.isRisky
    ? Math.max(0.5, 1 - typosquatResult.distance * 0.2)
    : 0;

  return {
    package: node.name,
    version: node.version,
    trustScore: trustResult.trustScore,
    metrics: trustResult.metrics,
    isZombie: zombieResult.isZombie,
    blastRadius: blastResult.affectedFiles,
    alternatives,
    trend: trendValue,
    typosquatRisk,
  };
}

// ---------------------------------------------------------------------------
// Fallback report for packages that fail analysis
// ---------------------------------------------------------------------------

function createFallbackReport(node: DependencyNode): TrustReport {
  return {
    package: node.name,
    version: node.version,
    trustScore: 0,
    metrics: {
      security: 0,
      maintainer: 0,
      activity: 0,
      popularity: 0,
      funding: 0,
      license: 0,
    },
    isZombie: false,
    blastRadius: 0,
    alternatives: [],
    trend: 'stable',
    typosquatRisk: 0,
  };
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

function calculateOverallScore(reports: TrustReport[]): number {
  if (reports.length === 0) return 100;

  const total = reports.reduce((sum, r) => sum + r.trustScore, 0);
  return Math.round(total / reports.length);
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  reports: TrustReport[],
  overallScore: number,
  minScore: number,
): string {
  const total = reports.length;
  const critical = reports.filter((r) => r.trustScore < 30).length;
  const warnings = reports.filter((r) => r.trustScore >= 30 && r.trustScore < minScore).length;
  const safe = reports.filter((r) => r.trustScore >= minScore).length;
  const zombies = reports.filter((r) => r.isZombie).length;
  const typosquats = reports.filter((r) => r.typosquatRisk > 0.5).length;

  const parts: string[] = [
    `Scanned ${total} dependencies. Overall trust score: ${overallScore}/100.`,
  ];

  if (critical > 0) {
    parts.push(`${critical} critical (score < 30).`);
  }
  if (warnings > 0) {
    parts.push(`${warnings} below threshold (score < ${minScore}).`);
  }
  if (zombies > 0) {
    parts.push(`${zombies} zombie dependencies detected.`);
  }
  if (typosquats > 0) {
    parts.push(`${typosquats} potential typosquatting risks.`);
  }
  if (safe === total) {
    parts.push('All dependencies are above the trust threshold.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function formatOutput(
  result: ScanResult,
  format: string,
  minScore: number,
): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'table':
    default:
      return formatTable(result, minScore);
  }
}

function formatJson(result: ScanResult): string {
  // Serialize the ScanResult but replace the Map with a plain object
  const serializable = {
    ...result,
    tree: {
      ...result.tree,
      nodes: Object.fromEntries(result.tree.nodes),
    },
  };
  return JSON.stringify(serializable, null, 2);
}

function formatTable(result: ScanResult, minScore: number): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold('dep-oracle scan results'));
  lines.push(chalk.dim('='.repeat(70)));
  lines.push('');

  // Overall score
  const scoreColor = result.overallScore >= 70 ? chalk.green : result.overallScore >= 50 ? chalk.yellow : chalk.red;
  lines.push(`Overall Trust Score: ${scoreColor(String(result.overallScore) + '/100')}`);
  lines.push(`Dependencies Scanned: ${result.reports.length}`);
  lines.push('');

  // Table header
  lines.push(
    chalk.dim(
      padRight('Package', 30) +
      padRight('Version', 12) +
      padRight('Score', 8) +
      padRight('Trend', 10) +
      padRight('Flags', 20),
    ),
  );
  lines.push(chalk.dim('-'.repeat(80)));

  // Rows
  for (const report of result.reports) {
    const flags: string[] = [];
    if (report.isZombie) flags.push(chalk.red('ZOMBIE'));
    if (report.typosquatRisk > 0.5) flags.push(chalk.magenta('TYPOSQUAT'));
    if (report.trustScore < 30) flags.push(chalk.red('CRITICAL'));
    else if (report.trustScore < minScore) flags.push(chalk.yellow('LOW'));

    const scoreStr = String(report.trustScore);
    const coloredScore =
      report.trustScore >= 70
        ? chalk.green(scoreStr)
        : report.trustScore >= 50
          ? chalk.yellow(scoreStr)
          : chalk.red(scoreStr);

    const trendIcon =
      report.trend === 'rising' ? chalk.green('rising') :
      report.trend === 'declining' ? chalk.red('declining') :
      chalk.dim('stable');

    lines.push(
      padRight(report.package, 30) +
      padRight(report.version, 12) +
      padRight(coloredScore, 8) +
      padRight(trendIcon, 10) +
      flags.join(' '),
    );

    // Show alternatives if available
    if (report.alternatives.length > 0) {
      lines.push(
        chalk.dim(`  -> alternatives: ${report.alternatives.join(', ')}`),
      );
    }
  }

  lines.push('');
  lines.push(chalk.dim('-'.repeat(80)));
  lines.push(result.summary);
  lines.push('');

  return lines.join('\n');
}

function padRight(str: string, width: number): string {
  // Strip ANSI codes for width calculation
  const stripped = str.replace(/\u001B\[\d+m/g, '');
  const padding = Math.max(0, width - stripped.length);
  return str + ' '.repeat(padding);
}

// ---------------------------------------------------------------------------
// Exit code determination
// ---------------------------------------------------------------------------

function determineExitCode(reports: TrustReport[], minScore: number): number {
  const hasCritical = reports.some((r) => r.trustScore < 30);
  if (hasCritical) return EXIT_CRITICAL;

  const hasTyposquat = reports.some((r) => r.typosquatRisk > 0.5);
  if (hasTyposquat) return EXIT_TYPOSQUAT;

  const hasZombie = reports.some((r) => r.isZombie);
  if (hasZombie) return EXIT_ZOMBIE;

  const belowThreshold = reports.some((r) => r.trustScore < minScore);
  if (belowThreshold) return EXIT_CRITICAL;

  return EXIT_OK;
}
