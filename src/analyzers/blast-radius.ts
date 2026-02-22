import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlastRadiusResult {
  /** Number of source files that import the package. */
  affectedFiles: number;
  /** Relative paths of the affected files. */
  affectedFilesList: string[];
  /** Percentage of all source files affected (0-100). */
  percentage: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts', '.cjs', '.cts']);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.turbo',
]);

// ---------------------------------------------------------------------------
// BlastRadiusCalculator
// ---------------------------------------------------------------------------

export class BlastRadiusCalculator {
  /**
   * Scan all source files under `projectDir` and count how many import
   * `packageName` (including sub-path imports like `packageName/sub`).
   */
  async calculate(
    packageName: string,
    projectDir: string,
  ): Promise<BlastRadiusResult> {
    const sourceFiles = await this.collectSourceFiles(projectDir);

    if (sourceFiles.length === 0) {
      return { affectedFiles: 0, affectedFilesList: [], percentage: 0 };
    }

    const importPattern = this.buildImportPattern(packageName);
    const affectedFilesList: string[] = [];

    // Read files in parallel (batched to avoid overwhelming the file system)
    const BATCH_SIZE = 50;
    for (let i = 0; i < sourceFiles.length; i += BATCH_SIZE) {
      const batch = sourceFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          const matches = await this.fileContainsImport(filePath, importPattern);
          return { filePath, matches };
        }),
      );

      for (const { filePath, matches } of results) {
        if (matches) {
          affectedFilesList.push(relative(projectDir, filePath));
        }
      }
    }

    const percentage =
      sourceFiles.length > 0
        ? Math.round((affectedFilesList.length / sourceFiles.length) * 10000) / 100
        : 0;

    return {
      affectedFiles: affectedFilesList.length,
      affectedFilesList: affectedFilesList.sort(),
      percentage,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Build a RegExp that matches all common import/require styles for a
   * given package name, including sub-path imports.
   *
   * Matches:
   *   import ... from 'packageName'
   *   import ... from 'packageName/sub'
   *   import 'packageName'
   *   require('packageName')
   *   require('packageName/sub')
   *   import('packageName')         (dynamic import)
   */
  private buildImportPattern(packageName: string): RegExp {
    // Escape special regex chars in the package name (e.g. @scope/name)
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match the package name optionally followed by a sub-path.
    // The pattern must NOT match packages that merely start with the same
    // prefix (e.g. "chalk" should not match "chalk-animation").
    // We allow the name to be followed by: /, quote end, or nothing.
    const pkgPattern = `${escaped}(?:/[^'"]*)?`;

    return new RegExp(
      [
        // ESM static: import ... from 'pkg' or import ... from "pkg"
        `from\\s+['"]${pkgPattern}['"]`,
        // ESM bare: import 'pkg' / import "pkg"
        `import\\s+['"]${pkgPattern}['"]`,
        // CJS require: require('pkg') or require("pkg")
        `require\\s*\\(\\s*['"]${pkgPattern}['"]\\s*\\)`,
        // Dynamic import: import('pkg')
        `import\\s*\\(\\s*['"]${pkgPattern}['"]\\s*\\)`,
      ].join('|'),
    );
  }

  /**
   * Check whether a file's content matches the import pattern.
   */
  private async fileContainsImport(
    filePath: string,
    pattern: RegExp,
  ): Promise<boolean> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return pattern.test(content);
    } catch {
      // File unreadable — skip silently
      return false;
    }
  }

  /**
   * Recursively collect all source files under `dir`, skipping
   * node_modules and other non-source directories.
   */
  private async collectSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      const promises: Promise<void>[] = [];

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            promises.push(
              this.collectSourceFiles(fullPath).then((subFiles) => {
                files.push(...subFiles);
              }),
            );
          }
        } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
          files.push(fullPath);
        }
      }

      await Promise.all(promises);
    } catch {
      // Directory unreadable — return empty
    }

    return files;
  }
}
