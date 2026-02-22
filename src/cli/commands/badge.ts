/**
 * `dep-oracle badge` command.
 *
 * Generates a shields.io-style SVG trust score badge for a project
 * or a single package. The badge can be embedded in README files.
 */

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import chalk from 'chalk';

export function createBadgeCommand(): Command {
  return new Command('badge')
    .description('Generate an SVG trust score badge')
    .option('-d, --dir <path>', 'Project directory to scan', '.')
    .option('-o, --output <file>', 'Output file path', 'dep-oracle-badge.svg')
    .option('-p, --package <name>', 'Generate badge for a single package')
    .option('--ecosystem <type>', 'Package ecosystem: npm or pypi', 'npm')
    .option('--offline', 'Use cached data only')
    .action(async (opts) => {
      const { CacheManager } = await import('../../cache/store.js');
      const { CollectorOrchestrator } = await import('../../collectors/orchestrator.js');
      const { TrustScoreEngine } = await import('../../analyzers/trust-score.js');
      const { BadgeReporter } = await import('../../reporters/badge.js');

      const cache = new CacheManager();
      const orchestrator = new CollectorOrchestrator(cache, {
        offline: opts.offline,
      });
      const scorer = new TrustScoreEngine();

      let score: number;
      const ecosystem = opts.ecosystem === 'pypi' ? 'pypi' as const : 'npm' as const;

      if (opts.package) {
        // Single package mode
        const data = await orchestrator.collectAll(opts.package, 'latest', ecosystem);
        const result = scorer.calculate(data);
        score = result.trustScore;
        console.log(chalk.cyan(`Trust score for ${opts.package}: ${score}/100`));
      } else {
        // Project scan mode - get overall score
        const { NpmParser } = await import('../../parsers/npm.js');
        const { PythonParser } = await import('../../parsers/python.js');

        const dir = resolve(opts.dir);
        const npmParser = new NpmParser();
        const pythonParser = new PythonParser();

        let tree;
        if (await npmParser.detect(dir)) {
          tree = await npmParser.parse(dir);
        } else if (await pythonParser.detect(dir)) {
          tree = await pythonParser.parse(dir);
        } else {
          console.error(chalk.red('No supported package manager found'));
          process.exit(1);
        }

        // Calculate average score from direct dependencies
        const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
        const scores: number[] = [];

        for (const node of directNodes) {
          try {
            const nodeEcosystem = node.registry === 'pypi' ? 'pypi' as const : 'npm' as const;
            const data = await orchestrator.collectAll(node.name, node.version, nodeEcosystem);
            const result = scorer.calculate(data);
            scores.push(result.trustScore);
          } catch {
            /* skip packages that fail */
          }
        }

        score = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        console.log(chalk.cyan(`Overall trust score: ${score}/100`));
      }

      const badge = new BadgeReporter();
      const svg = badge.generate(score);
      const outputPath = resolve(opts.output);
      await writeFile(outputPath, svg, 'utf-8');
      console.log(chalk.green(`Badge saved to ${outputPath}`));

      cache.close();
    });
}
