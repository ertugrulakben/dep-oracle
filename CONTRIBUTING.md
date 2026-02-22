# Contributing to dep-oracle

Thank you for your interest in contributing to dep-oracle! This guide will help you get started.

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10+ (or pnpm)
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ertugrulakben/dep-oracle.git
cd dep-oracle

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run in development mode (watch)
npm run dev
```

### Environment Variables (Optional)

```bash
# GitHub token for higher API rate limits (5000 req/hr vs 60 req/hr)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Enable debug logging
export DEP_ORACLE_DEBUG=true
```

## Project Structure

```
src/
├── cli/          # CLI entry point and commands
├── parsers/      # Manifest file parsers
├── collectors/   # API data collectors
├── analyzers/    # Analysis engines
├── reporters/    # Output formatters
├── mcp/          # MCP server for Claude Code
├── cache/        # SQLite caching
└── utils/        # Shared utilities
```

## How to Contribute

### Adding a New Collector

1. Create `src/collectors/your-collector.ts`
2. Extend `BaseCollector` class
3. Implement `collect(packageName: string)` method
4. Return `CollectorResult<YourDataType>`
5. Register in `src/collectors/orchestrator.ts`
6. Add tests in `test/collectors/your-collector.test.ts`

### Adding a New Parser

1. Create `src/parsers/your-parser.ts`
2. Extend `BaseParser` class
3. Implement `parse(manifestPath: string)` method
4. Return `DependencyTree`
5. Register in CLI auto-detection logic
6. Add test fixtures in `test/fixtures/`

### Adding a New Reporter

1. Create `src/reporters/your-reporter.ts`
2. Implement `report(results: TrustReport[])` method
3. Register as a `--format` option in CLI

## Coding Standards

- **Language:** TypeScript strict mode
- **Module system:** ESM (`import`/`export`)
- **All code and comments in English**
- **Error handling:** Every external API call must have try-catch with graceful degradation
- **Caching:** All API responses cached in SQLite with 24hr TTL
- **Testing:** Every new feature needs tests

## Branch Naming

```
feat/add-cargo-parser
fix/github-rate-limit-handling
docs/update-readme-examples
refactor/trust-score-algorithm
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Cargo.toml parser for Rust projects
fix: handle GitHub API 403 gracefully
docs: add MCP setup instructions
refactor: extract scoring logic into separate module
test: add zombie detector edge cases
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes with tests
4. Run `npm run build && npm test` to verify
5. Submit a PR with a clear description

## Code of Conduct

This project follows the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be kind, respectful, and constructive.

## Questions?

Open a [discussion](https://github.com/ertugrulakben/dep-oracle/discussions) or reach out at i@ertugrulakben.com.
