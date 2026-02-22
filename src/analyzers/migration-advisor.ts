// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MigrationDifficulty = 'easy' | 'moderate' | 'hard';

export interface MigrationSuggestion {
  /** Name of the alternative package. */
  alternative: string;
  /** Short description of the alternative and migration path. */
  description: string;
  /** Estimated difficulty of migrating to this alternative. */
  difficulty: MigrationDifficulty;
}

/** Internal entry in the migration map. */
interface MigrationEntry {
  alternative: string;
  description: string;
  difficulty: MigrationDifficulty;
}

// ---------------------------------------------------------------------------
// Migration map — hardcoded knowledge base of common replacements
// ---------------------------------------------------------------------------

const MIGRATION_MAP: Record<string, MigrationEntry[]> = {
  // Date/time libraries
  'moment': [
    {
      alternative: 'dayjs',
      description: 'Lightweight Moment.js alternative with compatible API. Drop-in replacement for most use cases.',
      difficulty: 'easy',
    },
    {
      alternative: 'date-fns',
      description: 'Modular date utility library. Tree-shakeable, functional API. Requires rewriting date manipulation calls.',
      difficulty: 'moderate',
    },
    {
      alternative: 'luxon',
      description: 'Modern date/time library by a Moment.js maintainer. Immutable, chainable API with timezone support.',
      difficulty: 'moderate',
    },
  ],

  // HTTP client libraries
  'request': [
    {
      alternative: 'got',
      description: 'Feature-rich HTTP client with retry, pagination, and stream support. Promise-based API.',
      difficulty: 'moderate',
    },
    {
      alternative: 'axios',
      description: 'Popular HTTP client for browser and Node.js. Interceptors, transforms, and cancellation support.',
      difficulty: 'easy',
    },
    {
      alternative: 'node-fetch',
      description: 'Lightweight Fetch API implementation for Node.js. Minimal API surface.',
      difficulty: 'moderate',
    },
    {
      alternative: 'undici',
      description: 'Official Node.js HTTP/1.1 client. High performance, built into Node 18+.',
      difficulty: 'moderate',
    },
  ],

  // Color/terminal output
  'colors': [
    {
      alternative: 'chalk',
      description: 'Most popular terminal string styling library. Clean, chainable API.',
      difficulty: 'easy',
    },
    {
      alternative: 'picocolors',
      description: 'Tiny (< 3KB) terminal color library. Fastest option, no dependencies.',
      difficulty: 'easy',
    },
    {
      alternative: 'colorette',
      description: 'Lightweight terminal color library. Similar API to picocolors.',
      difficulty: 'easy',
    },
  ],

  // Compromised packages
  'event-stream': [
    {
      alternative: 'highland',
      description: 'High-level stream library. Manages backpressure and provides functional stream composition.',
      difficulty: 'moderate',
    },
    {
      alternative: 'through2',
      description: 'Thin wrapper around Node.js streams. Simple transform/writable stream creation.',
      difficulty: 'easy',
    },
  ],

  // Utility belts
  'underscore': [
    {
      alternative: 'lodash',
      description: 'Superset of underscore functionality. Drop-in replacement with better performance.',
      difficulty: 'easy',
    },
    {
      alternative: 'ramda',
      description: 'Functional programming utility library. Curried by default, immutable data focus.',
      difficulty: 'hard',
    },
  ],

  'lodash': [
    {
      alternative: 'es-toolkit',
      description: 'Modern TypeScript utility library. Drop-in replacement for common lodash functions, tree-shakeable.',
      difficulty: 'easy',
    },
    {
      alternative: 'ramda',
      description: 'Functional programming utility library. Different paradigm — curried, point-free style.',
      difficulty: 'hard',
    },
    {
      alternative: 'radash',
      description: 'Modern lodash alternative with TypeScript-first design. Smaller bundle, zero dependencies.',
      difficulty: 'moderate',
    },
  ],

  // Build tools
  'bower': [
    {
      alternative: 'npm',
      description: 'Default Node.js package manager. Bower is deprecated — migrate packages to npm.',
      difficulty: 'hard',
    },
    {
      alternative: 'yarn',
      description: 'Alternative package manager with workspaces. Bower packages need to be republished.',
      difficulty: 'hard',
    },
  ],

  // Language / transpilers
  'coffee-script': [
    {
      alternative: 'typescript',
      description: 'Typed superset of JavaScript. Industry standard, excellent tooling support.',
      difficulty: 'hard',
    },
  ],
  'coffeescript': [
    {
      alternative: 'typescript',
      description: 'Typed superset of JavaScript. Industry standard, excellent tooling support.',
      difficulty: 'hard',
    },
  ],

  // Minifiers
  'uglify-js': [
    {
      alternative: 'terser',
      description: 'Fork of uglify-es with ES6+ support. Drop-in replacement for most configurations.',
      difficulty: 'easy',
    },
    {
      alternative: 'esbuild',
      description: 'Extremely fast bundler and minifier written in Go. 10-100x faster than terser.',
      difficulty: 'moderate',
    },
  ],

  // UUID generation
  'node-uuid': [
    {
      alternative: 'uuid',
      description: 'Official successor package. Same maintainers, just renamed. Direct drop-in replacement.',
      difficulty: 'easy',
    },
  ],

  // Code coverage
  'istanbul': [
    {
      alternative: 'nyc',
      description: 'Istanbul CLI wrapper. Easier configuration and integration with test runners.',
      difficulty: 'easy',
    },
    {
      alternative: 'c8',
      description: 'Native V8 code coverage. Uses built-in Node.js coverage, no instrumentation needed.',
      difficulty: 'easy',
    },
  ],

  // Linting
  'tslint': [
    {
      alternative: 'eslint',
      description: 'TSLint is deprecated. Use ESLint with @typescript-eslint/parser for TypeScript linting.',
      difficulty: 'moderate',
    },
  ],

  // Promise libraries
  'bluebird': [
    {
      alternative: 'native-promises',
      description: 'Native Promise API is now performant enough for most use cases. Remove bluebird and use built-in Promise.',
      difficulty: 'moderate',
    },
  ],

  // Test runners
  'mocha': [
    {
      alternative: 'vitest',
      description: 'Vite-native test runner. Fast, ESM-first, Jest-compatible API. Built-in coverage and watch mode.',
      difficulty: 'moderate',
    },
    {
      alternative: 'jest',
      description: 'Zero-config testing framework. Snapshot testing, mocking, and coverage built in.',
      difficulty: 'moderate',
    },
  ],

  // Callback utilities
  'async': [
    {
      alternative: 'p-map',
      description: 'Promise-based concurrent mapping. Use with async/await for cleaner control flow.',
      difficulty: 'moderate',
    },
    {
      alternative: 'p-limit',
      description: 'Promise-based concurrency limiter. Modern replacement for async.parallelLimit.',
      difficulty: 'easy',
    },
  ],

  // Legacy HTTP frameworks
  'restify': [
    {
      alternative: 'fastify',
      description: 'High-performance web framework. Schema-based validation, plugin architecture.',
      difficulty: 'moderate',
    },
    {
      alternative: 'express',
      description: 'Most popular Node.js web framework. Large ecosystem, extensive middleware.',
      difficulty: 'moderate',
    },
  ],

  'hapi': [
    {
      alternative: 'fastify',
      description: 'High-performance alternative with similar plugin architecture. Built-in validation and serialization.',
      difficulty: 'moderate',
    },
  ],

  // Template engines
  'jade': [
    {
      alternative: 'pug',
      description: 'Jade was renamed to Pug. Same syntax, same maintainers. Update the package name.',
      difficulty: 'easy',
    },
  ],

  // Glob / file matching
  'glob': [
    {
      alternative: 'fast-glob',
      description: 'Faster glob implementation. Returns promises by default, supports negation patterns.',
      difficulty: 'easy',
    },
    {
      alternative: 'globby',
      description: 'User-friendly glob matching built on fast-glob. Supports gitignore and multiple patterns.',
      difficulty: 'easy',
    },
  ],

  // Deprecated request-related
  'superagent': [
    {
      alternative: 'got',
      description: 'Modern HTTP client with better error handling, retry support, and TypeScript types.',
      difficulty: 'moderate',
    },
    {
      alternative: 'undici',
      description: 'Official Node.js HTTP client. Built into Node 18+, high performance.',
      difficulty: 'moderate',
    },
  ],

  // Process management
  'nodemon': [
    {
      alternative: 'tsx',
      description: 'TypeScript execute with watch mode. Built on esbuild, instant restarts.',
      difficulty: 'easy',
    },
  ],

  // Shortid (deprecated)
  'shortid': [
    {
      alternative: 'nanoid',
      description: 'Smaller, faster, URL-safe unique ID generator. Drop-in replacement, better entropy.',
      difficulty: 'easy',
    },
    {
      alternative: 'cuid',
      description: 'Collision-resistant unique IDs. Designed for horizontal scaling and security.',
      difficulty: 'easy',
    },
  ],

  // Crypto
  'crypto-js': [
    {
      alternative: 'node:crypto',
      description: 'Built-in Node.js crypto module. No external dependency, maintained by Node.js core team.',
      difficulty: 'moderate',
    },
  ],

  // Body parsing (standalone)
  'body-parser': [
    {
      alternative: 'express',
      description: 'body-parser is built into Express 4.16+. Use express.json() and express.urlencoded() directly.',
      difficulty: 'easy',
    },
  ],

  // YAML
  'js-yaml': [
    {
      alternative: 'yaml',
      description: 'Full YAML 1.2 support with better error messages and TypeScript types.',
      difficulty: 'easy',
    },
  ],

  // Rimraf
  'rimraf': [
    {
      alternative: 'fs.rm',
      description: 'Built-in Node.js fs.rm with recursive option (Node 14.14+). No external dependency needed.',
      difficulty: 'easy',
    },
  ],

  // Mkdirp
  'mkdirp': [
    {
      alternative: 'fs.mkdir',
      description: 'Built-in Node.js fs.mkdir with recursive option (Node 10.12+). No external dependency needed.',
      difficulty: 'easy',
    },
  ],
};

// ---------------------------------------------------------------------------
// MigrationAdvisor
// ---------------------------------------------------------------------------

export class MigrationAdvisor {
  private readonly migrationMap: Record<string, MigrationEntry[]>;

  constructor(extraMappings?: Record<string, MigrationEntry[]>) {
    this.migrationMap = { ...MIGRATION_MAP, ...extraMappings };
  }

  /**
   * Look up migration suggestions for a given package.
   *
   * @param packageName - The npm package to find alternatives for.
   * @param reason - Why the migration is being suggested (e.g. "zombie", "low trust score").
   *                 This is included in the description for context.
   * @returns Array of migration suggestions, empty if no known alternatives exist.
   */
  suggest(packageName: string, reason: string): MigrationSuggestion[] {
    const normalized = packageName.toLowerCase().trim();
    const entries = this.migrationMap[normalized];

    if (!entries || entries.length === 0) {
      return [];
    }

    return entries.map((entry) => ({
      alternative: entry.alternative,
      description: `${entry.description} (Reason for migration: ${reason})`,
      difficulty: entry.difficulty,
    }));
  }

  /**
   * Check whether any migration suggestions exist for a package.
   */
  hasSuggestions(packageName: string): boolean {
    const normalized = packageName.toLowerCase().trim();
    return normalized in this.migrationMap;
  }

  /**
   * Return the list of all packages that have known migration paths.
   */
  getSupportedPackages(): string[] {
    return Object.keys(this.migrationMap).sort();
  }
}
