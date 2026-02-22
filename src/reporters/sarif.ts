import type { ScanResult, TrustReport } from "../parsers/schema.js";
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', '..', 'package.json');
const PKG_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version as string;
  } catch {
    return '1.2.0';
  }
})();

// ---------------------------------------------------------------------------
// SARIF 2.1.0 type subset (only what we emit)
// ---------------------------------------------------------------------------

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri?: string;
  defaultConfiguration?: {
    level: SarifLevel;
  };
  properties?: Record<string, unknown>;
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations?: SarifLocation[];
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
    };
  };
}

type SarifLevel = "error" | "warning" | "note" | "none";

// ---------------------------------------------------------------------------
// Rule ID constants
// ---------------------------------------------------------------------------

const RULE_LOW_TRUST = "dep-oracle/low-trust-score";
const RULE_ZOMBIE = "dep-oracle/zombie-dependency";
const RULE_TYPOSQUAT = "dep-oracle/typosquat-risk";

// ---------------------------------------------------------------------------
// SarifReporter
// ---------------------------------------------------------------------------

/**
 * Generate a SARIF 2.1.0 JSON log suitable for upload to GitHub's
 * Code Scanning / Security tab via `github/codeql-action/upload-sarif`.
 */
export class SarifReporter {
  report(result: ScanResult): string {
    const rules = this.buildRules();
    const results = this.buildResults(result);

    const sarif: SarifLog = {
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "dep-oracle",
              version: PKG_VERSION,
              informationUri: "https://github.com/ertugrulakben/dep-oracle",
              rules,
            },
          },
          results,
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  // -------------------------------------------------------------------------
  // Rule definitions
  // -------------------------------------------------------------------------

  private buildRules(): SarifRule[] {
    return [
      {
        id: RULE_LOW_TRUST,
        name: "LowTrustScore",
        shortDescription: {
          text: "Dependency has a low trust score indicating potential supply-chain risk.",
        },
        helpUri: "https://github.com/ertugrulakben/dep-oracle#trust-score",
        defaultConfiguration: { level: "warning" },
      },
      {
        id: RULE_ZOMBIE,
        name: "ZombieDependency",
        shortDescription: {
          text: "Dependency appears to be abandoned with no recent maintenance activity.",
        },
        helpUri: "https://github.com/ertugrulakben/dep-oracle#zombie-detection",
        defaultConfiguration: { level: "warning" },
      },
      {
        id: RULE_TYPOSQUAT,
        name: "TyposquatRisk",
        shortDescription: {
          text: "Package name is suspiciously similar to a popular package (potential typosquat).",
        },
        helpUri: "https://github.com/ertugrulakben/dep-oracle#typosquatting",
        defaultConfiguration: { level: "error" },
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Result generation
  // -------------------------------------------------------------------------

  private buildResults(result: ScanResult): SarifResult[] {
    const reports = result.reports ?? [];
    const manifest = result.tree?.manifest ?? "package.json";
    const sarifResults: SarifResult[] = [];

    for (const report of reports) {
      // Low trust score results
      const score = report.trustScore ?? 100;
      if (score < 80) {
        sarifResults.push(this.buildLowTrustResult(report, manifest));
      }

      // Zombie results
      if (report.isZombie) {
        sarifResults.push(this.buildZombieResult(report, manifest));
      }

      // Typosquat results
      if ((report.typosquatRisk ?? 0) > 0.5) {
        sarifResults.push(this.buildTyposquatResult(report, manifest));
      }
    }

    return sarifResults;
  }

  private buildLowTrustResult(report: TrustReport, manifest: string): SarifResult {
    const score = report.trustScore ?? 0;
    const level: SarifLevel = score < 50 ? "error" : "warning";

    return {
      ruleId: RULE_LOW_TRUST,
      level,
      message: {
        text: `Package "${report.package}@${report.version}" has a trust score of ${score}/100.${this.alternativesHint(report)}`,
      },
      locations: [this.manifestLocation(manifest)],
      properties: {
        package: report.package,
        version: report.version,
        trustScore: score,
        metrics: report.metrics,
      },
    };
  }

  private buildZombieResult(report: TrustReport, manifest: string): SarifResult {
    return {
      ruleId: RULE_ZOMBIE,
      level: "warning",
      message: {
        text: `Package "${report.package}@${report.version}" appears to be abandoned (zombie dependency).${this.alternativesHint(report)}`,
      },
      locations: [this.manifestLocation(manifest)],
      properties: {
        package: report.package,
        version: report.version,
      },
    };
  }

  private buildTyposquatResult(report: TrustReport, manifest: string): SarifResult {
    const pct = Math.round((report.typosquatRisk ?? 0) * 100);
    return {
      ruleId: RULE_TYPOSQUAT,
      level: "error",
      message: {
        text: `Package "${report.package}" has a ${pct}% probability of being a typosquat.`,
      },
      locations: [this.manifestLocation(manifest)],
      properties: {
        package: report.package,
        version: report.version,
        typosquatRisk: report.typosquatRisk,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private manifestLocation(manifest: string): SarifLocation {
    return {
      physicalLocation: {
        artifactLocation: {
          uri: manifest,
        },
      },
    };
  }

  private alternativesHint(report: TrustReport): string {
    const alts = report.alternatives ?? [];
    if (alts.length === 0) return "";
    return ` Consider alternatives: ${alts.join(", ")}.`;
  }
}
