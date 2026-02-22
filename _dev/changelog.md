# dep-oracle Changelog

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
