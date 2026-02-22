import { z } from "zod";

// ---------------------------------------------------------------------------
// Registry enum
// ---------------------------------------------------------------------------

export const RegistryEnum = z.enum(["npm", "pypi"]);
export type Registry = z.infer<typeof RegistryEnum>;

// ---------------------------------------------------------------------------
// DependencyNode
// ---------------------------------------------------------------------------

export const DependencyNodeSchema = z.object({
  /** Package name (e.g. "express", "requests") */
  name: z.string().min(1),
  /** Resolved or declared version string */
  version: z.string(),
  /** 0 = direct dependency, 1+ = transitive depth */
  depth: z.number().int().min(0),
  /** Convenience flag: true when depth === 0 */
  isDirect: z.boolean(),
  /** Parent package name, null for direct deps */
  parent: z.string().nullable(),
  /** Which registry this package comes from */
  registry: RegistryEnum,
});

export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

// ---------------------------------------------------------------------------
// DependencyTree
// ---------------------------------------------------------------------------

export const DependencyTreeSchema = z.object({
  /** Project / root package name */
  root: z.string(),
  /** Absolute path to the manifest file that was parsed */
  manifest: z.string(),
  /** All resolved dependency nodes keyed by "name@version" */
  nodes: z.map(z.string(), DependencyNodeSchema),
  /** Count of direct dependencies (depth === 0) */
  totalDirect: z.number().int().min(0),
  /** Count of transitive dependencies (depth > 0) */
  totalTransitive: z.number().int().min(0),
});

export type DependencyTree = z.infer<typeof DependencyTreeSchema>;

// ---------------------------------------------------------------------------
// CollectorResult<T> — generic wrapper for any data-fetching operation
// ---------------------------------------------------------------------------

export const CollectorStatusEnum = z.enum(["success", "error", "cached", "offline"]);
export type CollectorStatus = z.infer<typeof CollectorStatusEnum>;

export function CollectorResultSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    status: CollectorStatusEnum,
    data: dataSchema.nullable(),
    error: z.string().optional(),
    collectedAt: z.string().datetime().optional(),
  });
}

export interface CollectorResult<T> {
  status: CollectorStatus;
  data: T | null;
  error?: string;
  collectedAt?: string;
}

// ---------------------------------------------------------------------------
// RegistryData
// ---------------------------------------------------------------------------

export const RegistryDataSchema = z.object({
  /** Package name */
  packageName: z.string(),
  /** Resolved version string */
  version: z.string(),
  /** Short description from the registry */
  description: z.string().nullable(),
  /** ISO-8601 timestamp of the last publish, null if unknown */
  lastPublishDate: z.string().nullable(),
  /** Total number of published versions */
  versionCount: z.number().int().min(0),
  /** Deprecation message string, null if not deprecated */
  deprecated: z.string().nullable(),
  /** Downloads in the last 7 days */
  weeklyDownloads: z.number().int().min(0),
  /** SPDX license identifier from the registry */
  license: z.string().nullable(),
  /** Normalised repository URL */
  repositoryUrl: z.string().nullable(),
});

export type RegistryData = z.infer<typeof RegistryDataSchema>;

// ---------------------------------------------------------------------------
// GitHubData
// ---------------------------------------------------------------------------

export const GitHubDataSchema = z.object({
  /** GitHub repository owner */
  owner: z.string(),
  /** GitHub repository name */
  repo: z.string(),
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
  openIssues: z.number().int().min(0),
  /** ISO-8601 timestamp of the last repo update */
  updatedAt: z.string(),
  /** Whether the repository is archived */
  archived: z.boolean(),
  /** Default branch name */
  defaultBranch: z.string(),
  contributorCount: z.number().int().min(0),
  /** Number of commits in the last 30 days */
  recentCommitCount: z.number().int().min(0),
  /** ISO-8601 timestamp of the most recent commit, null if unknown */
  lastCommitDate: z.string().nullable(),
  /** SHA of the most recent commit, null if unknown */
  lastCommitSha: z.string().nullable(),
  /** Whether a .github/FUNDING.yml file exists */
  hasFundingYml: z.boolean(),
});

export type GitHubData = z.infer<typeof GitHubDataSchema>;

// ---------------------------------------------------------------------------
// SecurityData
// ---------------------------------------------------------------------------

export const VulnerabilityEntrySchema = z.object({
  id: z.string(),
  summary: z.string().nullable(),
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  published: z.string(),
});

export type VulnerabilityEntry = z.infer<typeof VulnerabilityEntrySchema>;

export const SecurityDataSchema = z.object({
  /** Package name */
  packageName: z.string(),
  /** Resolved version string */
  version: z.string(),
  /** Total number of known vulnerabilities */
  totalVulnerabilities: z.number().int().min(0),
  /** Vulnerability counts by severity level */
  severityCounts: z.record(z.string(), z.number().int().min(0)),
  /** ISO-8601 timestamp of the most recent vulnerability, null if none */
  latestVulnDate: z.string().nullable(),
  /** Average days from disclosure to patch, null when unknown */
  averagePatchDays: z.number().nullable(),
  /** List of individual vulnerabilities */
  vulnerabilities: z.array(VulnerabilityEntrySchema),
});

export type SecurityData = z.infer<typeof SecurityDataSchema>;

// ---------------------------------------------------------------------------
// FundingData
// ---------------------------------------------------------------------------

export const FundingDataSchema = z.object({
  /** Package name */
  packageName: z.string(),
  /** Whether GitHub sponsors exist (via FUNDING.yml) */
  hasSponsors: z.boolean(),
  /** Whether an OpenCollective profile is active */
  hasOpenCollective: z.boolean(),
  /** Whether the npm registry "funding" field is set */
  hasNpmFunding: z.boolean(),
  /** OpenCollective slug, null if none */
  openCollectiveSlug: z.string().nullable(),
  /** Number of OpenCollective backers */
  openCollectiveBackers: z.number().int().min(0),
  /** Rough USD estimate of annual funding, 0 when unknown */
  estimatedAnnualFunding: z.number().min(0),
  /** Collected funding URLs from all sources */
  fundingUrls: z.array(z.string()),
});

export type FundingData = z.infer<typeof FundingDataSchema>;

// ---------------------------------------------------------------------------
// PopularityData
// ---------------------------------------------------------------------------

export const DownloadTrendEnum = z.enum(["rising", "stable", "declining"]);
export type DownloadTrend = z.infer<typeof DownloadTrendEnum>;

export const PopularityDataSchema = z.object({
  /** Package name */
  packageName: z.string(),
  /** Downloads in the last 7 days */
  weeklyDownloads: z.number().int().min(0),
  /** Downloads in the last 30 days */
  monthlyDownloads: z.number().int().min(0),
  /** Download trend direction */
  trend: DownloadTrendEnum,
  /** Number of packages that depend on this one */
  dependentCount: z.number().int().min(0),
});

export type PopularityData = z.infer<typeof PopularityDataSchema>;

// ---------------------------------------------------------------------------
// LicenseData
// ---------------------------------------------------------------------------

export const LicenseRiskEnum = z.enum(["safe", "cautious", "risky", "unknown"]);
export type LicenseRisk = z.infer<typeof LicenseRiskEnum>;

export const LicenseDataSchema = z.object({
  /** Package name */
  packageName: z.string(),
  /** Resolved version string */
  version: z.string(),
  /** Raw license string from the registry */
  raw: z.string().nullable(),
  /** Normalised SPDX identifier, null if unrecognised */
  spdx: z.string().nullable(),
  /** Risk classification */
  risk: LicenseRiskEnum,
  /** Whether the license is OSI-approved */
  osiApproved: z.boolean(),
});

export type LicenseData = z.infer<typeof LicenseDataSchema>;

// ---------------------------------------------------------------------------
// TrustMetrics  (each dimension scored 0-100)
// ---------------------------------------------------------------------------

const scoreField = z.number().min(0).max(100);

export const TrustMetricsSchema = z.object({
  security: scoreField,
  maintainer: scoreField,
  activity: scoreField,
  popularity: scoreField,
  funding: scoreField,
  license: scoreField,
});

export type TrustMetrics = z.infer<typeof TrustMetricsSchema>;

// ---------------------------------------------------------------------------
// TrustReport  (per-package output of the analysis pipeline)
// ---------------------------------------------------------------------------

export const TrustReportSchema = z.object({
  /** Package name */
  package: z.string(),
  /** Analyzed version */
  version: z.string(),
  /** Weighted overall score 0-100 */
  trustScore: scoreField,
  /** Breakdown by dimension */
  metrics: TrustMetricsSchema,
  /** True when the package shows signs of abandonment */
  isZombie: z.boolean(),
  /** Number of project files that import this package */
  blastRadius: z.number().int().min(0),
  /** Suggested replacement packages if the score is low */
  alternatives: z.array(z.string()),
  /** Download trend for quick triage */
  trend: DownloadTrendEnum,
  /** Probability (0-1) that the package name is a typosquat */
  typosquatRisk: z.number().min(0).max(1),
});

export type TrustReport = z.infer<typeof TrustReportSchema>;

// ---------------------------------------------------------------------------
// ScanResult  (top-level output of a full scan)
// ---------------------------------------------------------------------------

export const ScanResultSchema = z.object({
  tree: DependencyTreeSchema,
  reports: z.array(TrustReportSchema),
  /** Weighted average of all package trust scores */
  overallScore: scoreField,
  /** Human-readable summary paragraph */
  summary: z.string(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

// ---------------------------------------------------------------------------
// Config  (user-facing configuration via cosmiconfig / .dep-oraclerc etc.)
// ---------------------------------------------------------------------------

export const ConfigSchema = z.object({
  /** Minimum trust score before a warning is emitted */
  minTrustScore: z.number().min(0).max(100).default(50),

  /** How long collector responses are cached, in seconds */
  cacheTtl: z.number().int().min(0).default(86_400),

  /** GitHub personal access token (increases rate limit) */
  githubToken: z.string().optional(),

  /** Packages to exclude from scanning */
  ignore: z.array(z.string()).default([]),

  /** Weight overrides for the trust-score dimensions (must sum to ~1) */
  weights: z
    .object({
      security: z.number().min(0).max(1).default(0.30),
      maintainer: z.number().min(0).max(1).default(0.20),
      activity: z.number().min(0).max(1).default(0.15),
      popularity: z.number().min(0).max(1).default(0.15),
      funding: z.number().min(0).max(1).default(0.10),
      license: z.number().min(0).max(1).default(0.10),
    })
    .default({}),

  /** Maximum concurrent network requests */
  concurrency: z.number().int().min(1).max(20).default(6),

  /** Registries to query */
  registries: z.array(RegistryEnum).default(["npm"]),

  /** Output format */
  outputFormat: z.enum(["table", "json", "markdown"]).default("table"),

  /** Days of inactivity after which a package is considered a zombie */
  zombieThresholdDays: z.number().int().min(1).default(365),

  /** Enable offline mode (only use cache, never hit network) */
  offline: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Convenience factory helpers
// ---------------------------------------------------------------------------

/** Create a DependencyNode with sensible defaults. */
export function createDependencyNode(
  partial: Pick<DependencyNode, "name" | "version" | "registry"> &
    Partial<Omit<DependencyNode, "name" | "version" | "registry">>,
): DependencyNode {
  return {
    depth: 0,
    isDirect: partial.depth === undefined || partial.depth === 0,
    parent: null,
    ...partial,
  };
}

/** Create an empty DependencyTree for a project. */
export function createDependencyTree(
  root: string,
  manifest: string,
): DependencyTree {
  return {
    root,
    manifest,
    nodes: new Map(),
    totalDirect: 0,
    totalTransitive: 0,
  };
}

/** Wrap a successful collector response. */
export function collectorSuccess<T>(data: T): CollectorResult<T> {
  return { status: "success", data };
}

/** Wrap a failed collector response. */
export function collectorError<T>(error: string): CollectorResult<T> {
  return { status: "error", data: null, error };
}

/** Wrap a cached collector response. */
export function collectorCached<T>(data: T, collectedAt: string): CollectorResult<T> {
  return { status: "cached", data, collectedAt };
}

/** Wrap an offline collector response. */
export function collectorOffline<T>(): CollectorResult<T> {
  return { status: "offline", data: null, error: "Network unavailable — offline mode" };
}
