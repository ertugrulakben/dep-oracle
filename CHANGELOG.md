# Changelog

## [1.4.0] - 2026-03-14

### Added
- **`dep-oracle fix` command** — Scans your project, identifies risky dependencies that have known safer alternatives, and can automatically replace them. Run `dep-oracle fix` to see what can be improved, `dep-oracle fix --apply --yes` to auto-install easy replacements.
- **`dep-oracle compare` command** — Compare two packages side-by-side with trust scores, metrics breakdown, zombie status, and trend direction. Example: `dep-oracle compare express fastify`.
- **30+ new migration mappings** (161 total, 220+ alternatives) — Added modern replacements:
  - `express` -> hono, fastify, elysia
  - `jest` -> vitest
  - `create-react-app` / `react-scripts` -> vite, next
  - `redux` -> zustand, jotai
  - `joi` / `yup` -> zod, valibot
  - `styled-components` / `@emotion/react` -> tailwindcss, vanilla-extract
  - `eslint` / `prettier` -> biome, oxlint
  - `lerna` -> turborepo, nx
  - `cross-env` / `env-cmd` -> native `node --env-file`
  - `fs-extra` -> native `node:fs/promises`
  - And more...

### Changed
- Migration advisor now covers 161 package mappings with 220+ alternatives (was 131/192).

## [1.3.0] - 2026-03-10

### Added
- Python ecosystem support (pip, poetry, pyproject.toml)
- Rate limiting for GitHub, npm, and PyPI APIs
- Honesty audit: trust score accuracy improvements

## [1.2.0] - 2026-02-22

### Added
- Programmatic API: `import { scan, checkPackage } from 'dep-oracle'`
- 3 new MCP tools (8 total): compare, report, typosquat_check
- GitHub Action improvements

### Security
- Path traversal protection
- Package name validation
- HTML XSS defense-in-depth
- GitHub URL validation

## [1.1.0] - 2026-02-18

### Added
- Typosquat registry expansion (1,847 packages)
- Migration advisor (131 mappings, 192 alternatives)
- Poetry.lock support
- Comprehensive test suite (144 tests)

## [1.0.0] - 2026-02-15

### Added
- Initial release
- Trust score engine (6 weighted metrics)
- npm + Python parsers
- Zombie detection, blast radius, typosquat detection
- Trend prediction, migration advisor
- Terminal, HTML, JSON, SARIF output formats
- MCP server for Claude Code
- GitHub Action for CI/CD
- Offline cache with SQLite
- SVG badge generator
