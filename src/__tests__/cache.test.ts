import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from '../cache/store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function createTmpCachePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dep-oracle-cache-test-'));
  return join(dir, 'cache.json');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CacheManager', () => {
  let cachePath: string;
  let cache: CacheManager;

  beforeEach(() => {
    cachePath = createTmpCachePath();
    cache = new CacheManager(cachePath);
  });

  afterEach(() => {
    cache.close();
    // Clean up the temp directory
    const dir = join(cachePath, '..');
    rmSync(dir, { recursive: true, force: true });
  });

  it('get() returns null for a missing key', () => {
    const result = cache.get('nonexistent-key');
    expect(result).toBeNull();
  });

  it('set() and get() roundtrip works for a string value', () => {
    cache.set('my-key', 'hello world');
    const result = cache.get<string>('my-key');
    expect(result).toBe('hello world');
  });

  it('set() and get() roundtrip works for an object value', () => {
    const data = { name: 'express', version: '4.18.2', score: 95 };
    cache.set('pkg:express', data);
    const result = cache.get<typeof data>('pkg:express');
    expect(result).toEqual(data);
  });

  it('expired entries return null', () => {
    // We set a TTL of 1 second and then manipulate time
    cache.set('short-lived', 'value', 1); // 1 second TTL

    // Mock Date.now to return a time 10 seconds in the future
    const originalNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 10_000);

    const result = cache.get<string>('short-lived');
    expect(result).toBeNull();

    vi.restoreAllMocks();
  });

  it('non-expired entries return their value', () => {
    cache.set('long-lived', 'still-here', 86400); // 24 hour TTL
    const result = cache.get<string>('long-lived');
    expect(result).toBe('still-here');
  });

  it('has() returns true for existing non-expired key', () => {
    cache.set('exists', true);
    expect(cache.has('exists')).toBe(true);
  });

  it('has() returns false for missing key', () => {
    expect(cache.has('does-not-exist')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size()).toBe(3);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('close() does not throw', () => {
    expect(() => cache.close()).not.toThrow();
  });

  it('size() returns the correct count of non-expired entries', () => {
    cache.set('x', 1);
    cache.set('y', 2);
    expect(cache.size()).toBe(2);
  });

  it('cleanup() removes expired entries and returns count', () => {
    cache.set('stale', 'old', 1); // 1 second TTL
    cache.set('fresh', 'new', 86400);

    // Advance time past the stale entry TTL
    const originalNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 5000);

    const removed = cache.cleanup();
    expect(removed).toBe(1);
    expect(cache.get('stale')).toBeNull();

    vi.restoreAllMocks();
    // fresh should still be accessible after restoring time
    expect(cache.get('fresh')).toBe('new');
  });

  it('persists data across instances with the same file path', () => {
    cache.set('persistent', 'data');
    cache.close();

    const cache2 = new CacheManager(cachePath);
    const result = cache2.get<string>('persistent');
    expect(result).toBe('data');
    cache2.close();
  });

  it('getCacheAge() returns null for missing key', () => {
    expect(cache.getCacheAge('no-such-key')).toBeNull();
  });

  it('getCacheAge() returns a human-readable string for existing key', () => {
    cache.set('timed-key', 'value');
    const age = cache.getCacheAge('timed-key');
    expect(age).toBe('just now');
  });

  it('getCachedAt() returns ISO timestamp for existing key', () => {
    cache.set('dated-key', 42);
    const timestamp = cache.getCachedAt('dated-key');
    expect(timestamp).not.toBeNull();
    // Should be a valid ISO date string
    expect(() => new Date(timestamp!)).not.toThrow();
    expect(new Date(timestamp!).getFullYear()).toBeGreaterThanOrEqual(2024);
  });
});
