# dep-oracle Changelog

## [1.2.0] - 2026-02-22

### Security
- MCP tools: path traversal protection on `dir` and `output` arguments
- MCP tools: package name validation (npm naming rules, 214-char limit)
- HTML reporter: metric values escaped with `escapeHtml()` (XSS defense-in-depth)
- GitHub collector: owner/repo format validation in URL parser
- Funding collector: GitHub Sponsors username validation

### Added
- Programmatic API: `scan()` and `checkPackage()` convenience functions exported from `dep-oracle`
- 3 new MCP tools: `dep_oracle_typosquat_check`, `dep_oracle_compare`, `dep_oracle_report` (8 tools total)
- GitHub Action: self-contained bundle via tsup (action now builds and runs correctly)
- `server.json` included in npm package for MCP registry compatibility

### Fixed
- Collector timeout (30s) prevents indefinite hang on slow/unresponsive APIs
- Trust score: weight validation ensures custom weights sum to 1.0
- Trust score: patch bonus only applies when vulnerabilities exist and patches are within 30 days
- Python parser: `#egg=` fragments in git URLs no longer stripped by comment removal
- Typosquat: homoglyph detection expanded to catch 2-character substitutions (e.g. `l0d4sh`)
- Cache: `SyntaxError` (corrupted JSON) handled separately from unexpected I/O errors

### Changed
- Version fallbacks updated to 1.2.0 in CLI, MCP server, SARIF reporter

## [1.1.4] - 2026-02-22

### Fixed
- Removed invalid `"readme"` field from package.json that caused npm to display literal string instead of README content

## [1.1.3] - 2026-02-22

### Fixed
- npm README now correctly shows English README (Turkish README excluded from npm package via prepack/postpack lifecycle scripts)

## [1.1.2] - 2026-02-22

### Fixed
- MCP Registry links updated to official documentation URL

## [1.1.1] - 2026-02-22

### Added
- MCP Registry support (`server.json` + `mcpName` in package.json)
- Listed on MCP Registry: `io.github.ertugrulakben/dep-oracle`

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
