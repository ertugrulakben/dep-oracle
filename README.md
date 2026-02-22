# dep-oracle 🔮

> Your dependencies have dependencies. Who's watching them?

**dep-oracle** is a predictive dependency security engine that calculates **Trust Scores** (0-100) for every package in your dependency tree. It detects zombie dependencies, measures blast radius, catches typosquatting attempts, and predicts future risks — before they become vulnerabilities.

[![npm version](https://img.shields.io/npm/v/dep-oracle.svg)](https://www.npmjs.com/package/dep-oracle)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why?

- **62% of breaches** in 2025 came from supply chain attacks
- The average project has **683 transitive dependencies**
- `npm audit` only catches **known** CVEs — dep-oracle **predicts** future risks
- You audit your code. But do you audit your **trust**?

**Claude Code Security** scans YOUR code. **dep-oracle** scans everything your code **depends on**.

## Quick Start

```bash
# Zero install — just run it
npx dep-oracle

# Or install globally
npm install -g dep-oracle
dep-oracle scan
```

## What It Does

| Feature | Description |
|---------|-------------|
| **Trust Score** | 0-100 weighted score per package (maintainer health, security, activity, popularity, funding, license) |
| **Zombie Detection** | Finds unmaintained but critical packages (no commits in 12+ months) |
| **Blast Radius** | Shows how many files are affected if a dependency is compromised |
| **Typosquat Detection** | Catches suspicious package names similar to popular packages |
| **Trend Prediction** | 3-month risk projection based on download/commit trends |
| **Migration Advisor** | Suggests safer alternatives for risky dependencies |
| **Offline Mode** | Works from cache without internet (`--offline`) |

## Usage

```bash
# Scan current project
dep-oracle scan

# Scan with specific output
dep-oracle scan --format json
dep-oracle scan --format html
dep-oracle scan --format sarif

# Check a single package
dep-oracle check lodash

# Offline mode (uses cached data)
dep-oracle scan --offline

# Set minimum score threshold (CI/CD)
dep-oracle scan --threshold 60

# Ignore specific packages
dep-oracle scan --ignore deprecated-but-needed,legacy-pkg
```

## Output Example

```
🔮 dep-oracle v1.0.0
Scanning package.json...
Found 47 direct dependencies, 683 transitive
Collecting data... [=============================] 100% (2.3s)

DEPENDENCY TRUST REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 CRITICAL (score < 50)

  ■ event-stream@3.3.6         Score: 12  💀 ZOMBIE
    Last commit: 2018 | 0 maintainers active
    Blast radius: 14 files | Alternative: highland

⚠  WARNING (score 50-79)

  ■ moment@2.29.4              Score: 58  💀 ZOMBIE
    Maintenance mode | No new features
    Blast radius: 23 files | Alternative: dayjs

✅ SAFE (score 80+): 679 packages

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
  Overall Trust Score: 74/100
  Critical: 2 | Warning: 3 | Safe: 679
  Zombies: 2 | Deprecated: 1
```

## Trust Score Algorithm

Each package is scored 0-100 based on six weighted metrics:

| Metric | Weight | What It Measures |
|--------|--------|------------------|
| Security History | 25% | CVE count, average patch time, vulnerability density |
| Maintainer Health | 25% | Active maintainers (bus factor), issue response time, PR merge speed |
| Activity | 20% | Commit frequency trend, release cadence, last publish date |
| Popularity | 15% | Weekly downloads, dependent count, GitHub stars |
| Funding | 10% | GitHub Sponsors, OpenCollective, corporate backing |
| License | 5% | MIT/Apache = safe, GPL = risk, Unknown = red flag |

**Score Ranges:** 80-100 ✅ Safe | 50-79 ⚠️ Warning | 0-49 🚫 Critical

## Claude Code Integration (MCP)

dep-oracle works as an MCP server for Claude Code:

```json
// .claude/settings.json
{
  "mcpServers": {
    "dep-oracle": {
      "command": "npx",
      "args": ["dep-oracle", "mcp"]
    }
  }
}
```

Then in Claude Code, just ask:
- "What's the riskiest dependency in this project?"
- "Is lodash safe to use?"
- "Show me zombie dependencies"

## GitHub Action

```yaml
name: Dependency Trust Check
on: [pull_request]

jobs:
  dep-oracle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ertugrulakben/dep-oracle-action@v1
        with:
          threshold: 60
          format: sarif
```

## Configuration

Create `.dep-oraclerc.json` in your project root:

```json
{
  "threshold": 60,
  "ignore": ["known-risky-but-needed"],
  "format": "terminal",
  "offline": false,
  "githubToken": "$GITHUB_TOKEN",
  "cacheTtl": 86400
}
```

Or add to `package.json`:

```json
{
  "dep-oracle": {
    "threshold": 60,
    "ignore": []
  }
}
```

## Supported Package Managers

| Manager | Manifest | Lock File | Status |
|---------|----------|-----------|--------|
| npm | `package.json` | `package-lock.json` | ✅ Supported |
| yarn | `package.json` | `yarn.lock` | ✅ Supported |
| pnpm | `package.json` | `pnpm-lock.yaml` | ✅ Supported |
| pip | `requirements.txt` | `Pipfile.lock` | ✅ Supported |
| poetry | `pyproject.toml` | `poetry.lock` | ✅ Supported |

## Comparison

| Feature | npm audit | Dependabot | Socket.dev | Snyk | **dep-oracle** |
|---------|-----------|------------|------------|------|----------------|
| Known CVE scan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Predictive risk | ❌ | ❌ | Partial | ❌ | **✅** |
| Trust Score (0-100) | ❌ | ❌ | ❌ | ❌ | **✅** |
| Zombie detection | ❌ | ❌ | ❌ | ❌ | **✅** |
| Blast radius | ❌ | ❌ | ❌ | ❌ | **✅** |
| Typosquat detection | ❌ | ❌ | ✅ | ❌ | **✅** |
| Trend prediction | ❌ | ❌ | ❌ | ❌ | **✅** |
| MCP integration | ❌ | ❌ | ✅ | ✅ | **✅** |
| Zero install (npx) | ✅ | ❌ | ❌ | ❌ | **✅** |
| Free | ✅ | ✅ | Freemium | Freemium | **✅** |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and how to add new collectors/parsers.

## License

[MIT](LICENSE) — Ertugrul Akben
