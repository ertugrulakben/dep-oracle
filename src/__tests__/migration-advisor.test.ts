import { describe, it, expect } from 'vitest';
import { MigrationAdvisor } from '../analyzers/migration-advisor.js';

describe('MigrationAdvisor', () => {
  const advisor = new MigrationAdvisor();

  // -----------------------------------------------------------------------
  // suggest()
  // -----------------------------------------------------------------------

  it('returns suggestions for a known deprecated package (moment)', () => {
    const suggestions = advisor.suggest('moment', 'low trust score');
    expect(suggestions.length).toBeGreaterThan(0);
    const names = suggestions.map((s) => s.alternative);
    expect(names).toContain('dayjs');
    expect(names).toContain('date-fns');
  });

  it('returns suggestions for "request" with proper alternatives', () => {
    const suggestions = advisor.suggest('request', 'deprecated');
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    const names = suggestions.map((s) => s.alternative);
    expect(names).toContain('axios');
    expect(names).toContain('got');
  });

  it('includes the reason in suggestion descriptions', () => {
    const suggestions = advisor.suggest('moment', 'zombie dependency');
    for (const s of suggestions) {
      expect(s.description).toContain('zombie dependency');
    }
  });

  it('returns empty array for an unknown package', () => {
    const suggestions = advisor.suggest('my-random-package-that-doesnt-exist', 'test');
    expect(suggestions).toHaveLength(0);
  });

  it('handles case-insensitive package names', () => {
    const suggestions = advisor.suggest('MOMENT', 'test');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('includes difficulty in each suggestion', () => {
    const suggestions = advisor.suggest('moment', 'test');
    for (const s of suggestions) {
      expect(['easy', 'moderate', 'hard']).toContain(s.difficulty);
    }
  });

  // -----------------------------------------------------------------------
  // hasSuggestions()
  // -----------------------------------------------------------------------

  it('returns true for a package with known migration path', () => {
    expect(advisor.hasSuggestions('moment')).toBe(true);
    expect(advisor.hasSuggestions('lodash')).toBe(true);
    expect(advisor.hasSuggestions('request')).toBe(true);
  });

  it('returns false for a package without migration path', () => {
    expect(advisor.hasSuggestions('my-custom-internal-pkg')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getSupportedPackages()
  // -----------------------------------------------------------------------

  it('returns a sorted list of all supported packages', () => {
    const packages = advisor.getSupportedPackages();
    expect(packages.length).toBeGreaterThan(10);
    // Verify sorted
    const sorted = [...packages].sort();
    expect(packages).toEqual(sorted);
  });

  it('includes well-known packages in the supported list', () => {
    const packages = advisor.getSupportedPackages();
    expect(packages).toContain('moment');
    expect(packages).toContain('request');
    expect(packages).toContain('lodash');
    expect(packages).toContain('underscore');
  });

  // -----------------------------------------------------------------------
  // Custom extra mappings
  // -----------------------------------------------------------------------

  it('merges custom extra mappings into the migration map', () => {
    const customAdvisor = new MigrationAdvisor({
      'my-old-lib': [
        {
          alternative: 'my-new-lib',
          description: 'Rewrite with modern APIs.',
          difficulty: 'easy',
        },
      ],
    });

    expect(customAdvisor.hasSuggestions('my-old-lib')).toBe(true);
    const suggestions = customAdvisor.suggest('my-old-lib', 'legacy');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].alternative).toBe('my-new-lib');
  });

  it('custom mappings do not overwrite built-in mappings for other packages', () => {
    const customAdvisor = new MigrationAdvisor({
      'my-old-lib': [{ alternative: 'my-new-lib', description: 'test', difficulty: 'easy' }],
    });
    // moment should still work
    expect(customAdvisor.hasSuggestions('moment')).toBe(true);
  });
});
