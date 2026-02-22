/**
 * Dynamic npm registry fetcher for popular packages.
 *
 * Fetches the top N most popular packages from the npm registry search API
 * and caches the results to a local JSON file. This supplements the hardcoded
 * POPULAR_PACKAGES list in the TyposquatDetector for more comprehensive
 * typosquat detection.
 *
 * Design decisions:
 *   - Uses native `fetch` (Node 20+) -- zero additional dependencies.
 *   - Caches to `~/.dep-oracle/popular-packages.json` with configurable TTL.
 *   - Rate-limited to max 2 requests/second between pagination calls.
 *   - Fails gracefully: returns an empty array on network/parse errors so
 *     the caller can fall back to the hardcoded list.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NPM_SEARCH_BASE =
  'https://registry.npmjs.org/-/v1/search?text=boost-exact:false&popularity=1.0&quality=0.0&maintenance=0.0';
const PAGE_SIZE = 250;
const DEFAULT_COUNT = 5000;
const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RATE_LIMIT_DELAY_MS = 500; // 2 requests per second

const CACHE_DIR = join(homedir(), '.dep-oracle');
const CACHE_FILE = join(CACHE_DIR, 'popular-packages.json');

const log = createLogger('registry-fetch');

// ---------------------------------------------------------------------------
// Cache schema
// ---------------------------------------------------------------------------

interface PopularPackagesCache {
  fetchedAt: string; // ISO-8601
  packages: string[];
}

// ---------------------------------------------------------------------------
// npm search API response shape (subset)
// ---------------------------------------------------------------------------

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
    };
  }>;
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for `ms` milliseconds. Used for rate-limiting between pages.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the cache file and return its contents, or `null` if missing/corrupt.
 */
function readCache(): PopularPackagesCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as PopularPackagesCache;

    // Basic shape validation
    if (
      typeof parsed.fetchedAt !== 'string' ||
      !Array.isArray(parsed.packages)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write the cache file atomically (best-effort).
 */
function writeCache(data: PopularPackagesCache): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    log.warn('Failed to write popular-packages cache file');
  }
}

/**
 * Fetch a single page of results from the npm search API.
 */
async function fetchPage(from: number): Promise<NpmSearchResult> {
  const url = `${NPM_SEARCH_BASE}&size=${PAGE_SIZE}&from=${from}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `npm search API returned ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as NpmSearchResult;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch top N popular packages from the npm registry and cache the results.
 * Uses npm's search API to find the most popular packages.
 *
 * This is used to supplement the hardcoded POPULAR_PACKAGES list
 * in the TyposquatDetector for more comprehensive detection.
 *
 * @param options.count    Number of packages to fetch (default: 5000).
 * @param options.cacheTtlMs  Cache time-to-live in milliseconds (default: 7 days).
 * @returns Array of package names sorted by popularity. Returns an empty
 *          array on failure (offline, rate-limited, etc.) so the caller
 *          can safely fall back to the hardcoded list.
 */
export async function fetchPopularPackages(options?: {
  count?: number;
  cacheTtlMs?: number;
}): Promise<string[]> {
  const count = options?.count ?? DEFAULT_COUNT;
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  // 1. Check cache first
  const cached = readCache();
  if (cached) {
    const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();
    if (cacheAge < cacheTtlMs && cached.packages.length > 0) {
      log.info(
        `Using cached popular packages (${cached.packages.length} packages, ` +
        `cached ${Math.round(cacheAge / 1000 / 60 / 60)} hours ago)`,
      );
      return cached.packages;
    }
    log.info('Popular packages cache expired, fetching fresh data...');
  }

  // 2. Fetch from registry
  try {
    const totalPages = Math.ceil(count / PAGE_SIZE);
    const packages: string[] = [];
    const seen = new Set<string>();

    for (let page = 0; page < totalPages; page++) {
      const from = page * PAGE_SIZE;

      log.info(
        `Fetching popular packages from npm registry... (page ${page + 1}/${totalPages})`,
      );

      const result = await fetchPage(from);

      // Extract package names, deduplicating
      for (const obj of result.objects) {
        const name = obj.package.name;
        if (!seen.has(name)) {
          seen.add(name);
          packages.push(name);
        }
      }

      // If the API returned fewer results than the page size, we have
      // reached the end of available results
      if (result.objects.length < PAGE_SIZE) {
        log.info(
          `npm registry returned all available results (${packages.length} packages)`,
        );
        break;
      }

      // We have enough
      if (packages.length >= count) {
        break;
      }

      // Rate limit: wait between pages (skip wait after the last page)
      if (page < totalPages - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    // Trim to the requested count
    const trimmed = packages.slice(0, count);

    // 3. Write to cache
    const cacheData: PopularPackagesCache = {
      fetchedAt: new Date().toISOString(),
      packages: trimmed,
    };
    writeCache(cacheData);

    log.info(`Fetched and cached ${trimmed.length} popular packages from npm registry`);
    return trimmed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`Failed to fetch popular packages from npm registry: ${message}`);
    log.warn('Falling back to hardcoded popular packages list');

    // If we have a stale cache, return it as a best-effort fallback
    if (cached && cached.packages.length > 0) {
      log.info(
        `Returning stale cached data (${cached.packages.length} packages) as fallback`,
      );
      return cached.packages;
    }

    return [];
  }
}
