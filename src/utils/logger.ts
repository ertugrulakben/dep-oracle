import chalk from "chalk";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let _verbose = false;

/**
 * Enable or disable verbose (info-level) output.
 *
 * When verbose is off (default), only warn and error messages are printed.
 * Debug messages additionally require `DEP_ORACLE_DEBUG` to be set.
 */
export function setVerbose(enabled: boolean): void {
  _verbose = enabled;
}

export function isVerbose(): boolean {
  return _verbose;
}

/**
 * Check whether debug output is enabled via the DEP_ORACLE_DEBUG env var.
 *
 * Any truthy value ("1", "true", "yes") enables debug logging.
 */
export function isDebug(): boolean {
  const val = process.env.DEP_ORACLE_DEBUG;
  if (!val) return false;
  return ["1", "true", "yes"].includes(val.toLowerCase());
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function formatMessage(level: string, colorFn: (s: string) => string, msg: string): string {
  return `${chalk.dim(timestamp())} ${colorFn(level.padEnd(5))} ${msg}`;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Structured logger for dep-oracle.
 *
 * - `debug`: gray, only printed when `DEP_ORACLE_DEBUG` is set
 * - `info`:  blue, only printed when verbose mode is enabled or `DEP_ORACLE_DEBUG` is set
 * - `warn`:  yellow, always printed
 * - `error`: red, always printed
 *
 * All output goes to stderr so it never contaminates piped JSON or table output.
 */
export const logger = {
  debug(msg: string): void {
    if (!isDebug()) return;
    process.stderr.write(formatMessage("DEBUG", chalk.gray, chalk.gray(msg)) + "\n");
  },

  info(msg: string): void {
    if (!_verbose && !isDebug()) return;
    process.stderr.write(formatMessage("INFO", chalk.blue, msg) + "\n");
  },

  warn(msg: string): void {
    process.stderr.write(formatMessage("WARN", chalk.yellow, msg) + "\n");
  },

  error(msg: string): void {
    process.stderr.write(formatMessage("ERROR", chalk.red, msg) + "\n");
  },
} as const;

/**
 * Create a child logger that prefixes every message with a label.
 *
 * Useful for per-module or per-collector logging:
 * ```ts
 * const log = createLogger("npm-collector");
 * log.info("fetching registry data"); // => 12:34:56.789 INFO  [npm-collector] fetching registry data
 * ```
 */
export function createLogger(label: string) {
  const prefix = chalk.dim(`[${label}]`);
  return {
    debug(msg: string): void {
      logger.debug(`${prefix} ${msg}`);
    },
    info(msg: string): void {
      logger.info(`${prefix} ${msg}`);
    },
    warn(msg: string): void {
      logger.warn(`${prefix} ${msg}`);
    },
    error(msg: string): void {
      logger.error(`${prefix} ${msg}`);
    },
  } as const;
}
