/**
 * dep-oracle CLI entry point.
 *
 * Commands:
 *   scan   - Scan project dependencies for trust scores and risks (default)
 *   check  - Check trust score for a single package
 *
 * Usage:
 *   dep-oracle scan --dir ./my-project --format json
 *   dep-oracle check express@4.18.2
 *   dep-oracle                        # defaults to `scan .`
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createScanCommand } from './commands/scan.js';
import { createCheckCommand } from './commands/check.js';
import { setVerbose } from '../utils/logger.js';

// Read version from package.json so it's always in sync
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkgVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version as string;
  } catch {
    return '1.1.1';
  }
})();

const program = new Command()
  .name('dep-oracle')
  .description('Predictive dependency security engine')
  .version(pkgVersion)
  .option('--verbose', 'Enable verbose logging output')
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Check for --verbose on the root or the subcommand
    const rootVerbose = program.opts().verbose;
    const subVerbose = actionCommand?.opts?.()?.verbose;
    if (rootVerbose || subVerbose) {
      setVerbose(true);
    }
  });

program.addCommand(createScanCommand());
program.addCommand(createCheckCommand());

// Default to scan if no command is specified
program.action(async (_opts, _cmd) => {
  // Re-parse with the scan subcommand when invoked without a command name.
  // This allows `dep-oracle --format json` to behave like `dep-oracle scan --format json`.
  const args = process.argv.slice(2);
  await program.commands[0].parseAsync(args, { from: 'user' });
});

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(4);
});
