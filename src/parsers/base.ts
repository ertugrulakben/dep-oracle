import type { DependencyTree } from "./schema.js";

/**
 * Abstract base class that every manifest parser must extend.
 *
 * Each parser is responsible for a single ecosystem (npm, pypi, etc.) and
 * knows how to:
 *   1. Detect whether its manifest file exists in a given directory.
 *   2. Parse that manifest (and optional lock file) into a DependencyTree.
 */
export abstract class BaseParser {
  /** Human-readable name used in logs and reports (e.g. "npm", "python"). */
  abstract readonly name: string;

  /**
   * Return `true` when the parser's manifest file(s) exist in `dir`.
   *
   * Implementations should use `fs.access` (or equivalent) and must never
   * throw — return `false` for any I/O error.
   */
  abstract detect(dir: string): Promise<boolean>;

  /**
   * Parse the manifest (and optional lock file) found in `dir` and return a
   * fully populated DependencyTree.
   *
   * Implementations may throw when the manifest is present but malformed.
   */
  abstract parse(dir: string): Promise<DependencyTree>;
}
