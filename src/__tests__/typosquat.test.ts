import { describe, it, expect } from 'vitest';
import { TyposquatDetector } from '../analyzers/typosquat.js';

describe('TyposquatDetector', () => {
  const detector = new TyposquatDetector();

  // -----------------------------------------------------------------------
  // Known popular packages are safe
  // -----------------------------------------------------------------------

  it('returns not risky for a known popular package (express)', () => {
    const result = detector.check('express');
    expect(result.isRisky).toBe(false);
    expect(result.similarPackages).toHaveLength(0);
    expect(result.distance).toBe(0);
  });

  it('returns not risky for another known popular package (lodash)', () => {
    const result = detector.check('lodash');
    expect(result.isRisky).toBe(false);
  });

  it('returns not risky for a scoped known package (@babel/core)', () => {
    const result = detector.check('@babel/core');
    expect(result.isRisky).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Doubled letter detection
  // -----------------------------------------------------------------------

  it('detects doubled letter typosquat (expresss)', () => {
    const result = detector.check('expresss');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('express');
  });

  it('detects doubled letter typosquat (reactt)', () => {
    const result = detector.check('reactt');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('react');
  });

  // -----------------------------------------------------------------------
  // Transposed letter detection
  // -----------------------------------------------------------------------

  it('detects transposed letter typosquat (exrpess)', () => {
    const result = detector.check('exrpess');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('express');
  });

  // -----------------------------------------------------------------------
  // Homoglyph detection
  // -----------------------------------------------------------------------

  it('detects homoglyph typosquat (1odash vs lodash)', () => {
    const result = detector.check('1odash');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('lodash');
  });

  it('detects homoglyph typosquat (l0dash vs lodash)', () => {
    const result = detector.check('l0dash');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('lodash');
  });

  // -----------------------------------------------------------------------
  // Suffix pattern detection
  // -----------------------------------------------------------------------

  it('detects suffix pattern (react-js vs react)', () => {
    const result = detector.check('react-js');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('react');
  });

  it('detects suffix pattern (express-node)', () => {
    const result = detector.check('express-node');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('express');
  });

  // -----------------------------------------------------------------------
  // Missing letter detection
  // -----------------------------------------------------------------------

  it('detects missing letter typosquat (expres vs express)', () => {
    const result = detector.check('expres');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('express');
  });

  // -----------------------------------------------------------------------
  // Completely different name
  // -----------------------------------------------------------------------

  it('returns not risky for a completely different name', () => {
    const result = detector.check('zzz-my-unique-internal-pkg');
    expect(result.isRisky).toBe(false);
    expect(result.similarPackages).toHaveLength(0);
  });

  it('returns not risky for another unrelated name', () => {
    const result = detector.check('totally-random-package-name-xyz');
    expect(result.isRisky).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Levenshtein distance correctness
  // -----------------------------------------------------------------------

  it('reports correct minimum distance for typosquats', () => {
    const result = detector.check('expresss');
    // "expresss" vs "express" -> distance 1 (one extra s)
    expect(result.distance).toBeLessThanOrEqual(2);
    expect(result.distance).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Custom extra packages
  // -----------------------------------------------------------------------

  it('detects typosquats against custom extra popular packages', () => {
    const custom = new TyposquatDetector(['my-company-lib']);
    const result = custom.check('my-company-libb');
    expect(result.isRisky).toBe(true);
    expect(result.similarPackages).toContain('my-company-lib');
  });
});
