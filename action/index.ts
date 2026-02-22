/**
 * GitHub Action entry point for dep-oracle.
 *
 * Reads inputs from environment variables (GitHub Actions convention),
 * runs a full dependency scan using the core engine, and outputs results
 * in the requested format. Exits with code 1 if any package falls below
 * the minimum trust score threshold.
 *
 * Environment variables set by GitHub Actions:
 *   INPUT_MIN_SCORE    - Minimum trust score threshold (default: 50)
 *   INPUT_FORMAT       - Output format: table, json, sarif (default: table)
 *   INPUT_GITHUB_TOKEN - GitHub token for higher API rate limits
 *   GITHUB_WORKSPACE   - Path to the checked-out repository
 *   GITHUB_OUTPUT      - Path to the file for setting action outputs
 *   GITHUB_STEP_SUMMARY - Path to the file for job summary markdown
 */

import { resolve } from 'node:path';
import { appendFile } from 'node:fs/promises';

import { CacheManager } from '../src/cache/store.js';
import { NpmParser } from '../src/parsers/npm.js';
import { PythonParser } from '../src/parsers/python.js';
import type { DependencyTree, TrustReport, ScanResult } from '../src/parsers/schema.js';
import { CollectorOrchestrator } from '../src/collectors/orchestrator.js';
import { TrustScoreEngine } from '../src/analyzers/trust-score.js';
import { ZombieDetector } from '../src/analyzers/zombie-detector.js';
import { MigrationAdvisor } from '../src/analyzers/migration-advisor.js';
import { TyposquatDetector } from '../src/analyzers/typosquat.js';
import { buildImportGraph, getBlastRadius } from '../src/utils/graph.js';
import { JsonReporter } from '../src/reporters/json.js';

// ---------------------------------------------------------------------------
// Configuration from GitHub Action inputs
// ---------------------------------------------------------------------------

process.env.GITHUB_TOKEN =
  process.env.INPUT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '';

const minScore = parseInt(process.env.INPUT_MIN_SCORE ?? '50', 10);
const format = (process.env.INPUT_FORMAT ?? 'table').toLowerCase();
const workspaceDir = resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());

// ---------------------------------------------------------------------------
// Core engine instances
// ---------------------------------------------------------------------------

const cache = new CacheManager();
const orchestrator = new CollectorOrchestrator(cache, {
  githubToken: process.env.GITHUB_TOKEN,
});
const trustEngine = new TrustScoreEngine();
const zombieDetector = new ZombieDetector();
const migrationAdvisor = new MigrationAdvisor();
const typosquatDetector = new TyposquatDetector();
const jsonReporter = new JsonReporter();
const parsers = [new NpmParser(), new PythonParser()];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseProject(dir: string): Promise<DependencyTree | null> {
  for (const parser of parsers) {
    if (await parser.detect(dir)) {
      return parser.parse(dir);
    }
  }
  return null;
}

async function buildTrustReport(
  packageName: string,
  version: string,
  blastRadius: number = 0,
): Promise<TrustReport> {
  const results = await orchestrator.collectAll(packageName, version);
  const trustResult = trustEngine.calculate(results);
  const zombie = zombieDetector.detect(
    results.registry.data,
    results.github.data,
  );
  const typosquat = typosquatDetector.check(packageName);
  const alternatives = migrationAdvisor.suggest(
    packageName,
    zombie.isZombie ? 'zombie dependency' : 'low trust score',
  );
  const trend = results.popularity.data?.trend ?? 'stable';

  return {
    package: packageName,
    version,
    trustScore: trustResult.trustScore,
    metrics: trustResult.metrics,
    isZombie: zombie.isZombie,
    blastRadius,
    alternatives: alternatives.map((a) => a.alternative),
    trend,
    typosquatRisk: typosquat.isRisky ? 1.0 : 0.0,
  };
}

/** Set a GitHub Actions output variable. */
async function setOutput(name: string, value: string): Promise<void> {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    await appendFile(outputFile, `${name}=${value}\n`, 'utf-8');
  }
}

/** Append content to the GitHub Actions job summary. */
async function addSummary(markdown: string): Promise<void> {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    await appendFile(summaryFile, markdown + '\n', 'utf-8');
  }
}

function formatTable(reports: TrustReport[], overallScore: number): string {
  const lines: string[] = [];

  lines.push('dep-oracle -- Dependency Trust Report');
  lines.push('='.repeat(60));
  lines.push(`Overall Trust Score: ${overallScore}/100`);
  lines.push('');
  lines.push(
    'Package'.padEnd(30) +
    'Score'.padEnd(8) +
    'Zombie'.padEnd(8) +
    'Blast'.padEnd(8) +
    'Trend',
  );
  lines.push('-'.repeat(62));

  const sorted = [...reports].sort((a, b) => a.trustScore - b.trustScore);

  for (const r of sorted) {
    lines.push(
      r.package.padEnd(30) +
      String(r.trustScore).padEnd(8) +
      (r.isZombie ? 'Yes' : 'No').padEnd(8) +
      String(r.blastRadius).padEnd(8) +
      r.trend,
    );
  }

  return lines.join('\n');
}

function formatMarkdownSummary(
  reports: TrustReport[],
  overallScore: number,
): string {
  const lines: string[] = [];

  const statusEmoji = overallScore >= 80 ? 'white_check_mark' : overallScore >= 50 ? 'warning' : 'x';
  lines.push(`## dep-oracle Dependency Report :${statusEmoji}:`);
  lines.push('');
  lines.push(`**Overall Trust Score:** ${overallScore}/100`);
  lines.push('');

  const zombieCount = reports.filter((r) => r.isZombie).length;
  const criticalCount = reports.filter((r) => r.trustScore < 50).length;
  const typosquatCount = reports.filter((r) => r.typosquatRisk > 0.5).length;

  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total scanned | ${reports.length} |`);
  lines.push(`| Critical (score < 50) | ${criticalCount} |`);
  lines.push(`| Zombie dependencies | ${zombieCount} |`);
  lines.push(`| Typosquat risks | ${typosquatCount} |`);
  lines.push('');

  // Package table
  lines.push('| Package | Score | Zombie | Blast Radius | Trend |');
  lines.push('|---------|-------|--------|--------------|-------|');

  const sorted = [...reports].sort((a, b) => a.trustScore - b.trustScore);
  for (const r of sorted) {
    const scoreIcon = r.trustScore >= 80 ? ':green_circle:' : r.trustScore >= 50 ? ':yellow_circle:' : ':red_circle:';
    lines.push(
      `| ${r.package} | ${scoreIcon} ${r.trustScore} | ${r.isZombie ? ':skull:' : ':heavy_check_mark:'} | ${r.blastRadius} files | ${r.trend} |`,
    );
  }

  // Migration suggestions
  const withAlternatives = reports.filter(
    (r) => r.trustScore < 50 && r.alternatives.length > 0,
  );
  if (withAlternatives.length > 0) {
    lines.push('');
    lines.push('### Migration Suggestions');
    lines.push('');
    for (const r of withAlternatives) {
      lines.push(`- **${r.package}** -> consider: ${r.alternatives.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by [dep-oracle](https://github.com/ertugrulakben/dep-oracle)*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`dep-oracle: scanning ${workspaceDir}`);
  console.log(`  min-score: ${minScore}, format: ${format}`);

  // Parse project
  const tree = await parseProject(workspaceDir);
  if (!tree) {
    console.error(
      'dep-oracle: No supported manifest file found in the workspace. ' +
      'Supported: package.json, requirements.txt, pyproject.toml, Pipfile.',
    );
    process.exit(1);
  }

  // Build import graph for blast radius
  const importGraph = await buildImportGraph(workspaceDir);

  // Collect trust reports
  const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
  console.log(`dep-oracle: analyzing ${directNodes.length} direct dependencies...`);

  const reports: TrustReport[] = [];
  for (const node of directNodes) {
    const blastRadius = getBlastRadius(node.name, importGraph);
    const report = await buildTrustReport(node.name, node.version, blastRadius);
    reports.push(report);
  }

  // Overall score
  const overallScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, r) => sum + r.trustScore, 0) / reports.length,
        )
      : 100;

  // Output in requested format
  if (format === 'json' || format === 'sarif') {
    const zombieCount = reports.filter((r) => r.isZombie).length;
    const criticalCount = reports.filter((r) => r.trustScore < 50).length;
    const scanResult: ScanResult = {
      tree,
      reports,
      overallScore,
      summary:
        `Scanned ${reports.length} direct dependencies. ` +
        `Overall trust score: ${overallScore}/100. ` +
        `${zombieCount} zombie(s) detected. ` +
        `${criticalCount} package(s) below trust threshold.`,
    };
    console.log(jsonReporter.report(scanResult));
  } else {
    console.log(formatTable(reports, overallScore));
  }

  // Set GitHub Actions outputs
  await setOutput('overall-score', String(overallScore));
  await setOutput('package-count', String(reports.length));
  await setOutput(
    'zombie-count',
    String(reports.filter((r) => r.isZombie).length),
  );
  await setOutput(
    'critical-count',
    String(reports.filter((r) => r.trustScore < minScore).length),
  );

  // Write job summary
  await addSummary(formatMarkdownSummary(reports, overallScore));

  // Determine exit code
  const failedPackages = reports.filter((r) => r.trustScore < minScore);
  if (failedPackages.length > 0) {
    console.error('');
    console.error(
      `dep-oracle: ${failedPackages.length} package(s) below minimum trust score of ${minScore}:`,
    );
    for (const pkg of failedPackages) {
      console.error(`  - ${pkg.package} (score: ${pkg.trustScore})`);
    }
    process.exit(1);
  }

  console.log('');
  console.log(
    `dep-oracle: All ${reports.length} packages meet the minimum trust score of ${minScore}. Passed.`,
  );
}

main().catch((err) => {
  console.error('dep-oracle: Unexpected error:', err);
  process.exit(1);
});
