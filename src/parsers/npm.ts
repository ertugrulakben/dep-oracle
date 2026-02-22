import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

import { BaseParser } from "./base.js";
import {
  type DependencyTree,
  createDependencyTree,
  createDependencyNode,
} from "./schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T = unknown>(path: string): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

async function readText(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

/** Merge a record of { name: versionSpec } into the nodes map. */
function addDirectDeps(
  tree: DependencyTree,
  deps: Record<string, string> | undefined,
): void {
  if (!deps) return;
  for (const [name, version] of Object.entries(deps)) {
    const key = `${name}@${version}`;
    if (tree.nodes.has(key)) continue;
    tree.nodes.set(
      key,
      createDependencyNode({ name, version, registry: "npm", depth: 0, isDirect: true, parent: null }),
    );
  }
}

// ---------------------------------------------------------------------------
// Lock-file parsers
// ---------------------------------------------------------------------------

/**
 * Parse package-lock.json v2/v3 "packages" field.
 *
 * The top-level key "" is the project root — skip it. Every other key is of
 * the form "node_modules/<name>" (possibly nested).
 */
function parsePackageLock(
  lockData: PackageLockJson,
  directNames: Set<string>,
  tree: DependencyTree,
): void {
  const packages = lockData.packages ?? {};

  for (const [pkgPath, meta] of Object.entries(packages)) {
    // Skip the root entry
    if (pkgPath === "") continue;

    // Extract the package name from the path.
    // e.g. "node_modules/express" -> "express"
    //      "node_modules/@scope/pkg" -> "@scope/pkg"
    //      "node_modules/a/node_modules/b" -> "b"
    const segments = pkgPath.split("node_modules/");
    const name = segments[segments.length - 1];
    if (!name) continue;

    const version = meta.version ?? "unknown";
    const depth = segments.length - 1; // 1 = direct level, 2+ = transitive
    const isDirect = depth === 1 && directNames.has(name);

    const key = `${name}@${version}`;
    if (tree.nodes.has(key)) continue;

    tree.nodes.set(
      key,
      createDependencyNode({
        name,
        version,
        registry: "npm",
        depth: isDirect ? 0 : depth,
        isDirect,
        parent: isDirect ? null : inferParent(pkgPath),
      }),
    );
  }
}

/** Extract the parent package name from a nested node_modules path. */
function inferParent(pkgPath: string): string | null {
  // "node_modules/a/node_modules/b" -> parent is "a"
  const parts = pkgPath.split("/node_modules/");
  if (parts.length < 2) return null;
  // The second-to-last segment is the parent
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

/**
 * Parse a yarn.lock (v1) flat format.
 *
 * Each block looks like:
 * ```
 * "express@^4.18.0":
 *   version "4.18.2"
 *   resolved "https://..."
 *   ...
 * ```
 */
function parseYarnLock(
  content: string,
  directNames: Set<string>,
  tree: DependencyTree,
): void {
  const lines = content.split("\n");
  let currentNames: string[] = [];
  let currentVersion: string | null = null;

  const flush = (): void => {
    if (currentNames.length === 0 || !currentVersion) return;
    for (const rawName of currentNames) {
      // rawName is e.g. "express@^4.18.0" or "@scope/pkg@~1.0.0"
      const atIdx = rawName.lastIndexOf("@");
      const name = atIdx > 0 ? rawName.slice(0, atIdx) : rawName;
      const version = currentVersion;
      const isDirect = directNames.has(name);
      const key = `${name}@${version}`;
      if (tree.nodes.has(key)) continue;

      tree.nodes.set(
        key,
        createDependencyNode({
          name,
          version,
          registry: "npm",
          depth: isDirect ? 0 : 1,
          isDirect,
          parent: null,
        }),
      );
    }
  };

  for (const line of lines) {
    // Skip comments and blank lines
    if (line.startsWith("#") || line.trim() === "") continue;

    // Header line (no leading whitespace)
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      flush();
      currentNames = [];
      currentVersion = null;

      // Parse the header: could have multiple comma-separated entries
      // e.g.: "chalk@^4.0.0", "chalk@^4.1.0":
      const cleaned = line.replace(/:$/, "").trim();
      const entries = cleaned.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      currentNames = entries.filter(Boolean);
      continue;
    }

    // version field inside a block
    const versionMatch = line.match(/^\s+version\s+"?([^"]+)"?/);
    if (versionMatch) {
      currentVersion = versionMatch[1];
    }
  }
  // Flush the last block
  flush();
}

/**
 * Parse pnpm-lock.yaml (lockfileVersion 9 format).
 *
 * The interesting section is `packages:` which is a map like:
 *   /@scope/pkg@1.2.3:
 *     resolution: ...
 *     dependencies: ...
 *
 * In newer v9 the key format is: `<name>@<version>` (no leading slash).
 *
 * We use a lightweight regex approach to avoid pulling in a YAML parser as a
 * hard dependency — this project already has zero YAML dependencies.
 */
function parsePnpmLock(
  content: string,
  directNames: Set<string>,
  tree: DependencyTree,
): void {
  // Match lines that look like package entries under the `packages:` section.
  // Both formats:
  //   /@scope/name@1.0.0:        (lockfileVersion < 9)
  //   @scope/name@1.0.0:         (lockfileVersion 9)
  //   name@1.0.0:                (unscoped)
  //   /name@1.0.0:               (unscoped, old)
  // Lines inside a `packages:` block that start at column 2+ with an @ or letter.

  const lines = content.split("\n");
  let inPackages = false;
  // Track the current package context for nested dependency parsing
  let currentPackageName: string | null = null;
  let inDependencies = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Detect the packages section
    if (/^packages:/.test(trimmed)) {
      inPackages = true;
      continue;
    }

    // If we hit another top-level key, stop
    if (inPackages && /^\S/.test(trimmed) && !trimmed.startsWith(" ") && !trimmed.startsWith("'") && !trimmed.startsWith("/")) {
      // Could be another top-level key like "snapshots:" or "importers:"
      if (!trimmed.includes("@") && trimmed.endsWith(":")) {
        inPackages = false;
        continue;
      }
    }

    if (!inPackages) continue;

    // Package entry line (indented with 2 spaces or starts with / or quoted)
    // Patterns:
    //   '  /@scope/pkg@1.0.0:'
    //   '  name@1.0.0:'
    //   '  @scope/name@1.0.0:'
    const pkgMatch = trimmed.match(
      /^\s{2,4}(?:'|")?\/?((?:@[^/@]+\/)?[^@:'"]+)@([^:'"]+)(?:'|")?:\s*$/,
    );

    if (pkgMatch) {
      const [, name, version] = pkgMatch;
      if (!name || !version) continue;

      currentPackageName = name;
      inDependencies = false;

      const isDirect = directNames.has(name);
      const key = `${name}@${version}`;
      if (tree.nodes.has(key)) continue;

      tree.nodes.set(
        key,
        createDependencyNode({
          name,
          version,
          registry: "npm",
          depth: isDirect ? 0 : 1,
          isDirect,
          parent: null,
        }),
      );
      continue;
    }

    // Detect "dependencies:" sub-block
    if (/^\s{4,6}dependencies:/.test(trimmed)) {
      inDependencies = true;
      continue;
    }

    // Detect end of dependencies sub-block (less indentation or new section)
    if (inDependencies && /^\s{4,6}\S/.test(trimmed) && !trimmed.match(/^\s{6,}/)) {
      inDependencies = false;
    }

    // Parse individual dependency lines inside a dependencies block
    if (inDependencies && currentPackageName) {
      const depMatch = trimmed.match(/^\s{6,8}(?:'|")?([^:'"]+)(?:'|")?\s*:\s*(?:'|")?([^'"]+)(?:'|")?/);
      if (depMatch) {
        const [, depName, depVersion] = depMatch;
        if (!depName || !depVersion) continue;

        const cleanVersion = depVersion.trim();
        const isDirect = directNames.has(depName);
        const key = `${depName}@${cleanVersion}`;
        if (tree.nodes.has(key)) continue;

        tree.nodes.set(
          key,
          createDependencyNode({
            name: depName,
            version: cleanVersion,
            registry: "npm",
            depth: isDirect ? 0 : 2,
            isDirect,
            parent: isDirect ? null : currentPackageName,
          }),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Types for package-lock.json
// ---------------------------------------------------------------------------

interface PackageLockJson {
  lockfileVersion?: number;
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
}

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// NpmParser
// ---------------------------------------------------------------------------

export class NpmParser extends BaseParser {
  readonly name = "npm";

  async detect(dir: string): Promise<boolean> {
    return fileExists(join(dir, "package.json"));
  }

  async parse(dir: string): Promise<DependencyTree> {
    const pkgPath = join(dir, "package.json");
    const pkg = await readJson<PackageJson>(pkgPath);

    const projectName = pkg.name ?? "unknown";
    const tree = createDependencyTree(projectName, pkgPath);

    // Collect direct dependency names for reference during lock-file parsing
    const allDirect: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    const directNames = new Set(Object.keys(allDirect));

    // Add direct dependencies first
    addDirectDeps(tree, pkg.dependencies);
    addDirectDeps(tree, pkg.devDependencies);

    // Try lock files in priority order: package-lock.json > yarn.lock > pnpm-lock.yaml
    const lockPath = join(dir, "package-lock.json");
    const yarnPath = join(dir, "yarn.lock");
    const pnpmPath = join(dir, "pnpm-lock.yaml");

    if (await fileExists(lockPath)) {
      const lockData = await readJson<PackageLockJson>(lockPath);
      parsePackageLock(lockData, directNames, tree);
    } else if (await fileExists(yarnPath)) {
      const yarnContent = await readText(yarnPath);
      parseYarnLock(yarnContent, directNames, tree);
    } else if (await fileExists(pnpmPath)) {
      const pnpmContent = await readText(pnpmPath);
      parsePnpmLock(pnpmContent, directNames, tree);
    }
    // If no lock file is found, we already have direct deps from package.json

    // Deduplicate direct deps: when a lockfile provided resolved versions,
    // remove the version-range entries (e.g. keep "chalk@5.6.2", remove "chalk@^5.3.0").
    this.deduplicateDirectDeps(tree);

    // Recount totals — lock file parsing may have adjusted depths
    tree.totalDirect = 0;
    tree.totalTransitive = 0;
    for (const node of tree.nodes.values()) {
      if (node.isDirect) {
        tree.totalDirect++;
      } else {
        tree.totalTransitive++;
      }
    }

    return tree;
  }

  /**
   * When both a version-range entry (from package.json) and a resolved-version
   * entry (from lockfile) exist for the same package name, keep only the
   * resolved one.
   *
   * A version is considered "resolved" when it does NOT start with ^, ~, >=, etc.
   */
  private deduplicateDirectDeps(tree: DependencyTree): void {
    // Group direct deps by package name
    const byName = new Map<string, Array<{ key: string; version: string }>>();

    for (const [key, node] of tree.nodes.entries()) {
      if (!node.isDirect) continue;
      const list = byName.get(node.name) ?? [];
      list.push({ key, version: node.version });
      byName.set(node.name, list);
    }

    for (const [, entries] of byName) {
      if (entries.length <= 1) continue;

      // Determine which entries are version ranges
      const isRange = (v: string) => /^[~^>=<*]/.test(v) || v === 'latest';
      const resolved = entries.filter((e) => !isRange(e.version));
      const ranges = entries.filter((e) => isRange(e.version));

      // If we have at least one resolved version, remove all range entries
      if (resolved.length > 0 && ranges.length > 0) {
        for (const range of ranges) {
          tree.nodes.delete(range.key);
        }
      }
    }
  }
}
