import chalk from "chalk";
import Table from "cli-table3";
import type { ScanResult } from "../parsers/schema.js";

// ---------------------------------------------------------------------------
// Score classification helpers
// ---------------------------------------------------------------------------

type ScoreLevel = "SAFE" | "WARNING" | "CRITICAL";

function classifyScore(score: number): ScoreLevel {
  if (score >= 80) return "SAFE";
  if (score >= 50) return "WARNING";
  return "CRITICAL";
}

function colorScore(score: number): string {
  const level = classifyScore(score);
  const text = String(score);
  switch (level) {
    case "SAFE":
      return chalk.green(text);
    case "WARNING":
      return chalk.yellow(text);
    case "CRITICAL":
      return chalk.red(text);
  }
}

function statusBadge(score: number): string {
  const level = classifyScore(score);
  switch (level) {
    case "SAFE":
      return chalk.green("\u2713 SAFE");
    case "WARNING":
      return chalk.yellow("! WARNING");
    case "CRITICAL":
      return chalk.red("\u2717 CRITICAL");
  }
}

function levelColor(score: number): typeof chalk {
  const level = classifyScore(score);
  switch (level) {
    case "SAFE":
      return chalk.green;
    case "WARNING":
      return chalk.yellow;
    case "CRITICAL":
      return chalk.red;
  }
}

// ---------------------------------------------------------------------------
// TerminalReporter
// ---------------------------------------------------------------------------

export class TerminalReporter {
  /**
   * Print a fully-formatted dependency trust report to stdout.
   * The output is colored and table-formatted for direct terminal use.
   */
  report(result: ScanResult): void {
    const output = this.format(result);
    process.stdout.write(output + "\n");
  }

  /**
   * Build the formatted report string without printing it.
   * Useful for testing or piping to other destinations.
   */
  format(result: ScanResult): string {
    const lines: string[] = [];

    lines.push(this.buildHeader(result));
    lines.push(this.buildOverallScore(result));
    lines.push(this.buildTable(result));

    const zombieSection = this.buildZombieWarnings(result);
    if (zombieSection) lines.push(zombieSection);

    const typosquatSection = this.buildTyposquatWarnings(result);
    if (typosquatSection) lines.push(typosquatSection);

    const migrationSection = this.buildMigrationSuggestions(result);
    if (migrationSection) lines.push(migrationSection);

    const summarySection = this.buildSummary(result);
    if (summarySection) lines.push(summarySection);

    lines.push(this.buildFooter());

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Section builders
  // -------------------------------------------------------------------------

  private buildHeader(result: ScanResult): string {
    const tree = result.tree;
    const projectName = tree?.root ?? "unknown";
    const date = new Date().toISOString().split("T")[0];
    const direct = tree?.totalDirect ?? 0;
    const transitive = tree?.totalTransitive ?? 0;

    const divider = chalk.gray("=".repeat(60));
    const title = chalk.bold.cyan("dep-oracle") + chalk.gray(" \u2014 Dependency Trust Report");
    const meta = chalk.gray(
      `Project: ${chalk.white(projectName)} | Date: ${chalk.white(date)} | Dependencies: ${chalk.white(String(direct))} direct, ${chalk.white(String(transitive))} transitive`,
    );

    return `\n${divider}\n  ${title}\n  ${meta}\n${divider}`;
  }

  private buildOverallScore(result: ScanResult): string {
    const score = result.overallScore ?? 0;
    const level = classifyScore(score);
    const colorFn = levelColor(score);

    const bar = this.progressBar(score, 30);
    return `\n  Overall Trust Score: ${colorFn.bold(`${score}/100`)} [${colorFn(level)}]\n  ${bar}`;
  }

  private buildTable(result: ScanResult): string {
    const reports = result.reports ?? [];
    if (reports.length === 0) {
      return chalk.gray("\n  No packages analyzed.\n");
    }

    // Sort by score ascending (worst first)
    const sorted = [...reports].sort((a, b) => (a.trustScore ?? 0) - (b.trustScore ?? 0));

    const table = new Table({
      head: [
        chalk.bold("Package"),
        chalk.bold("Score"),
        chalk.bold("Status"),
        chalk.bold("Zombie"),
        chalk.bold("Blast Radius"),
        chalk.bold("Trend"),
      ],
      style: {
        head: [],
        border: ["gray"],
      },
      colWidths: [30, 8, 14, 8, 14, 12],
      wordWrap: true,
    });

    for (const report of sorted) {
      const score = report.trustScore ?? 0;
      const zombie = report.isZombie ? chalk.red("Yes") : chalk.green("No");
      const blast = `${report.blastRadius ?? 0} files`;
      const trend = this.trendIndicator(report.trend);

      table.push([
        report.package ?? "unknown",
        colorScore(score),
        statusBadge(score),
        zombie,
        blast,
        trend,
      ]);
    }

    return "\n" + table.toString();
  }

  private buildZombieWarnings(result: ScanResult): string | null {
    const reports = result.reports ?? [];
    const zombies = reports.filter((r) => r.isZombie);
    if (zombies.length === 0) return null;

    const lines: string[] = [];
    lines.push(chalk.yellow.bold("\n  Zombie Dependencies Detected:"));
    for (const z of zombies) {
      lines.push(
        chalk.yellow(`    - ${z.package}@${z.version} (inactive / potentially abandoned)`),
      );
    }
    return lines.join("\n");
  }

  private buildTyposquatWarnings(result: ScanResult): string | null {
    const reports = result.reports ?? [];
    const risky = reports.filter((r) => (r.typosquatRisk ?? 0) > 0.5);
    if (risky.length === 0) return null;

    const lines: string[] = [];
    lines.push(chalk.red.bold("\n  Typosquat Risk Detected:"));
    for (const r of risky) {
      const pct = Math.round((r.typosquatRisk ?? 0) * 100);
      lines.push(
        chalk.red(`    - ${r.package} (${pct}% risk)`),
      );
    }
    return lines.join("\n");
  }

  private buildMigrationSuggestions(result: ScanResult): string | null {
    const reports = result.reports ?? [];
    const critical = reports.filter(
      (r) => (r.trustScore ?? 0) < 50 && (r.alternatives?.length ?? 0) > 0,
    );
    if (critical.length === 0) return null;

    const lines: string[] = [];
    lines.push(chalk.cyan.bold("\n  Migration Suggestions:"));
    for (const r of critical) {
      const alts = (r.alternatives ?? []).join(", ");
      lines.push(
        chalk.cyan(`    - ${r.package} -> consider: ${alts}`),
      );
    }
    return lines.join("\n");
  }

  private buildSummary(result: ScanResult): string | null {
    const summary = result.summary;
    if (!summary) return null;

    return `\n  ${chalk.gray("Summary:")} ${summary}`;
  }

  private buildFooter(): string {
    const lines: string[] = [];

    if (!process.env["GITHUB_TOKEN"]) {
      lines.push(
        chalk.gray("\n  Tip: Set GITHUB_TOKEN environment variable for better rate limits."),
      );
    }

    lines.push(chalk.gray("\n  " + "=".repeat(60)));
    lines.push(chalk.gray("  Generated by dep-oracle | https://github.com/ertugrulakben/dep-oracle\n"));

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Visual helpers
  // -------------------------------------------------------------------------

  private progressBar(score: number, width: number): string {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    const colorFn = levelColor(score);
    const filledStr = colorFn("\u2588".repeat(filled));
    const emptyStr = chalk.gray("\u2591".repeat(empty));
    return `[${filledStr}${emptyStr}]`;
  }

  private trendIndicator(trend?: string): string {
    switch (trend) {
      case "rising":
        return chalk.green("\u2191 Rising");
      case "stable":
        return chalk.gray("\u2192 Stable");
      case "declining":
        return chalk.red("\u2193 Declining");
      default:
        return chalk.gray("-");
    }
  }
}
