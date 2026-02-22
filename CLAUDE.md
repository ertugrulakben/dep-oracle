# dep-oracle - Claude Code Instructions

## Project Overview
dep-oracle is a predictive dependency security engine. It scans project dependencies and calculates Trust Scores (0-100) based on maintainer health, security history, activity, popularity, funding, and license.

## Architecture
5-layer architecture: CLI → Parsers → Collectors → Analyzers → Reporters

## Key Commands
```bash
npm run build     # Build with tsup
npm run test      # Run vitest
npm run dev       # Watch mode
npm run scan      # Run dep-oracle on this project
npm run mcp       # Start MCP server
```

## Code Style
- TypeScript strict mode, ESM modules
- All code, comments, and docs in English
- Use zod for runtime validation
- Use p-limit for concurrent API calls
- Every collector has graceful degradation (never crash on API failure)
- Cache all API responses in SQLite (24hr TTL)

## File Structure
- `src/cli/` — CLI entry point and commands
- `src/parsers/` — Manifest file parsers (npm, python)
- `src/collectors/` — Data collection from APIs (registry, github, security, etc.)
- `src/analyzers/` — Analysis engines (trust score, zombie, blast radius, etc.)
- `src/reporters/` — Output formatters (terminal, html, json, sarif, badge)
- `src/mcp/` — MCP server for Claude Code integration
- `src/cache/` — SQLite caching layer
- `src/utils/` — Shared utilities

## Important Patterns
- All collectors extend `BaseCollector` and return `CollectorResult<T>`
- All parsers extend `BaseParser` and return `DependencyTree`
- Trust Score uses weighted scoring: security(25%) + maintainer(25%) + activity(20%) + popularity(15%) + funding(10%) + license(5%)
- Graceful degradation: if an API is down, that metric becomes N/A and score is calculated from remaining metrics
