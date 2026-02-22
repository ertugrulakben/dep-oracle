/**
 * MCP tool definitions for dep-oracle.
 *
 * Registers 8 tools that expose the full analysis pipeline:
 *   1. dep_oracle_scan          -- full project scan
 *   2. dep_oracle_trust_score   -- single package trust score
 *   3. dep_oracle_blast_radius  -- import impact analysis
 *   4. dep_oracle_zombies       -- list zombie dependencies
 *   5. dep_oracle_suggest_migration -- migration suggestions
 *   6. dep_oracle_typosquat_check   -- typosquat risk check
 *   7. dep_oracle_compare       -- side-by-side package comparison
 *   8. dep_oracle_report        -- generate HTML report
 *
 * All tools share the same core engine (parsers, collectors, analyzers)
 * as the CLI.
 */

import { resolve } from 'node:path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { CacheManager } from '../cache/store.js';
import { NpmParser } from '../parsers/npm.js';
import { PythonParser } from '../parsers/python.js';
import type { DependencyTree, TrustReport, ScanResult } from '../parsers/schema.js';
import { CollectorOrchestrator } from '../collectors/orchestrator.js';
import { TrustScoreEngine } from '../analyzers/trust-score.js';
import { ZombieDetector } from '../analyzers/zombie-detector.js';
import { BlastRadiusCalculator } from '../analyzers/blast-radius.js';
import { MigrationAdvisor } from '../analyzers/migration-advisor.js';
import { TyposquatDetector } from '../analyzers/typosquat.js';
import { buildImportGraph, getBlastRadius } from '../utils/graph.js';
import { JsonReporter } from '../reporters/json.js';

// ---------------------------------------------------------------------------
// Shared instances (created once per MCP server lifetime)
// ---------------------------------------------------------------------------

const cache = new CacheManager();
const orchestrator = new CollectorOrchestrator(cache, {
  githubToken: process.env.GITHUB_TOKEN,
});
const trustEngine = new TrustScoreEngine();
const zombieDetector = new ZombieDetector();
const blastRadiusCalc = new BlastRadiusCalculator();
const migrationAdvisor = new MigrationAdvisor();
const typosquatDetector = new TyposquatDetector();
const jsonReporter = new JsonReporter();
const parsers = [new NpmParser(), new PythonParser()];

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'dep_oracle_scan',
    description:
      'Perform a full dependency security scan on a project directory. ' +
      'Parses the manifest (package.json, requirements.txt, etc.), collects data ' +
      'from registries and GitHub, computes trust scores for every dependency, ' +
      'detects zombies, typosquats, and calculates blast radius. Returns a complete ' +
      'ScanResult JSON with per-package trust reports and an overall project score.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dir: {
          type: 'string',
          description:
            'Absolute path to the project directory to scan. ' +
            'Defaults to the current working directory if omitted.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'dep_oracle_trust_score',
    description:
      'Calculate the trust score for a single npm package. Queries the npm registry, ' +
      'GitHub, OSV vulnerability database, and other sources to produce a weighted ' +
      'score (0-100) across 6 dimensions: security, maintainer, activity, popularity, ' +
      'funding, and license. Returns a TrustReport JSON with the overall score, ' +
      'per-dimension metrics, zombie status, and alternative suggestions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        package: {
          type: 'string',
          description: 'npm package name (e.g. "express", "@scope/pkg").',
        },
        version: {
          type: 'string',
          description:
            'Specific version to analyze (e.g. "4.18.2"). If omitted, the latest version is used.',
        },
      },
      required: ['package'],
    },
  },
  {
    name: 'dep_oracle_blast_radius',
    description:
      'Analyze the blast radius (import impact) of a package within a project. ' +
      'Scans all JS/TS source files to find how many files import the given package. ' +
      'Returns the count of affected files, their paths, and the percentage of the ' +
      'codebase impacted. Useful for understanding the risk if a dependency is ' +
      'compromised or needs replacement.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        package: {
          type: 'string',
          description: 'Package name to check import usage for.',
        },
        dir: {
          type: 'string',
          description:
            'Absolute path to the project directory. Defaults to cwd if omitted.',
        },
      },
      required: ['package'],
    },
  },
  {
    name: 'dep_oracle_zombies',
    description:
      'Detect zombie (abandoned/unmaintained) dependencies in a project. ' +
      'Parses the manifest, queries registry and GitHub for each dependency, and ' +
      'flags packages that show signs of abandonment: deprecated, no commits in 12+ months, ' +
      'no active maintainers, etc. Returns an array of zombie packages with severity ' +
      'levels and reasons.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dir: {
          type: 'string',
          description:
            'Absolute path to the project directory. Defaults to cwd if omitted.',
        },
      },
      required: [] as string[],
    },
  },
  {
    name: 'dep_oracle_suggest_migration',
    description:
      'Get migration suggestions for a given package. Looks up the package in a ' +
      'curated knowledge base of common replacements and returns alternatives with ' +
      'descriptions and difficulty ratings. Useful for replacing deprecated, abandoned, ' +
      'or low-trust packages (e.g. moment -> dayjs, request -> got, lodash -> es-toolkit).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        package: {
          type: 'string',
          description: 'Package name to find migration alternatives for.',
        },
      },
      required: ['package'],
    },
  },
  {
    name: 'dep_oracle_typosquat_check',
    description:
      'Check whether a package name is a potential typosquat of a popular package. ' +
      'Uses Levenshtein distance, homoglyph detection, and pattern analysis to identify ' +
      'suspicious package names that closely resemble well-known packages. Returns a ' +
      'risk assessment with similar package names and the edit distance.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        package: {
          type: 'string',
          description: 'Package name to check for typosquatting risk.',
        },
      },
      required: ['package'],
    },
  },
  {
    name: 'dep_oracle_compare',
    description:
      'Compare two packages side-by-side by computing trust scores for both. ' +
      'Returns the full trust report for each package including scores, metrics, ' +
      'zombie status, and trend direction. Useful for evaluating alternatives ' +
      'or choosing between competing libraries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        packageA: {
          type: 'string',
          description: 'First package name to compare.',
        },
        packageB: {
          type: 'string',
          description: 'Second package name to compare.',
        },
      },
      required: ['packageA', 'packageB'],
    },
  },
  {
    name: 'dep_oracle_report',
    description:
      'Generate a JSON report for a project. Runs a full scan and outputs the results ' +
      'as formatted JSON. Optionally writes the report to a file. Returns the JSON ' +
      'content or the path to the generated file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        dir: {
          type: 'string',
          description:
            'Absolute path to the project directory. Defaults to cwd if omitted.',
        },
        output: {
          type: 'string',
          description:
            'Absolute path to write the report file. If omitted, the report content is returned directly.',
        },
      },
      required: [] as string[],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: Server): void {
  // List all available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool invocations
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'dep_oracle_scan':
          return await handleScan(args);
        case 'dep_oracle_trust_score':
          return await handleTrustScore(args);
        case 'dep_oracle_blast_radius':
          return await handleBlastRadius(args);
        case 'dep_oracle_zombies':
          return await handleZombies(args);
        case 'dep_oracle_suggest_migration':
          return await handleSuggestMigration(args);
        case 'dep_oracle_typosquat_check':
          return await handleTyposquatCheck(args);
        case 'dep_oracle_compare':
          return await handleCompare(args);
        case 'dep_oracle_report':
          return await handleReport(args);
        default:
          return errorResponse(`Unknown tool: ${name}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(`Tool "${name}" failed: ${message}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: build a successful text content response
// ---------------------------------------------------------------------------

function successResponse(data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text' as const, text }],
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Shared: parse project dependencies
// ---------------------------------------------------------------------------

async function parseProject(dir: string): Promise<DependencyTree | null> {
  for (const parser of parsers) {
    if (await parser.detect(dir)) {
      return parser.parse(dir);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared: build a full trust report for a single package
// ---------------------------------------------------------------------------

async function buildTrustReport(
  packageName: string,
  version: string,
  blastRadius: number = 0,
): Promise<TrustReport> {
  const results = await orchestrator.collectAll(packageName, version);
  const trustResult = trustEngine.calculate(results);
  const zombie = zombieDetector.detect(
    results.registry.data,
    results.github.data,
  );
  const typosquat = typosquatDetector.check(packageName);
  const alternatives = migrationAdvisor.suggest(
    packageName,
    zombie.isZombie ? 'zombie dependency' : 'low trust score',
  );

  // Determine trend from popularity data
  const trend = results.popularity.data?.trend ?? 'stable';

  return {
    package: packageName,
    version,
    trustScore: trustResult.trustScore,
    metrics: trustResult.metrics,
    isZombie: zombie.isZombie,
    blastRadius,
    alternatives: alternatives.map((a) => a.alternative),
    trend,
    typosquatRisk: typosquat.isRisky ? 1.0 : 0.0,
  };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleScan(args: Record<string, unknown> | undefined) {
  const dir = resolve(String(args?.dir ?? process.cwd()));

  const tree = await parseProject(dir);
  if (!tree) {
    return errorResponse(
      `No supported manifest file found in "${dir}". ` +
      'Supported: package.json, requirements.txt, pyproject.toml, Pipfile.',
    );
  }

  // Build import graph for blast radius
  const importGraph = await buildImportGraph(dir);

  // Collect trust reports for all direct dependencies
  const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
  const reports: TrustReport[] = [];

  for (const node of directNodes) {
    const blastRadius = getBlastRadius(node.name, importGraph);
    const report = await buildTrustReport(node.name, node.version, blastRadius);
    reports.push(report);
  }

  // Overall score: weighted average
  const overallScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, r) => sum + r.trustScore, 0) / reports.length,
        )
      : 0;

  // Summary
  const zombieCount = reports.filter((r) => r.isZombie).length;
  const criticalCount = reports.filter((r) => r.trustScore < 50).length;
  const summary =
    `Scanned ${reports.length} direct dependencies. ` +
    `Overall trust score: ${overallScore}/100. ` +
    `${zombieCount} zombie(s) detected. ` +
    `${criticalCount} package(s) below trust threshold.`;

  const scanResult: ScanResult = {
    tree,
    reports,
    overallScore,
    summary,
  };

  // Serialize (handles Map objects)
  const serialized = jsonReporter.report(scanResult);
  return successResponse(serialized);
}

async function handleTrustScore(args: Record<string, unknown> | undefined) {
  const packageName = String(args?.package ?? '');
  if (!packageName) {
    return errorResponse('Missing required parameter: "package".');
  }

  const version = String(args?.version ?? 'latest');
  const report = await buildTrustReport(packageName, version);
  return successResponse(report);
}

async function handleBlastRadius(args: Record<string, unknown> | undefined) {
  const packageName = String(args?.package ?? '');
  if (!packageName) {
    return errorResponse('Missing required parameter: "package".');
  }

  const dir = resolve(String(args?.dir ?? process.cwd()));
  const result = await blastRadiusCalc.calculate(packageName, dir);
  return successResponse(result);
}

async function handleZombies(args: Record<string, unknown> | undefined) {
  const dir = resolve(String(args?.dir ?? process.cwd()));

  const tree = await parseProject(dir);
  if (!tree) {
    return errorResponse(
      `No supported manifest file found in "${dir}".`,
    );
  }

  const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
  const zombies: Array<{
    package: string;
    version: string;
    severity: string;
    reason: string;
    lastActivity: string | null;
  }> = [];

  for (const node of directNodes) {
    const results = await orchestrator.collectAll(node.name, node.version);
    const zombie = zombieDetector.detect(
      results.registry.data,
      results.github.data,
    );

    if (zombie.isZombie) {
      zombies.push({
        package: node.name,
        version: node.version,
        severity: zombie.severity,
        reason: zombie.reason,
        lastActivity: zombie.lastActivity?.toISOString() ?? null,
      });
    }
  }

  if (zombies.length === 0) {
    return successResponse({
      message: 'No zombie dependencies detected.',
      zombies: [],
    });
  }

  return successResponse({
    message: `Found ${zombies.length} zombie dependency(ies).`,
    zombies,
  });
}

async function handleSuggestMigration(args: Record<string, unknown> | undefined) {
  const packageName = String(args?.package ?? '');
  if (!packageName) {
    return errorResponse('Missing required parameter: "package".');
  }

  const suggestions = migrationAdvisor.suggest(packageName, 'manual query');

  if (suggestions.length === 0) {
    return successResponse({
      package: packageName,
      message: `No migration suggestions found for "${packageName}". ` +
        'This package may not have known alternatives in our database.',
      suggestions: [],
    });
  }

  return successResponse({
    package: packageName,
    suggestions,
  });
}

async function handleTyposquatCheck(args: Record<string, unknown> | undefined) {
  const packageName = String(args?.package ?? '');
  if (!packageName) {
    return errorResponse('Missing required parameter: "package".');
  }

  const result = typosquatDetector.check(packageName);
  return successResponse({
    package: packageName,
    ...result,
  });
}

async function handleCompare(args: Record<string, unknown> | undefined) {
  const packageA = String(args?.packageA ?? '');
  const packageB = String(args?.packageB ?? '');

  if (!packageA || !packageB) {
    return errorResponse('Missing required parameters: "packageA" and "packageB".');
  }

  const [reportA, reportB] = await Promise.all([
    buildTrustReport(packageA, 'latest'),
    buildTrustReport(packageB, 'latest'),
  ]);

  return successResponse({
    comparison: {
      packageA: reportA,
      packageB: reportB,
      winner:
        reportA.trustScore > reportB.trustScore
          ? packageA
          : reportA.trustScore < reportB.trustScore
            ? packageB
            : 'tie',
      scoreDifference: Math.abs(reportA.trustScore - reportB.trustScore),
    },
  });
}

async function handleReport(args: Record<string, unknown> | undefined) {
  const dir = resolve(String(args?.dir ?? process.cwd()));
  const output = args?.output ? resolve(String(args.output)) : null;

  const tree = await parseProject(dir);
  if (!tree) {
    return errorResponse(
      `No supported manifest file found in "${dir}".`,
    );
  }

  // Build import graph for blast radius
  const importGraph = await buildImportGraph(dir);

  // Collect trust reports for direct dependencies
  const directNodes = Array.from(tree.nodes.values()).filter((n) => n.isDirect);
  const reports: TrustReport[] = [];

  for (const node of directNodes) {
    const blastRadius = getBlastRadius(node.name, importGraph);
    const report = await buildTrustReport(node.name, node.version, blastRadius);
    reports.push(report);
  }

  const overallScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((sum, r) => sum + r.trustScore, 0) / reports.length,
        )
      : 0;

  const zombieCount = reports.filter((r) => r.isZombie).length;
  const criticalCount = reports.filter((r) => r.trustScore < 50).length;
  const summary =
    `Scanned ${reports.length} direct dependencies. ` +
    `Overall trust score: ${overallScore}/100. ` +
    `${zombieCount} zombie(s) detected. ` +
    `${criticalCount} package(s) below trust threshold.`;

  const scanResult: ScanResult = {
    tree,
    reports,
    overallScore,
    summary,
  };

  const jsonContent = jsonReporter.report(scanResult);

  if (output) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(output, jsonContent, 'utf-8');
    return successResponse({
      message: `Report written to ${output}`,
      path: output,
    });
  }

  return successResponse(jsonContent);
}
