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

async function readText(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

async function readJson<T = unknown>(path: string): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Normalize a Python package name according to PEP 503.
 * Replaces runs of [-_.] with a single hyphen and lowercases.
 */
function normalizePyPIName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/**
 * Parse a single PEP 508 dependency specifier and return (name, version).
 *
 * Handles:
 *   requests==2.31.0
 *   flask>=2.0,<3.0
 *   django~=4.2
 *   numpy
 *   black[jupyter]>=23.0
 *   urllib3 ; python_version >= "3.7"
 */
function parsePep508(spec: string): { name: string; version: string } | null {
  // Strip inline comments
  const cleaned = spec.split("#")[0].trim();
  if (!cleaned || cleaned.startsWith("-")) return null;

  // Strip environment markers (everything after a bare ";")
  const withoutMarkers = cleaned.split(";")[0].trim();

  // Match: name[extras](==|>=|<=|~=|!=|>|<)version(,...)
  const match = withoutMarkers.match(
    /^([A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?)(\[.*?\])?\s*(.*)?$/,
  );
  if (!match) return null;

  const rawName = match[1];
  const versionPart = (match[4] ?? "").trim();

  // Clean version: take the full constraint string as the version
  const version = versionPart || "*";

  return {
    name: normalizePyPIName(rawName),
    version,
  };
}

// ---------------------------------------------------------------------------
// requirements.txt parser
// ---------------------------------------------------------------------------

function parseRequirementsTxt(
  content: string,
  tree: DependencyTree,
): void {
  const lines = content.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Skip comments, blank lines, and option lines
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;

    const dep = parsePep508(line);
    if (!dep) continue;

    const key = `${dep.name}@${dep.version}`;
    if (tree.nodes.has(key)) continue;

    tree.nodes.set(
      key,
      createDependencyNode({
        name: dep.name,
        version: dep.version,
        registry: "pypi",
        depth: 0,
        isDirect: true,
        parent: null,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// pyproject.toml parser (lightweight, regex-based to avoid TOML dep)
// ---------------------------------------------------------------------------

/**
 * Extract the [project.dependencies] array from pyproject.toml content.
 *
 * We use a simple state-machine approach instead of a full TOML parser to
 * keep the dependency count at zero for parsing logic.
 */
function parsePyprojectDeps(content: string): string[] {
  const deps: string[] = [];
  const lines = content.split("\n");
  let inSection = false;
  let inArray = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Detect [project] section's dependencies key
    if (/^\[project\]/.test(line)) {
      inSection = true;
      continue;
    }

    // Detect [tool.poetry.dependencies] section
    if (/^\[tool\.poetry\.dependencies\]/.test(line)) {
      inSection = true;
      continue;
    }

    // If we hit a new section header, stop
    if (inSection && /^\[/.test(line) && !/^\[project\]/.test(line) && !/^\[tool\.poetry\.dependencies\]/.test(line)) {
      inSection = false;
      inArray = false;
      continue;
    }

    if (!inSection) continue;

    // Inside [project] look for `dependencies = [`
    if (/^dependencies\s*=\s*\[/.test(line)) {
      inArray = true;
      // Check if entries are on the same line: dependencies = ["foo", "bar"]
      const inlineMatch = line.match(/\[(.+)\]/);
      if (inlineMatch) {
        const entries = inlineMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
        deps.push(...entries.filter(Boolean));
        inArray = false;
      }
      continue;
    }

    // Inside the dependencies array, collect entries
    if (inArray) {
      if (line === "]") {
        inArray = false;
        continue;
      }
      // Each line is like "requests>=2.28" or 'flask~=2.0',
      const cleaned = line.replace(/,$/g, "").replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
      if (cleaned) {
        deps.push(cleaned);
      }
      continue;
    }

    // Inside [tool.poetry.dependencies] entries look like:
    //   requests = "^2.28"
    //   python = "^3.10"
    //   flask = {version = "~2.0", optional = true}
    if (inSection && !inArray && line.includes("=") && !line.startsWith("[")) {
      const eqIdx = line.indexOf("=");
      const key = line.slice(0, eqIdx).trim();
      const valRaw = line.slice(eqIdx + 1).trim();

      // Skip the python version constraint
      if (key === "python") continue;
      // Skip empty or non-string values
      if (!valRaw) continue;

      let version = "*";
      // Simple string value: "^2.28"
      const strMatch = valRaw.match(/^"([^"]+)"|^'([^']+)'/);
      if (strMatch) {
        version = strMatch[1] ?? strMatch[2] ?? "*";
      }
      // Inline table: {version = "~2.0", ...}
      const tableMatch = valRaw.match(/version\s*=\s*"([^"]+)"/);
      if (tableMatch) {
        version = tableMatch[1];
      }

      deps.push(`${key}${version !== "*" ? version : ""}`);
    }
  }

  return deps;
}

function addPyprojectDeps(content: string, tree: DependencyTree): void {
  const specs = parsePyprojectDeps(content);
  for (const spec of specs) {
    const dep = parsePep508(spec);
    if (!dep) continue;

    const key = `${dep.name}@${dep.version}`;
    if (tree.nodes.has(key)) continue;

    tree.nodes.set(
      key,
      createDependencyNode({
        name: dep.name,
        version: dep.version,
        registry: "pypi",
        depth: 0,
        isDirect: true,
        parent: null,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Pipfile.lock parser (transitive dependencies)
// ---------------------------------------------------------------------------

interface PipfileLockJson {
  default?: Record<string, { version?: string }>;
  develop?: Record<string, { version?: string }>;
}

function parsePipfileLock(
  lockData: PipfileLockJson,
  tree: DependencyTree,
): void {
  const directNames = new Set<string>();
  for (const node of tree.nodes.values()) {
    if (node.isDirect) {
      directNames.add(node.name);
    }
  }

  const sections: Array<Record<string, { version?: string }> | undefined> = [
    lockData.default,
    lockData.develop,
  ];

  for (const section of sections) {
    if (!section) continue;
    for (const [rawName, meta] of Object.entries(section)) {
      const name = normalizePyPIName(rawName);
      // Version in Pipfile.lock is like "==2.31.0"
      const version = (meta.version ?? "*").replace(/^==/, "");
      const isDirect = directNames.has(name);

      const key = `${name}@${version}`;
      if (tree.nodes.has(key)) continue;

      tree.nodes.set(
        key,
        createDependencyNode({
          name,
          version,
          registry: "pypi",
          depth: isDirect ? 0 : 1,
          isDirect,
          parent: null,
        }),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// PythonParser
// ---------------------------------------------------------------------------

export class PythonParser extends BaseParser {
  readonly name = "python";

  async detect(dir: string): Promise<boolean> {
    const checks = await Promise.all([
      fileExists(join(dir, "requirements.txt")),
      fileExists(join(dir, "pyproject.toml")),
      fileExists(join(dir, "Pipfile")),
    ]);
    return checks.some(Boolean);
  }

  async parse(dir: string): Promise<DependencyTree> {
    const reqPath = join(dir, "requirements.txt");
    const pyprojectPath = join(dir, "pyproject.toml");
    const pipfileLockPath = join(dir, "Pipfile.lock");

    // Determine manifest path for the tree metadata
    let manifestPath = dir;
    if (await fileExists(pyprojectPath)) {
      manifestPath = pyprojectPath;
    } else if (await fileExists(reqPath)) {
      manifestPath = reqPath;
    }

    const tree = createDependencyTree("python-project", manifestPath);

    // Parse requirements.txt if it exists
    if (await fileExists(reqPath)) {
      const content = await readText(reqPath);
      parseRequirementsTxt(content, tree);
    }

    // Parse pyproject.toml if it exists (may add more deps)
    if (await fileExists(pyprojectPath)) {
      const content = await readText(pyprojectPath);
      addPyprojectDeps(content, tree);

      // Try to extract project name from pyproject.toml
      const nameMatch = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
      if (nameMatch) {
        tree.root = normalizePyPIName(nameMatch[1]);
      }
    }

    // If Pipfile.lock exists, parse transitive dependencies from it
    if (await fileExists(pipfileLockPath)) {
      const lockData = await readJson<PipfileLockJson>(pipfileLockPath);
      parsePipfileLock(lockData, tree);
    }

    // Recount totals
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
}
