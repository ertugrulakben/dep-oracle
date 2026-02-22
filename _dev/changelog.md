# dep-oracle Changelog

## [1.1.0] - 2026-02-22

### Added
- Typosquat detection expanded to 1,847+ known packages across 40+ categories
- Dynamic npm registry fetch (top 5,000 packages, 7-day cache)
- Migration advisor expanded to 131 package mappings with 192 alternatives
- Poetry.lock parser support for Python projects
- Comprehensive test suite: 10 test files, 144 tests
- Turkish README (README.tr.md)

### Changed
- Trust score security metric: diminishing vulnerability penalty model
- Fast-patch bonus increased to +10 (<=7 days), slow-patch +5 (<=30 days)
- Popularity score recalibrated (10M=100, 1M=90, 100K=75, 10K=60, 1K=40)
- CLI version now dynamically read from package.json
- MCP server and SARIF reporter version now dynamically read from package.json

### Fixed
- Hardcoded version strings replaced with dynamic package.json reading

## [1.0.0] - 2026-02-22

### Added
- Initial release
- npm/yarn/pnpm manifest parser with transitive dependency tree
- Python (requirements.txt, poetry) parser
- 6 data collectors: registry, github, security, funding, popularity, license
- Trust Score engine (0-100 weighted scoring)
- Zombie dependency detector (12+ months inactive)
- Blast radius calculator (import graph analysis)
- Typosquatting detector (Levenshtein distance)
- Trend predictor (3-month risk projection)
- Migration advisor (alternative package suggestions)
- Terminal reporter (colored dependency tree)
- HTML interactive report with D3.js dependency graph
- JSON reporter
- SARIF reporter (GitHub Security tab integration)
- SVG badge generator
- MCP server for Claude Code integration
- GitHub Action for CI/CD
- SQLite cache with 24hr TTL
- Offline mode (`--offline`)
- Graceful degradation (N/A metrics when APIs are down)
- CONTRIBUTING.md, issue templates, Code of Conduct
