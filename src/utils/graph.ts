import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** File extensions to scan for import statements. */
const SCANNABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

/** Directories to skip during recursive traversal. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
]);

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

/**
 * Regular expressions that capture the package name from various import forms.
 *
 * ESM static imports:
 *   import ... from "package"
 *   import ... from 'package'
 *   export ... from "package"
 *
 * CommonJS:
 *   require("package")
 *   require('package')
 *
 * Dynamic imports:
 *   import("package")
 *   import('package')
 *
 * The captured group is the full module specifier; we extract the package name
 * from it (handling scoped packages like @scope/name).
 */
const IMPORT_PATTERNS: RegExp[] = [
  // ESM: import ... from "pkg"  /  export ... from "pkg"
  /(?:import|export)\s+.*?\s+from\s+["']([^"']+)["']/g,
  // ESM: import "pkg" (side-effect import)
  /import\s+["']([^"']+)["']/g,
  // CJS: require("pkg")
  /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  // Dynamic: import("pkg")
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/**
 * Extract the npm package name from a module specifier.
 *
 * - Relative paths ("./foo", "../bar") are ignored (returns null).
 * - Node built-ins ("node:fs") are ignored.
 * - Scoped packages: "@scope/name/sub" -> "@scope/name"
 * - Regular packages: "express/lib/router" -> "express"
 */
function extractPackageName(specifier: string): string | null {
  // Skip relative imports
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;

  // Skip Node built-in modules
  if (specifier.startsWith("node:")) return null;

  // Scoped package: @scope/name or @scope/name/sub/path
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }

  // Regular package: name or name/sub/path
  return specifier.split("/")[0];
}

/**
 * Scan a single file's content and return the set of external package names
 * it imports.
 */
function extractImports(content: string): Set<string> {
  const packages = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const specifier = match[1];
      const pkg = extractPackageName(specifier);
      if (pkg) {
        packages.add(pkg);
      }
    }
  }

  return packages;
}

// ---------------------------------------------------------------------------
// Recursive file traversal
// ---------------------------------------------------------------------------

/**
 * Recursively collect all scannable source files under `dir`.
 */
async function collectSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }

  const tasks: Promise<void>[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;

    const fullPath = join(dir, entry);

    tasks.push(
      (async () => {
        try {
          const info = await stat(fullPath);
          if (info.isDirectory()) {
            const nested = await collectSourceFiles(fullPath);
            files.push(...nested);
          } else if (info.isFile() && SCANNABLE_EXTENSIONS.has(extname(entry))) {
            files.push(fullPath);
          }
        } catch {
          // Permission errors, broken symlinks, etc. — skip silently
        }
      })(),
    );
  }

  await Promise.all(tasks);
  return files;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Import graph mapping: `packageName -> Set<filePaths that import it>`.
 */
export type ImportGraph = Map<string, Set<string>>;

/**
 * Scan all JS/TS source files under `dir` and build a mapping from each
 * external package name to the set of files that import it.
 *
 * This is used to compute the **blast radius** — how many files in the
 * project would be affected if a particular dependency were removed or
 * compromised.
 *
 * @param dir  Root directory to scan (usually the project root).
 * @returns    Map from package name to set of absolute file paths.
 */
export async function buildImportGraph(dir: string): Promise<ImportGraph> {
  const graph: ImportGraph = new Map();
  const sourceFiles = await collectSourceFiles(dir);

  // Read all files in parallel (bounded by OS limits)
  const results = await Promise.all(
    sourceFiles.map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        const packages = extractImports(content);
        return { filePath, packages };
      } catch {
        return { filePath, packages: new Set<string>() };
      }
    }),
  );

  for (const { filePath, packages } of results) {
    for (const pkg of packages) {
      let fileSet = graph.get(pkg);
      if (!fileSet) {
        fileSet = new Set();
        graph.set(pkg, fileSet);
      }
      fileSet.add(filePath);
    }
  }

  return graph;
}

/**
 * Compute the blast radius of a package — the number of source files in
 * the project that directly import it.
 *
 * @param packageName  npm/pypi package name.
 * @param graph        Import graph built by `buildImportGraph`.
 * @returns            Number of files that import this package.
 */
export function getBlastRadius(packageName: string, graph: ImportGraph): number {
  const files = graph.get(packageName);
  return files ? files.size : 0;
}

/**
 * Return the list of files that import a given package.
 *
 * @param packageName  npm/pypi package name.
 * @param graph        Import graph built by `buildImportGraph`.
 * @returns            Array of absolute file paths.
 */
export function getImportingFiles(packageName: string, graph: ImportGraph): string[] {
  const files = graph.get(packageName);
  return files ? Array.from(files) : [];
}
