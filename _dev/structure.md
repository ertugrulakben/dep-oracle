# dep-oracle Project Structure

```
dep-oracle/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── cli/
│   │   ├── index.ts                # CLI entry (commander.js)
│   │   ├── config.ts               # cosmiconfig loader
│   │   └── commands/
│   │       ├── scan.ts             # Main scan command
│   │       └── check.ts            # Single package check
│   ├── parsers/
│   │   ├── schema.ts               # Zod schemas & types
│   │   ├── base.ts                 # Abstract BaseParser
│   │   ├── npm.ts                  # npm/yarn/pnpm parser
│   │   └── python.ts               # pip/poetry parser
│   ├── collectors/
│   │   ├── base.ts                 # Abstract BaseCollector
│   │   ├── orchestrator.ts         # Parallel collection engine
│   │   ├── registry.ts             # npm/PyPI registry API
│   │   ├── github.ts               # GitHub REST API
│   │   ├── security.ts             # OSV.dev + GitHub Advisory
│   │   ├── funding.ts              # Sponsors, OpenCollective
│   │   ├── popularity.ts           # Downloads, dependents
│   │   └── license.ts              # SPDX license checker
│   ├── analyzers/
│   │   ├── trust-score.ts          # Weighted scoring engine
│   │   ├── zombie-detector.ts      # Abandoned package detection
│   │   ├── blast-radius.ts         # Import graph impact analysis
│   │   ├── typosquat.ts            # Name similarity checker
│   │   ├── trend-predictor.ts      # 3-month risk projection
│   │   └── migration-advisor.ts    # Alternative package suggester
│   ├── reporters/
│   │   ├── terminal.ts             # Colored CLI output
│   │   ├── html.ts                 # Interactive HTML report
│   │   ├── json.ts                 # JSON output
│   │   ├── sarif.ts                # SARIF for GitHub Security
│   │   ├── badge.ts                # SVG badge generator
│   │   └── templates/
│   │       └── report.html         # HTML report template
│   ├── mcp/
│   │   ├── server.ts               # MCP stdio server
│   │   └── tools.ts                # MCP tool definitions
│   ├── cache/
│   │   └── sqlite.ts               # SQLite cache layer
│   └── utils/
│       ├── rate-limiter.ts         # API rate limit handler
│       ├── logger.ts               # Structured logging
│       └── graph.ts                # Dependency graph utils
├── action/
│   ├── action.yml                  # GitHub Action definition
│   └── index.ts                    # Action entry point
├── test/
│   └── fixtures/                   # Test manifest files
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── CLAUDE.md
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── _dev/
    ├── changelog.md
    ├── plan.md
    └── structure.md
```
