/**
 * `dep-oracle fix` command.
 *
 * Scans project dependencies, identifies risky packages that have
 * known safer alternatives, and optionally replaces them.
 *
 * Usage:
 *   dep-oracle fix                    # Show fixable packages (dry run)
 *   dep-oracle fix --apply            # Actually install replacements
 *   dep-oracle fix --apply --yes      # Skip confirmation
 */

import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
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
import { TyposquatDetector } from '../../analyzers/typosquat.js';
import { TrendPredictor } from '../../analyzers/trend-predictor.js';
import { MigrationAdvisor, type MigrationSuggestion } from '../../analyzers/migration-advisor.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

export function createFixCommand(): Command {
  return new Command('fix')
    .description('Identify risky dependencies and suggest safer replacements')
    .option('-d, --dir <path>', 'Project directory to scan', '.')
    .option('--apply', 'Actually install replacement packages')
    .option('--yes', 'Skip confirmation when using --apply')
    .option('--min-score <n>', 'Show fixes for packages below this score', '60')
    .option('--offline', 'Use cached data only')
    .option('--verbose', 'Enable verbose logging output')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const exitCode = await runFix(opts);
      process.exit(exitCode);
    });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixOptions {
  dir: string;
  apply?: boolean;
  yes?: boolean;
  minScore: string;
  offline?: boolean;
  json?: boolean;
}

interface FixablePackage {
  name: string;
  version: string;
  trustScore: number;
  isZombie: boolean;
  reason: string;
  suggestions: MigrationSuggestion[];
}

// ---------------------------------------------------------------------------
// Fix implementation
// ---------------------------------------------------------------------------

async function runFix(opts: FixOptions): Promise<number> {
  const spinner = ora({ text: 'Loading configuration...', isSilent: !!opts.json });

  try {
    const projectDir = resolve(opts.dir);
    const minScore = parseInt(opts.minScore, 10) || 60;

    // 1. Load config
    spinner.start('Loading configuration...');
    const config = await loadConfig({
      offline: opts.offline ?? false,
    });
    spinner.succeed('Configuration loaded');

    // 2. Detect and parse
    spinner.start('Detecting project type...');
    const parsers = [new NpmParser(), new PythonParser()];
    let tree = null;
    for (const parser of parsers) {
      if (await parser.detect(projectDir)) {
        tree = await parser.parse(projectDir);
        break;
      }
    }

    if (!tree) {
      spinner.fail('No supported manifest file found');
      return 4;
    }

    const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
    const ignoredSet = new Set(config.ignore);
    const nodesToScan = directNodes.filter((n) => !ignoredSet.has(n.name));

    spinner.succeed(`Found ${nodesToScan.length} direct dependencies`);

    // 3. Initialize infrastructure
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

    // 4. Scan and find fixable packages
    spinner.start(`Scanning ${nodesToScan.length} dependencies for fixable issues...`);
    const limit = pLimit(config.concurrency);

    const fixable: FixablePackage[] = [];

    await Promise.all(
      nodesToScan.map((node) =>
        limit(async () => {
          try {
            const collected = await orchestrator.collectAll(node.name, node.version, node.registry);
            const trustResult = trustEngine.calculate(collected);
            const zombieResult = zombieDetector.detect(collected.registry.data, collected.github.data);

            // Check if package needs fixing
            const needsFix = trustResult.trustScore < minScore || zombieResult.isZombie;
            if (!needsFix) return;

            // Get migration suggestions
            const reason = zombieResult.isZombie
              ? zombieResult.reason
              : `Low trust score (${trustResult.trustScore}/${minScore})`;
            const suggestions = migrationAdvisor.suggest(node.name, reason);

            if (suggestions.length > 0) {
              fixable.push({
                name: node.name,
                version: node.version,
                trustScore: trustResult.trustScore,
                isZombie: zombieResult.isZombie,
                reason,
                suggestions,
              });
            }
          } catch (err) {
            logger.error(`Failed to analyze ${node.name}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }),
      ),
    );

    spinner.succeed(`Scan complete`);
    cache.close();

    // Sort by trust score ascending (worst first)
    fixable.sort((a, b) => a.trustScore - b.trustScore);

    // 5. Output results
    if (fixable.length === 0) {
      if (opts.json) {
        console.log(JSON.stringify({ fixable: [], message: 'No fixable packages found. All dependencies are healthy.' }, null, 2));
      } else {
        console.log('');
        console.log(chalk.green('  All dependencies are healthy. Nothing to fix.'));
        console.log('');
      }
      return 0;
    }

    if (opts.json) {
      console.log(JSON.stringify({ fixable, total: fixable.length }, null, 2));
      return 0;
    }

    // Terminal output
    console.log('');
    console.log(chalk.bold(`dep-oracle fix — ${fixable.length} package(s) can be improved`));
    console.log(chalk.dim('='.repeat(70)));
    console.log('');

    for (const pkg of fixable) {
      const scoreStr = scoreColor(pkg.trustScore)(String(pkg.trustScore));
      const flags: string[] = [];
      if (pkg.isZombie) flags.push(chalk.red('ZOMBIE'));
      if (pkg.trustScore < 30) flags.push(chalk.red('CRITICAL'));

      console.log(`  ${chalk.bold(pkg.name)}@${pkg.version}  score: ${scoreStr}  ${flags.join(' ')}`);
      console.log(chalk.dim(`    ${pkg.reason}`));

      for (const suggestion of pkg.suggestions) {
        const diffBadge =
          suggestion.difficulty === 'easy' ? chalk.green('[easy]') :
          suggestion.difficulty === 'moderate' ? chalk.yellow('[moderate]') :
          chalk.red('[hard]');

        console.log(`    -> ${chalk.cyan(suggestion.alternative)} ${diffBadge}`);
        console.log(chalk.dim(`       ${suggestion.description}`));
      }
      console.log('');
    }

    // 6. Apply fixes if requested
    if (opts.apply) {
      const easyFixes = fixable
        .flatMap((pkg) =>
          pkg.suggestions
            .filter((s) => s.difficulty === 'easy')
            .map((s) => ({ from: pkg.name, to: s.alternative })),
        );

      if (easyFixes.length === 0) {
        console.log(chalk.yellow('  No easy (drop-in) replacements available. Manual migration needed.'));
        console.log('');
        return 0;
      }

      console.log(chalk.bold(`  Applying ${easyFixes.length} easy replacement(s):`));
      console.log('');

      for (const fix of easyFixes) {
        console.log(`    ${chalk.red(fix.from)} -> ${chalk.green(fix.to)}`);
      }
      console.log('');

      if (!opts.yes) {
        console.log(chalk.yellow('  Run with --yes to skip this confirmation.'));
        console.log(chalk.dim('  Or run the commands manually:'));
        console.log('');
        for (const fix of easyFixes) {
          console.log(chalk.dim(`    npm uninstall ${fix.from} && npm install ${fix.to}`));
        }
        console.log('');
        return 0;
      }

      // Actually apply
      for (const fix of easyFixes) {
        try {
          console.log(chalk.dim(`    npm uninstall ${fix.from} && npm install ${fix.to}`));
          execSync(`npm uninstall ${fix.from} && npm install ${fix.to}`, {
            cwd: projectDir,
            stdio: 'pipe',
          });
          console.log(chalk.green(`    Done: ${fix.from} -> ${fix.to}`));
        } catch (err) {
          console.log(chalk.red(`    Failed: ${fix.from} -> ${fix.to}`));
          logger.error(err instanceof Error ? err.message : String(err));
        }
      }
      console.log('');
    } else {
      console.log(chalk.dim('  Run "dep-oracle fix --apply" to install replacements.'));
      console.log(chalk.dim('  Only "easy" (drop-in) replacements are auto-applied.'));
      console.log('');
    }

    return 0;
  } catch (err) {
    spinner.fail('Fix failed');
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message);
    console.error(chalk.red(`Error: ${message}`));
    return 4;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): (s: string) => string {
  return score >= 70 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
}
