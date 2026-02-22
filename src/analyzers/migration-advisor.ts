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

  // ---------------------------------------------------------------------------
  // left-pad (infamous, now unnecessary)
  // ---------------------------------------------------------------------------
  'left-pad': [
    {
      alternative: 'String.prototype.padStart',
      description: 'Built-in ES2017 String method. Native replacement, zero dependencies.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // querystring (deprecated Node.js built-in)
  // ---------------------------------------------------------------------------
  'querystring': [
    {
      alternative: 'URLSearchParams',
      description: 'Web-standard URL query string API built into Node.js. Handles encoding/decoding correctly.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // request-promise / request-promise-native (deprecated with request)
  // ---------------------------------------------------------------------------
  'request-promise': [
    {
      alternative: 'got',
      description: 'Modern HTTP client with native Promise support, retries, and hooks. request is fully deprecated.',
      difficulty: 'moderate',
    },
    {
      alternative: 'axios',
      description: 'Promise-based HTTP client for Node.js and browsers. Familiar interceptor API.',
      difficulty: 'easy',
    },
    {
      alternative: 'undici',
      description: 'Official Node.js HTTP client built into Node 18+. High performance, standards-based.',
      difficulty: 'moderate',
    },
  ],

  'request-promise-native': [
    {
      alternative: 'got',
      description: 'Modern HTTP client with native Promise support. No wrapper needed, request is deprecated.',
      difficulty: 'moderate',
    },
    {
      alternative: 'undici',
      description: 'Official Node.js HTTP client built into Node 18+. Standards-based fetch API.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // node-sass (deprecated in favor of Dart Sass)
  // ---------------------------------------------------------------------------
  'node-sass': [
    {
      alternative: 'sass',
      description: 'Dart Sass is the primary implementation of Sass. node-sass is deprecated. API is compatible for most use cases.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // PhantomJS (abandoned)
  // ---------------------------------------------------------------------------
  'phantomjs': [
    {
      alternative: 'playwright',
      description: 'Modern browser automation by Microsoft. Supports Chromium, Firefox, and WebKit. Actively maintained.',
      difficulty: 'hard',
    },
    {
      alternative: 'puppeteer',
      description: 'Chrome/Chromium automation by Google. Headless browser testing and scraping.',
      difficulty: 'hard',
    },
  ],

  'phantomjs-prebuilt': [
    {
      alternative: 'playwright',
      description: 'Modern browser automation supporting multiple browsers. PhantomJS is abandoned and insecure.',
      difficulty: 'hard',
    },
    {
      alternative: 'puppeteer',
      description: 'Headless Chrome automation. Direct replacement for PhantomJS browser scripting use cases.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // merge (unmaintained shallow merge)
  // ---------------------------------------------------------------------------
  'merge': [
    {
      alternative: 'deepmerge',
      description: 'Deep merge utility with support for arrays, Maps, and Sets. Actively maintained.',
      difficulty: 'easy',
    },
    {
      alternative: 'lodash.merge',
      description: 'Well-tested deep merge from lodash. Handles circular references and complex objects.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // minimatch (old versions with ReDoS)
  // ---------------------------------------------------------------------------
  'minimatch': [
    {
      alternative: 'picomatch',
      description: 'Fast and accurate glob matcher. Better performance and no ReDoS vulnerabilities.',
      difficulty: 'easy',
    },
    {
      alternative: 'micromatch',
      description: 'Feature-rich glob matcher built on picomatch. Supports extended globs and brace expansion.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // har-validator (deprecated)
  // ---------------------------------------------------------------------------
  'har-validator': [
    {
      alternative: 'har-schema',
      description: 'Use the HAR schema directly with ajv or zod for validation. har-validator is unmaintained.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // graphql-tools (old monolithic Apollo package)
  // ---------------------------------------------------------------------------
  'graphql-tools': [
    {
      alternative: '@graphql-tools/schema',
      description: 'Modular GraphQL Tools packages. Import only what you need from the scoped @graphql-tools/* packages.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // enzyme (React testing, abandoned)
  // ---------------------------------------------------------------------------
  'enzyme': [
    {
      alternative: '@testing-library/react',
      description: 'Testing Library encourages testing user behavior instead of implementation details. React recommended approach.',
      difficulty: 'hard',
    },
  ],

  'enzyme-adapter-react-16': [
    {
      alternative: '@testing-library/react',
      description: 'Enzyme adapters are no longer maintained for newer React. Testing Library works with all React versions.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // sinon (test doubles)
  // ---------------------------------------------------------------------------
  'sinon': [
    {
      alternative: 'vitest',
      description: 'Vitest includes built-in vi.fn(), vi.spyOn(), and vi.mock() for mocking. No separate library needed.',
      difficulty: 'moderate',
    },
    {
      alternative: 'jest',
      description: 'Jest includes built-in jest.fn(), jest.spyOn(), and jest.mock(). No separate mocking library needed.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // karma (test runner for browsers)
  // ---------------------------------------------------------------------------
  'karma': [
    {
      alternative: 'vitest',
      description: 'Fast Vite-native test runner with browser mode. Replaces Karma for both unit and browser testing.',
      difficulty: 'hard',
    },
    {
      alternative: 'jest',
      description: 'Zero-config test framework with jsdom for DOM testing. No browser process required.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // jasmine
  // ---------------------------------------------------------------------------
  'jasmine': [
    {
      alternative: 'vitest',
      description: 'Modern test runner with Jest-compatible API. Faster execution, ESM support, built-in coverage.',
      difficulty: 'moderate',
    },
    {
      alternative: 'jest',
      description: 'Feature-rich test framework. Similar describe/it syntax, built-in mocking and assertions.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // tape
  // ---------------------------------------------------------------------------
  'tape': [
    {
      alternative: 'vitest',
      description: 'Modern test runner with a rich assertion API. Supports TAP output via reporters if needed.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // ava
  // ---------------------------------------------------------------------------
  'ava': [
    {
      alternative: 'vitest',
      description: 'Vitest offers similar parallel test execution with better IDE integration and watch mode.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // nyc (Istanbul CLI)
  // ---------------------------------------------------------------------------
  'nyc': [
    {
      alternative: 'c8',
      description: 'Native V8 code coverage using NODE_V8_COVERAGE. No instrumentation, faster and more accurate.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // node-fetch / cross-fetch / isomorphic-fetch (native fetch in Node 18+)
  // ---------------------------------------------------------------------------
  'node-fetch': [
    {
      alternative: 'native fetch',
      description: 'Node.js 18+ includes a global fetch() based on undici. No polyfill needed for modern Node.',
      difficulty: 'easy',
    },
  ],

  'cross-fetch': [
    {
      alternative: 'native fetch',
      description: 'Node.js 18+ and all modern browsers support fetch() natively. Polyfill no longer needed.',
      difficulty: 'easy',
    },
  ],

  'isomorphic-fetch': [
    {
      alternative: 'native fetch',
      description: 'Global fetch() is available in Node.js 18+ and all modern browsers. Remove the polyfill.',
      difficulty: 'easy',
    },
  ],

  'isomorphic-unfetch': [
    {
      alternative: 'native fetch',
      description: 'Minimal fetch polyfill no longer needed. Node.js 18+ ships native fetch globally.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // express-validator
  // ---------------------------------------------------------------------------
  'express-validator': [
    {
      alternative: 'zod',
      description: 'TypeScript-first schema validation. Framework-agnostic, composable schemas, great type inference.',
      difficulty: 'moderate',
    },
    {
      alternative: 'valibot',
      description: 'Tiny, tree-shakeable schema validation library. Similar API to zod with smaller bundle size.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // cls-hooked (async context)
  // ---------------------------------------------------------------------------
  'cls-hooked': [
    {
      alternative: 'AsyncLocalStorage',
      description: 'Built-in Node.js AsyncLocalStorage (stable since Node 16). No external dependency for async context propagation.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // dotenv
  // ---------------------------------------------------------------------------
  'dotenv': [
    {
      alternative: 'node --env-file',
      description: 'Node.js 20.6+ supports --env-file flag natively. No library needed for .env loading.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // chalk (for simple coloring)
  // ---------------------------------------------------------------------------
  'chalk': [
    {
      alternative: 'picocolors',
      description: 'Tiny (< 3KB), dependency-free terminal color library. 2x faster than chalk, covers most use cases.',
      difficulty: 'easy',
    },
    {
      alternative: 'colorette',
      description: 'Lightweight terminal coloring. Simple API compatible with chalk basic usage patterns.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // commander / yargs (CLI argument parsing)
  // ---------------------------------------------------------------------------
  'commander': [
    {
      alternative: 'citty',
      description: 'Elegant CLI builder from UnJS. TypeScript-first, minimal API with sub-command support.',
      difficulty: 'moderate',
    },
    {
      alternative: 'clipanion',
      description: 'Type-safe CLI framework used by Yarn. Advanced features like command routing and validation.',
      difficulty: 'moderate',
    },
  ],

  'yargs': [
    {
      alternative: 'citty',
      description: 'Lightweight CLI builder from UnJS. Cleaner API, TypeScript types, smaller footprint than yargs.',
      difficulty: 'moderate',
    },
    {
      alternative: 'commander',
      description: 'Popular CLI framework with a simpler API. Less configuration overhead than yargs.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // inquirer / prompts (interactive CLI prompts)
  // ---------------------------------------------------------------------------
  'inquirer': [
    {
      alternative: '@clack/prompts',
      description: 'Beautiful CLI prompts with minimal API. Better UX with spinners, grouping, and cancel handling.',
      difficulty: 'moderate',
    },
  ],

  'prompts': [
    {
      alternative: '@clack/prompts',
      description: 'Modern interactive prompt library with better DX. Structured prompt flows with cancel support.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // listr (task runner)
  // ---------------------------------------------------------------------------
  'listr': [
    {
      alternative: 'listr2',
      description: 'Actively maintained fork of listr. Better TypeScript support, new renderers, and task management.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // Logging libraries
  // ---------------------------------------------------------------------------
  'debug': [
    {
      alternative: 'pino',
      description: 'Fast structured JSON logger. Better for production observability than debug-style logging.',
      difficulty: 'moderate',
    },
    {
      alternative: 'consola',
      description: 'Elegant console logger from UnJS. Supports log levels, reporters, and structured output.',
      difficulty: 'easy',
    },
  ],

  'bunyan': [
    {
      alternative: 'pino',
      description: 'Fastest Node.js JSON logger. Same structured JSON approach as bunyan, 5x faster.',
      difficulty: 'moderate',
    },
  ],

  'log4js': [
    {
      alternative: 'pino',
      description: 'High-performance structured logger. Modern alternative to log4js with async I/O and transports.',
      difficulty: 'moderate',
    },
  ],

  'signale': [
    {
      alternative: 'consola',
      description: 'Elegant console logger from UnJS. Beautiful output, pluggable reporters, TypeScript support.',
      difficulty: 'easy',
    },
  ],

  'winston': [
    {
      alternative: 'pino',
      description: 'Significantly faster JSON logger. Simpler transport system, lower overhead in production.',
      difficulty: 'moderate',
    },
  ],

  'morgan': [
    {
      alternative: 'pino-http',
      description: 'HTTP logger middleware for pino. Structured JSON request logging with automatic request IDs.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // ORM / Query builders
  // ---------------------------------------------------------------------------
  'mongoose': [
    {
      alternative: 'prisma',
      description: 'Type-safe ORM with auto-generated client. Schema-first approach, migrations, and studio GUI.',
      difficulty: 'hard',
    },
    {
      alternative: 'drizzle-orm',
      description: 'Lightweight TypeScript ORM. SQL-like syntax, zero overhead, excellent type inference.',
      difficulty: 'hard',
    },
  ],

  'sequelize': [
    {
      alternative: 'prisma',
      description: 'Modern type-safe ORM. Better TypeScript support, declarative schema, and migration tooling.',
      difficulty: 'hard',
    },
    {
      alternative: 'drizzle-orm',
      description: 'SQL-like TypeScript ORM. Closer to raw SQL than Sequelize, excellent performance.',
      difficulty: 'hard',
    },
  ],

  'typeorm': [
    {
      alternative: 'prisma',
      description: 'More stable and actively maintained ORM. Better migration system and type safety.',
      difficulty: 'hard',
    },
    {
      alternative: 'drizzle-orm',
      description: 'Lightweight alternative with SQL-like API. Better TypeScript inference and query performance.',
      difficulty: 'hard',
    },
  ],

  'knex': [
    {
      alternative: 'drizzle-orm',
      description: 'TypeScript-first query builder with ORM features. Similar SQL-like API with full type safety.',
      difficulty: 'moderate',
    },
    {
      alternative: 'kysely',
      description: 'Type-safe SQL query builder. End-to-end type safety from database schema to query results.',
      difficulty: 'moderate',
    },
  ],

  'bookshelf': [
    {
      alternative: 'prisma',
      description: 'Modern ORM replacing Bookshelf/Knex stack. Auto-generated types, declarative relations, migrations.',
      difficulty: 'hard',
    },
  ],

  'waterline': [
    {
      alternative: 'prisma',
      description: 'Sails.js ORM is rarely maintained. Prisma offers modern schema management and type safety.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  'passport': [
    {
      alternative: 'lucia-auth',
      description: 'Modern, lightweight auth library. Session-based authentication with clear API, no magic.',
      difficulty: 'hard',
    },
    {
      alternative: 'better-auth',
      description: 'Framework-agnostic TypeScript auth library. Built-in support for OAuth, email/password, and MFA.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // Password hashing
  // ---------------------------------------------------------------------------
  'bcrypt': [
    {
      alternative: 'argon2',
      description: 'Winner of the Password Hashing Competition. More secure than bcrypt, resistant to GPU attacks.',
      difficulty: 'easy',
    },
  ],

  'bcryptjs': [
    {
      alternative: 'argon2',
      description: 'Argon2 is the recommended password hashing algorithm. Better security profile than bcrypt variants.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------
  'express-session': [
    {
      alternative: 'iron-session',
      description: 'Encrypted stateless sessions using signed and encrypted cookies. No server-side session store needed.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // CORS / Security middleware
  // ---------------------------------------------------------------------------
  'cors': [
    {
      alternative: 'helmet',
      description: 'Comprehensive security middleware that includes CORS handling along with other HTTP security headers.',
      difficulty: 'easy',
    },
  ],

  'csurf': [
    {
      alternative: 'csrf-csrf',
      description: 'csurf is deprecated due to security issues. csrf-csrf implements the double-submit cookie pattern securely.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // File upload
  // ---------------------------------------------------------------------------
  'multer': [
    {
      alternative: 'busboy',
      description: 'Low-level multipart parser. More control over file handling, better streaming support.',
      difficulty: 'moderate',
    },
    {
      alternative: 'formidable',
      description: 'Full-featured form/file parser. Streaming, plugins, and better memory management than multer.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------
  'socket.io': [
    {
      alternative: 'ws',
      description: 'Lightweight WebSocket implementation. No protocol overhead, better for performance-critical applications.',
      difficulty: 'moderate',
    },
    {
      alternative: 'socket.io',
      description: 'If you need fallbacks and rooms, keep socket.io but upgrade to v4+ for improved performance.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // HTTP clients (alternatives to axios/got)
  // ---------------------------------------------------------------------------
  'axios': [
    {
      alternative: 'ky',
      description: 'Tiny HTTP client built on fetch. Simpler API, automatic retries, hooks, and smaller bundle.',
      difficulty: 'moderate',
    },
    {
      alternative: 'ofetch',
      description: 'Universal fetch client from UnJS. Works in Node, browser, and workers with auto-parsing.',
      difficulty: 'moderate',
    },
  ],

  'got': [
    {
      alternative: 'ofetch',
      description: 'Lightweight universal fetch from UnJS. Simpler API with auto-retry, auto-parse, and type safety.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Job scheduling / queues
  // ---------------------------------------------------------------------------
  'node-cron': [
    {
      alternative: 'croner',
      description: 'Modern cron scheduler with timezone support, overrun protection, and better pattern parsing.',
      difficulty: 'easy',
    },
  ],

  'agenda': [
    {
      alternative: 'bullmq',
      description: 'Redis-based job queue with better reliability. Supports delayed jobs, retries, and rate limiting.',
      difficulty: 'moderate',
    },
  ],

  'bull': [
    {
      alternative: 'bullmq',
      description: 'Next generation of Bull by the same author. Better TypeScript support, flows, and worker threads.',
      difficulty: 'moderate',
    },
  ],

  'kue': [
    {
      alternative: 'bullmq',
      description: 'Kue is unmaintained. BullMQ is the modern Redis-based queue with job scheduling and retries.',
      difficulty: 'moderate',
    },
  ],

  'bee-queue': [
    {
      alternative: 'bullmq',
      description: 'BullMQ offers more features than bee-queue: job flows, rate limiting, and better error handling.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Redis clients
  // ---------------------------------------------------------------------------
  'redis': [
    {
      alternative: 'ioredis',
      description: 'Full-featured Redis client with cluster support, Lua scripting, and pipelining. Better performance.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // MongoDB native driver
  // ---------------------------------------------------------------------------
  'mongodb': [
    {
      alternative: 'mongoose',
      description: 'Schema-based ODM for MongoDB. Adds validation, middleware, and population to raw driver.',
      difficulty: 'moderate',
    },
    {
      alternative: 'prisma',
      description: 'Type-safe ORM with MongoDB support. Auto-generated client, declarative schema.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // memcached
  // ---------------------------------------------------------------------------
  'memcached': [
    {
      alternative: 'ioredis',
      description: 'Redis is a superset of memcached features with persistence, pub/sub, and data structures.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Build tools / bundlers
  // ---------------------------------------------------------------------------
  'webpack': [
    {
      alternative: 'vite',
      description: 'Next-gen frontend build tool. Instant dev server with HMR, Rollup-based production builds.',
      difficulty: 'hard',
    },
    {
      alternative: 'rspack',
      description: 'Rust-based webpack-compatible bundler. Drop-in replacement with 5-10x build speed improvement.',
      difficulty: 'moderate',
    },
  ],

  'rollup': [
    {
      alternative: 'vite',
      description: 'Vite uses Rollup under the hood for production. Better DX with dev server and plugin ecosystem.',
      difficulty: 'moderate',
    },
  ],

  'parcel': [
    {
      alternative: 'vite',
      description: 'Similar zero-config philosophy with better plugin ecosystem and community support.',
      difficulty: 'moderate',
    },
  ],

  'gulp': [
    {
      alternative: 'npm scripts',
      description: 'Replace gulp tasks with npm scripts in package.json. Use concurrently for parallel tasks.',
      difficulty: 'moderate',
    },
    {
      alternative: 'vite',
      description: 'Modern build tool that replaces custom gulp build pipelines. Plugin-based, zero-config defaults.',
      difficulty: 'hard',
    },
  ],

  'grunt': [
    {
      alternative: 'npm scripts',
      description: 'Replace Grunt tasks with npm scripts. Modern tooling eliminates the need for task runners.',
      difficulty: 'moderate',
    },
  ],

  'browserify': [
    {
      alternative: 'vite',
      description: 'Modern bundler with ESM-first approach. Replaces browserify with faster builds and HMR.',
      difficulty: 'hard',
    },
    {
      alternative: 'esbuild',
      description: 'Extremely fast JavaScript bundler. Simple API, handles CommonJS and ESM bundling.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Transpilers / TypeScript execution
  // ---------------------------------------------------------------------------
  'babel': [
    {
      alternative: 'swc',
      description: 'Rust-based JavaScript/TypeScript compiler. 20x faster than Babel, compatible plugin API.',
      difficulty: 'moderate',
    },
    {
      alternative: 'esbuild',
      description: 'Go-based transpiler and bundler. Handles JSX, TypeScript, and modern JS transforms.',
      difficulty: 'moderate',
    },
  ],

  '@babel/core': [
    {
      alternative: 'swc',
      description: 'Rust-based compiler. Drop-in replacement for most Babel configurations, dramatically faster.',
      difficulty: 'moderate',
    },
    {
      alternative: 'esbuild',
      description: 'Extremely fast transpiler. Handles TypeScript, JSX, and most modern JS features.',
      difficulty: 'moderate',
    },
  ],

  'ts-node': [
    {
      alternative: 'tsx',
      description: 'TypeScript execute powered by esbuild. Instant startup, ESM support, watch mode included.',
      difficulty: 'easy',
    },
  ],

  'ts-jest': [
    {
      alternative: 'vitest',
      description: 'Vite-native test runner with built-in TypeScript support. No separate transformer needed.',
      difficulty: 'moderate',
    },
    {
      alternative: '@swc/jest',
      description: 'SWC-based Jest transformer. 10x faster TypeScript compilation than ts-jest.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // Email
  // ---------------------------------------------------------------------------
  'nodemailer': [
    {
      alternative: 'resend',
      description: 'Modern email API built for developers. Simple SDK, React Email support, better deliverability.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Template engines
  // ---------------------------------------------------------------------------
  'nunjucks': [
    {
      alternative: 'edge.js',
      description: 'Modern template engine for Node.js. Better error messages, tag-based components, TypeScript support.',
      difficulty: 'moderate',
    },
    {
      alternative: 'eta',
      description: 'Lightweight, fast template engine. Supports async, partials, and configurable syntax.',
      difficulty: 'moderate',
    },
  ],

  'ejs': [
    {
      alternative: 'eta',
      description: 'Faster and lighter EJS alternative. Compatible syntax with better async support and security.',
      difficulty: 'easy',
    },
  ],

  'pug': [
    {
      alternative: 'edge.js',
      description: 'Modern tag-based template engine. Cleaner syntax, better error reporting, component support.',
      difficulty: 'moderate',
    },
  ],

  'handlebars': [
    {
      alternative: 'edge.js',
      description: 'Modern template engine with better control flow. No need for custom helpers for basic logic.',
      difficulty: 'moderate',
    },
    {
      alternative: 'eta',
      description: 'Lightweight template engine with configurable delimiters. Supports async and partials.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Markdown
  // ---------------------------------------------------------------------------
  'marked': [
    {
      alternative: 'markdown-it',
      description: 'Pluggable Markdown parser. Better extensibility, CommonMark compliance, and plugin ecosystem.',
      difficulty: 'easy',
    },
    {
      alternative: '@mdx-js/mdx',
      description: 'MDX enables JSX in Markdown. Ideal for content-driven apps with interactive components.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // DOM parsing / manipulation
  // ---------------------------------------------------------------------------
  'cheerio': [
    {
      alternative: 'linkedom',
      description: 'Fast, lightweight DOM implementation. Standards-compliant, smaller bundle, better performance.',
      difficulty: 'moderate',
    },
  ],

  'jsdom': [
    {
      alternative: 'happy-dom',
      description: 'Faster alternative to jsdom. 2-3x performance improvement, good compatibility with testing libraries.',
      difficulty: 'easy',
    },
    {
      alternative: 'linkedom',
      description: 'Lightweight DOM implementation. Faster than jsdom with smaller memory footprint.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // Browser automation / E2E testing
  // ---------------------------------------------------------------------------
  'puppeteer': [
    {
      alternative: 'playwright',
      description: 'Multi-browser automation (Chrome, Firefox, WebKit). Better auto-wait, tracing, and test generation.',
      difficulty: 'moderate',
    },
  ],

  'cypress': [
    {
      alternative: 'playwright',
      description: 'Multi-browser E2E testing. Faster execution, better parallelization, and cross-browser support.',
      difficulty: 'hard',
    },
  ],

  'selenium-webdriver': [
    {
      alternative: 'playwright',
      description: 'Modern browser automation with auto-wait and multi-browser support. No WebDriver protocol overhead.',
      difficulty: 'hard',
    },
  ],

  'webdriverio': [
    {
      alternative: 'playwright',
      description: 'Simpler API with built-in assertions. No WebDriver dependency, faster test execution.',
      difficulty: 'hard',
    },
  ],

  'protractor': [
    {
      alternative: 'playwright',
      description: 'Protractor is deprecated. Playwright supports Angular apps and offers modern test tooling.',
      difficulty: 'hard',
    },
  ],

  'nightmare': [
    {
      alternative: 'playwright',
      description: 'Nightmare is unmaintained. Playwright offers reliable browser automation across all modern browsers.',
      difficulty: 'hard',
    },
  ],

  // ---------------------------------------------------------------------------
  // Image processing
  // ---------------------------------------------------------------------------
  'sharp': [
    {
      alternative: '@napi-rs/image',
      description: 'Rust-based image processing via N-API. No native dependency issues, cross-platform binaries.',
      difficulty: 'moderate',
    },
  ],

  'jimp': [
    {
      alternative: 'sharp',
      description: 'libvips-based image processor. 10x faster than jimp for resizing, converting, and transforming images.',
      difficulty: 'moderate',
    },
  ],

  'gm': [
    {
      alternative: 'sharp',
      description: 'No external GraphicsMagick/ImageMagick install required. Faster processing with libvips.',
      difficulty: 'moderate',
    },
  ],

  'imagemagick': [
    {
      alternative: 'sharp',
      description: 'Native Node.js image processing without system dependency. Faster and easier to deploy.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Timezone / Date utilities
  // ---------------------------------------------------------------------------
  'moment-timezone': [
    {
      alternative: 'luxon',
      description: 'Built-in IANA timezone support via Intl API. No separate timezone data bundle needed.',
      difficulty: 'moderate',
    },
    {
      alternative: 'date-fns-tz',
      description: 'Timezone support for date-fns. Modular, tree-shakeable, uses native Intl API.',
      difficulty: 'moderate',
    },
  ],

  'chrono-node': [
    {
      alternative: 'date-fns',
      description: 'Comprehensive date utility library. Use date-fns/parse for structured date parsing.',
      difficulty: 'moderate',
    },
  ],

  // ---------------------------------------------------------------------------
  // Promise libraries (legacy)
  // ---------------------------------------------------------------------------
  'q': [
    {
      alternative: 'native promises',
      description: 'Native Promise/async-await is standard since ES2015. Remove Q and use built-in Promise API.',
      difficulty: 'moderate',
    },
  ],

  'when': [
    {
      alternative: 'native promises',
      description: 'Native Promise with async/await covers all when.js use cases. No polyfill library needed.',
      difficulty: 'moderate',
    },
  ],

  'rsvp': [
    {
      alternative: 'native promises',
      description: 'RSVP is no longer needed. Native Promise API is performant and universally supported.',
      difficulty: 'moderate',
    },
  ],

  'es6-promise': [
    {
      alternative: 'native promises',
      description: 'ES6 Promise polyfill is unnecessary. All supported Node.js versions have native Promise.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // String similarity
  // ---------------------------------------------------------------------------
  'string-similarity': [
    {
      alternative: 'fastest-levenshtein',
      description: 'Fastest Levenshtein distance implementation. Better performance for string comparison use cases.',
      difficulty: 'easy',
    },
  ],

  'leven': [
    {
      alternative: 'fastest-levenshtein',
      description: 'Faster Levenshtein distance calculation with the same simple API.',
      difficulty: 'easy',
    },
  ],

  // ---------------------------------------------------------------------------
  // Additional commonly encountered packages
  // ---------------------------------------------------------------------------
  'request-promise-any': [
    {
      alternative: 'got',
      description: 'Modern HTTP client with promise support. request ecosystem is fully deprecated.',
      difficulty: 'moderate',
    },
  ],

  'uuid': [
    {
      alternative: 'crypto.randomUUID',
      description: 'Built-in Node.js 19+ and Web Crypto API. No dependency needed for UUID v4 generation.',
      difficulty: 'easy',
    },
  ],

  'form-data': [
    {
      alternative: 'native FormData',
      description: 'Node.js 18+ includes global FormData. No polyfill needed for modern Node versions.',
      difficulty: 'easy',
    },
  ],

  'node-abort-controller': [
    {
      alternative: 'native AbortController',
      description: 'AbortController is global in Node.js 16+. Remove the polyfill package.',
      difficulty: 'easy',
    },
  ],

  'object-assign': [
    {
      alternative: 'Object.assign / spread',
      description: 'Native Object.assign() and spread syntax are available in all modern environments.',
      difficulty: 'easy',
    },
  ],

  'array-flatten': [
    {
      alternative: 'Array.prototype.flat',
      description: 'Native Array.flat() is available since ES2019. No utility package needed.',
      difficulty: 'easy',
    },
  ],

  'string.prototype.trimstart': [
    {
      alternative: 'String.prototype.trimStart',
      description: 'Native trimStart() is available since ES2019. Remove the polyfill.',
      difficulty: 'easy',
    },
  ],

  'string.prototype.trimend': [
    {
      alternative: 'String.prototype.trimEnd',
      description: 'Native trimEnd() is available since ES2019. Remove the polyfill.',
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
