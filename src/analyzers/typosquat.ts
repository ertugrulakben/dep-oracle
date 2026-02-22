// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TyposquatResult {
  /** Whether the package name looks suspiciously similar to a popular package. */
  isRisky: boolean;
  /** List of popular packages that are suspiciously close. */
  similarPackages: string[];
  /** Minimum Levenshtein distance found (0 = exact match). */
  distance: number;
}

// ---------------------------------------------------------------------------
// Top 200+ popular npm packages (curated list)
// ---------------------------------------------------------------------------

const POPULAR_PACKAGES: readonly string[] = [
  // Core ecosystem / frameworks
  'react', 'react-dom', 'react-router', 'react-router-dom', 'react-redux',
  'redux', 'redux-thunk', 'redux-saga', 'next', 'nextjs',
  'vue', 'vuex', 'vue-router', 'nuxt', 'angular',
  'svelte', 'solid-js', 'preact', 'lit', 'ember-cli',
  'gatsby', 'remix', 'astro', 'vite',

  // Build tools / bundlers
  'webpack', 'webpack-cli', 'webpack-dev-server',
  'rollup', 'esbuild', 'parcel', 'turbo', 'tsup',
  'babel-core', '@babel/core', '@babel/preset-env',

  // TypeScript
  'typescript', 'ts-node', 'tsx', 'ts-jest',

  // Testing
  'jest', 'mocha', 'chai', 'jasmine', 'karma',
  'vitest', 'cypress', 'playwright', 'puppeteer',
  'sinon', 'supertest', 'ava', 'tape', 'nyc', 'c8',
  'istanbul', '@testing-library/react', '@testing-library/jest-dom',

  // Linting / formatting
  'eslint', 'prettier', 'stylelint', 'tslint',
  'eslint-config-airbnb', 'eslint-plugin-react',

  // HTTP / networking
  'express', 'fastify', 'koa', 'hapi', 'restify',
  'axios', 'got', 'node-fetch', 'undici', 'request',
  'superagent', 'isomorphic-fetch', 'cross-fetch',
  'http-proxy', 'http-proxy-middleware',

  // Utilities
  'lodash', 'underscore', 'ramda', 'immer',
  'uuid', 'nanoid', 'shortid', 'cuid',
  'date-fns', 'dayjs', 'moment', 'luxon',
  'ms', 'humanize-duration',

  // CLI
  'chalk', 'colors', 'picocolors', 'colorette',
  'commander', 'yargs', 'meow', 'inquirer', 'prompts',
  'ora', 'listr', 'progress', 'cli-progress',
  'figlet', 'boxen',

  // Logging
  'winston', 'pino', 'bunyan', 'morgan', 'debug',
  'log4js', 'loglevel', 'signale',

  // Database / ORM
  'mongoose', 'sequelize', 'typeorm', 'prisma', 'knex',
  'pg', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3',
  'redis', 'ioredis', 'mongodb',
  'drizzle-orm', 'objection',

  // Validation
  'zod', 'joi', 'yup', 'ajv', 'class-validator',
  'superstruct', 'io-ts',

  // Security / auth
  'jsonwebtoken', 'bcrypt', 'bcryptjs', 'passport',
  'helmet', 'cors', 'csurf', 'express-rate-limit',
  'jose', 'oauth', 'passport-jwt',

  // File / stream
  'fs-extra', 'glob', 'globby', 'fast-glob', 'chokidar',
  'rimraf', 'mkdirp', 'del', 'copy', 'archiver',
  'multer', 'formidable', 'busboy',
  'through2', 'highland', 'pump', 'concat-stream',

  // Template engines
  'ejs', 'pug', 'handlebars', 'mustache', 'nunjucks',

  // Markdown / parsing
  'marked', 'markdown-it', 'remark', 'gray-matter',
  'cheerio', 'jsdom', 'htmlparser2',

  // Config / env
  'dotenv', 'config', 'cosmiconfig', 'cross-env', 'env-cmd',

  // Process / task
  'concurrently', 'npm-run-all', 'execa', 'shelljs',
  'cross-spawn', 'child-process-promise',

  // Crypto / encoding
  'crypto-js', 'argon2', 'base64-js', 'buffer',

  // WebSocket
  'ws', 'socket.io', 'socket.io-client',

  // GraphQL
  'graphql', 'apollo-server', '@apollo/client',
  'graphql-tag', 'graphql-tools', 'urql',

  // CSS-in-JS / styling
  'styled-components', 'emotion', '@emotion/react',
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'less',
  'css-loader', 'style-loader',

  // State management
  'mobx', 'zustand', 'recoil', 'jotai', 'valtio', 'xstate',

  // Misc popular
  'async', 'bluebird', 'rxjs', 'highland',
  'semver', 'minimist', 'yargs-parser',
  'qs', 'query-string', 'url-parse',
  'mime', 'mime-types', 'content-type',
  'body-parser', 'cookie-parser', 'compression',
  'serve-static', 'http-errors', 'on-finished',
  'path-to-regexp', 'escape-html',
  'string-width', 'strip-ansi', 'ansi-regex',
  'p-limit', 'p-map', 'p-queue',
  'yaml', 'toml', 'ini', 'json5',
  'sharp', 'jimp', 'canvas',
  'nodemailer', 'aws-sdk', '@aws-sdk/client-s3',
  'firebase', 'supabase',
  'three', 'd3', 'chart.js', 'echarts',
  'jquery', 'backbone', 'knockout',

  // Deprecated / known-risky (useful for detection)
  'event-stream', 'flatmap-stream', 'node-uuid',
  'coffee-script', 'coffeescript', 'bower',
  'uglify-js', 'terser',
] as const;

// ---------------------------------------------------------------------------
// TyposquatDetector
// ---------------------------------------------------------------------------

export class TyposquatDetector {
  private readonly popularPackages: ReadonlySet<string>;
  private readonly popularList: readonly string[];

  constructor(extraPopularPackages?: string[]) {
    const combined = [...POPULAR_PACKAGES, ...(extraPopularPackages ?? [])];
    this.popularList = combined;
    this.popularPackages = new Set(combined);
  }

  /**
   * Check whether `packageName` looks like a typosquat of a popular package.
   * Returns risk assessment with details.
   */
  check(packageName: string): TyposquatResult {
    // If the package itself is a known popular package, it is safe
    if (this.popularPackages.has(packageName)) {
      return { isRisky: false, similarPackages: [], distance: 0 };
    }

    const similarPackages: string[] = [];
    let minDistance = Infinity;

    for (const popular of this.popularList) {
      const distance = levenshtein(packageName, popular);

      // Flag if Levenshtein distance is 1 or 2
      if (distance >= 1 && distance <= 2) {
        if (distance < minDistance) {
          minDistance = distance;
        }
        if (!similarPackages.includes(popular)) {
          similarPackages.push(popular);
        }
      }
    }

    // Also check common typosquat patterns even if Levenshtein > 2
    const patternMatches = this.checkTyposquatPatterns(packageName);
    for (const match of patternMatches) {
      if (!similarPackages.includes(match)) {
        similarPackages.push(match);
        const d = levenshtein(packageName, match);
        if (d < minDistance) {
          minDistance = d;
        }
      }
    }

    const isRisky = similarPackages.length > 0;

    return {
      isRisky,
      similarPackages: similarPackages.sort(),
      distance: isRisky ? minDistance : 0,
    };
  }

  // -------------------------------------------------------------------------
  // Pattern-based detection
  // -------------------------------------------------------------------------

  /**
   * Check for common typosquat patterns that may not be caught by
   * Levenshtein alone (e.g. adding -js, -node suffix).
   */
  private checkTyposquatPatterns(packageName: string): string[] {
    const matches: string[] = [];

    for (const popular of this.popularList) {
      // Skip exact matches
      if (packageName === popular) continue;

      // Pattern: added suffix (-js, -node, -lib, -pkg, -core)
      const suffixes = ['-js', '-node', '-lib', '-pkg', '-core', 'js', '-new'];
      for (const suffix of suffixes) {
        if (packageName === popular + suffix) {
          matches.push(popular);
          break;
        }
        if (packageName + suffix === popular) {
          matches.push(popular);
          break;
        }
      }

      // Pattern: doubled letters (e.g. "expresss" vs "express")
      if (this.isDoubledLetter(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: missing letter (e.g. "expres" vs "express")
      if (this.isMissingLetter(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: transposed adjacent letters (e.g. "exrpess" vs "express")
      if (this.isTransposed(packageName, popular)) {
        matches.push(popular);
        continue;
      }

      // Pattern: homoglyph / common substitution (e.g. "1odash" vs "lodash")
      if (this.isHomoglyph(packageName, popular)) {
        matches.push(popular);
        continue;
      }
    }

    return matches;
  }

  /**
   * Check if `input` is `target` with one letter doubled.
   * e.g. "expresss" -> "express"
   */
  private isDoubledLetter(input: string, target: string): boolean {
    if (input.length !== target.length + 1) return false;

    let skipped = false;
    let j = 0;
    for (let i = 0; i < input.length; i++) {
      if (j >= target.length) {
        // Extra char at end — check it is the same as previous
        if (!skipped && i > 0 && input[i] === input[i - 1]) return true;
        return false;
      }
      if (input[i] === target[j]) {
        j++;
      } else if (!skipped && i > 0 && input[i] === input[i - 1]) {
        skipped = true;
        // Don't advance j — this is the doubled letter
      } else {
        return false;
      }
    }
    return j === target.length;
  }

  /**
   * Check if `input` is `target` with one letter removed.
   * e.g. "expres" -> "express"
   */
  private isMissingLetter(input: string, target: string): boolean {
    if (input.length !== target.length - 1) return false;

    let skipped = false;
    let j = 0;
    for (let i = 0; i < target.length; i++) {
      if (j >= input.length) {
        return !skipped;
      }
      if (input[j] === target[i]) {
        j++;
      } else if (!skipped) {
        skipped = true;
        // Skip this target char
      } else {
        return false;
      }
    }
    return j === input.length;
  }

  /**
   * Check if `input` is `target` with two adjacent letters swapped.
   * e.g. "exrpess" -> "express"
   */
  private isTransposed(input: string, target: string): boolean {
    if (input.length !== target.length) return false;

    let diffCount = 0;
    let firstDiff = -1;

    for (let i = 0; i < input.length; i++) {
      if (input[i] !== target[i]) {
        diffCount++;
        if (diffCount === 1) {
          firstDiff = i;
        } else if (diffCount === 2) {
          // Check if this is a transposition of adjacent characters
          if (
            i === firstDiff + 1 &&
            input[firstDiff] === target[i] &&
            input[i] === target[firstDiff]
          ) {
            // Valid transposition — continue checking the rest
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    return diffCount === 2;
  }

  /**
   * Check for common character substitutions (homoglyphs).
   * e.g. "1odash" vs "lodash", "rn" vs "m"
   */
  private isHomoglyph(input: string, target: string): boolean {
    if (input.length !== target.length) return false;

    const substitutions: Record<string, string[]> = {
      'l': ['1', 'i', '|'],
      'o': ['0'],
      '0': ['o'],
      '1': ['l', 'i'],
      'i': ['1', 'l'],
      'e': ['3'],
      's': ['5'],
      'a': ['4', '@'],
      'g': ['9'],
      'b': ['6'],
    };

    let subCount = 0;

    for (let i = 0; i < input.length; i++) {
      if (input[i] !== target[i]) {
        const allowed = substitutions[target[i]];
        if (allowed && allowed.includes(input[i])) {
          subCount++;
          if (subCount > 1) return false; // Only allow one substitution
        } else {
          return false;
        }
      }
    }

    return subCount === 1;
  }
}

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Uses the classic dynamic-programming approach with O(min(m,n)) space.
 */
function levenshtein(a: string, b: string): number {
  // Ensure `a` is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const m = a.length;
  const n = b.length;

  // Edge cases
  if (m === 0) return n;
  if (n === 0) return m;

  // Previous and current row of distances
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);

  // Initialize the base row
  for (let i = 0; i <= m; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= n; j++) {
    curr[0] = j;

    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost, // substitution
      );
    }

    // Swap rows
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}
