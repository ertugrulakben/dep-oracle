/**
 * Configuration loader for dep-oracle.
 *
 * Uses cosmiconfig to search for configuration in:
 *   - package.json "dep-oracle" field
 *   - .dep-oraclerc / .dep-oraclerc.json / .dep-oraclerc.yaml / .dep-oraclerc.yml
 *   - dep-oracle.config.js / dep-oracle.config.cjs / dep-oracle.config.mjs
 *
 * Merge order: defaults < file config < environment variables < CLI overrides.
 */

import { cosmiconfig } from 'cosmiconfig';
import { ConfigSchema, type Config } from '../parsers/schema.js';

const explorer = cosmiconfig('dep-oracle');

/**
 * Load and validate project configuration.
 *
 * @param overrides - Partial config values from CLI flags or programmatic use.
 *                    These take highest precedence.
 * @returns Fully validated Config object with defaults applied.
 */
export async function loadConfig(overrides?: Partial<Config>): Promise<Config> {
  let fileConfig: Record<string, unknown> = {};

  try {
    const result = await explorer.search();
    if (result?.config && typeof result.config === 'object') {
      fileConfig = result.config as Record<string, unknown>;
    }
  } catch {
    // Config file is optional -- continue with defaults if search fails
  }

  // Merge: file config < CLI overrides
  const merged: Record<string, unknown> = { ...fileConfig, ...overrides };

  // Read GitHub token from environment variables when not set by file or override
  if (!merged.githubToken && process.env.GITHUB_TOKEN) {
    merged.githubToken = process.env.GITHUB_TOKEN;
  }
  if (!merged.githubToken && process.env.DEP_ORACLE_GITHUB_TOKEN) {
    merged.githubToken = process.env.DEP_ORACLE_GITHUB_TOKEN;
  }

  return ConfigSchema.parse(merged);
}
