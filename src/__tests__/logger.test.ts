import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setVerbose, isVerbose, isDebug, logger, createLogger } from '../utils/logger.js';

describe('Logger utilities', () => {
  // Save original environment
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset verbose state before each test
    setVerbose(false);
    delete process.env.DEP_ORACLE_DEBUG;
  });

  afterEach(() => {
    setVerbose(false);
    process.env = { ...originalEnv };
  });

  // -----------------------------------------------------------------------
  // setVerbose / isVerbose
  // -----------------------------------------------------------------------

  it('setVerbose(true) enables verbose mode', () => {
    expect(isVerbose()).toBe(false);
    setVerbose(true);
    expect(isVerbose()).toBe(true);
  });

  it('setVerbose(false) disables verbose mode', () => {
    setVerbose(true);
    setVerbose(false);
    expect(isVerbose()).toBe(false);
  });

  it('isVerbose() returns correct state after multiple toggles', () => {
    setVerbose(true);
    setVerbose(false);
    setVerbose(true);
    expect(isVerbose()).toBe(true);
  });

  // -----------------------------------------------------------------------
  // isDebug
  // -----------------------------------------------------------------------

  it('isDebug() returns false when DEP_ORACLE_DEBUG is not set', () => {
    delete process.env.DEP_ORACLE_DEBUG;
    expect(isDebug()).toBe(false);
  });

  it('isDebug() returns true when DEP_ORACLE_DEBUG is "1"', () => {
    process.env.DEP_ORACLE_DEBUG = '1';
    expect(isDebug()).toBe(true);
  });

  it('isDebug() returns true when DEP_ORACLE_DEBUG is "true"', () => {
    process.env.DEP_ORACLE_DEBUG = 'true';
    expect(isDebug()).toBe(true);
  });

  it('isDebug() returns true when DEP_ORACLE_DEBUG is "yes"', () => {
    process.env.DEP_ORACLE_DEBUG = 'yes';
    expect(isDebug()).toBe(true);
  });

  it('isDebug() returns true for case-insensitive "TRUE"', () => {
    process.env.DEP_ORACLE_DEBUG = 'TRUE';
    expect(isDebug()).toBe(true);
  });

  it('isDebug() returns false for non-truthy values like "0"', () => {
    process.env.DEP_ORACLE_DEBUG = '0';
    expect(isDebug()).toBe(false);
  });

  it('isDebug() returns false for empty string', () => {
    process.env.DEP_ORACLE_DEBUG = '';
    expect(isDebug()).toBe(false);
  });

  // -----------------------------------------------------------------------
  // logger output behavior
  // -----------------------------------------------------------------------

  it('logger.warn writes to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.warn('test warning');
    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0][0] as string;
    expect(written).toContain('test warning');
    spy.mockRestore();
  });

  it('logger.error writes to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('test error');
    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0][0] as string;
    expect(written).toContain('test error');
    spy.mockRestore();
  });

  it('logger.info does NOT write when verbose is off and debug is off', () => {
    setVerbose(false);
    delete process.env.DEP_ORACLE_DEBUG;
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.info('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.info writes when verbose is on', () => {
    setVerbose(true);
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.info('verbose info');
    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0][0] as string;
    expect(written).toContain('verbose info');
    spy.mockRestore();
  });

  it('logger.debug does NOT write when DEP_ORACLE_DEBUG is not set', () => {
    delete process.env.DEP_ORACLE_DEBUG;
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logger.debug writes when DEP_ORACLE_DEBUG is "1"', () => {
    process.env.DEP_ORACLE_DEBUG = '1';
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.debug('debug message');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // createLogger
  // -----------------------------------------------------------------------

  it('createLogger prefixes messages with the label', () => {
    setVerbose(true);
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = createLogger('test-module');
    log.info('hello from module');
    expect(spy).toHaveBeenCalledTimes(1);
    const written = spy.mock.calls[0][0] as string;
    expect(written).toContain('test-module');
    expect(written).toContain('hello from module');
    spy.mockRestore();
  });
});
