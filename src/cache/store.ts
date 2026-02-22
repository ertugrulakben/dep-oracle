/**
 * JSON file-based cache with TTL support.
 *
 * Stores data at `~/.dep-oracle/cache.json`. Zero native dependencies —
 * works with `npx` on every OS without build tools.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TTL_SECONDS = 86_400; // 24 hours
const CACHE_DIR = join(homedir(), ".dep-oracle");
const CACHE_PATH = join(CACHE_DIR, "cache.json");

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: unknown;
  createdAt: number; // epoch seconds
  ttl: number;       // seconds
}

type CacheStore = Record<string, CacheEntry>;

// ---------------------------------------------------------------------------
// CacheManager
// ---------------------------------------------------------------------------

export class CacheManager {
  private store: CacheStore;
  private readonly filePath: string;

  constructor(filePath: string = CACHE_PATH) {
    this.filePath = filePath;

    // Ensure directory exists
    const dir = filePath === CACHE_PATH ? CACHE_DIR : join(filePath, "..");
    mkdirSync(dir, { recursive: true });

    // Load existing cache
    this.store = this.load();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Retrieve a cached value by key. Returns `null` when the key does not
   * exist or has expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store[key];
    if (!entry) return null;

    const now = Math.floor(Date.now() / 1000);
    if (now - entry.createdAt > entry.ttl) {
      delete this.store[key];
      this.persist();
      return null;
    }

    return entry.value as T;
  }

  /**
   * Store a value in the cache.
   */
  set<T>(key: string, value: T, ttl: number = DEFAULT_TTL_SECONDS): void {
    const now = Math.floor(Date.now() / 1000);
    this.store[key] = { value, createdAt: now, ttl };
    this.persist();
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   */
  has(key: string): boolean {
    return this.get<unknown>(key) !== null;
  }

  /**
   * Delete all entries from the cache.
   */
  clear(): void {
    this.store = {};
    this.persist();
  }

  /**
   * Remove all expired entries.
   */
  cleanup(): number {
    const now = Math.floor(Date.now() / 1000);
    let removed = 0;

    for (const [key, entry] of Object.entries(this.store)) {
      if (now - entry.createdAt > entry.ttl) {
        delete this.store[key];
        removed++;
      }
    }

    if (removed > 0) this.persist();
    return removed;
  }

  /**
   * Return a human-readable string describing how old the cached entry is.
   */
  getCacheAge(key: string): string | null {
    const entry = this.store[key];
    if (!entry) return null;

    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = now - entry.createdAt;

    if (ageSeconds < 60) return "just now";

    const ageMinutes = Math.floor(ageSeconds / 60);
    if (ageMinutes < 60) {
      return `${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago`;
    }

    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) {
      return `${ageHours} hour${ageHours === 1 ? "" : "s"} ago`;
    }

    const ageDays = Math.floor(ageHours / 24);
    return `${ageDays} day${ageDays === 1 ? "" : "s"} ago`;
  }

  /**
   * Return the ISO-8601 timestamp of when a key was cached, or `null`.
   */
  getCachedAt(key: string): string | null {
    const entry = this.store[key];
    if (!entry) return null;
    return new Date(entry.createdAt * 1000).toISOString();
  }

  /**
   * Return total number of (non-expired) entries in the cache.
   */
  size(): number {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    for (const entry of Object.values(this.store)) {
      if (now - entry.createdAt <= entry.ttl) count++;
    }
    return count;
  }

  /**
   * No-op for API compatibility. JSON cache does not need explicit closing.
   */
  close(): void {
    // Nothing to close — included for drop-in compatibility
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): CacheStore {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        return JSON.parse(raw) as CacheStore;
      }
    } catch {
      // Corrupted file — start fresh
    }
    return {};
  }

  private persist(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.store), "utf-8");
    } catch {
      // Best-effort — cache persistence should never crash the process
    }
  }
}
