import { describe, it, expect } from 'vitest';
import {
  createDependencyNode,
  createDependencyTree,
  collectorSuccess,
  collectorError,
  collectorCached,
  collectorOffline,
} from '../parsers/schema.js';

describe('Schema helper functions', () => {
  // -----------------------------------------------------------------------
  // createDependencyNode
  // -----------------------------------------------------------------------

  describe('createDependencyNode()', () => {
    it('creates a node with default depth 0 and isDirect true', () => {
      const node = createDependencyNode({ name: 'express', version: '4.18.2', registry: 'npm' });
      expect(node.name).toBe('express');
      expect(node.version).toBe('4.18.2');
      expect(node.depth).toBe(0);
      expect(node.isDirect).toBe(true);
      expect(node.parent).toBeNull();
      expect(node.registry).toBe('npm');
    });

    it('creates a transitive node with specified depth', () => {
      const node = createDependencyNode({
        name: 'accepts',
        version: '1.3.8',
        registry: 'npm',
        depth: 2,
        parent: 'express',
      });
      expect(node.depth).toBe(2);
      expect(node.isDirect).toBe(false);
      expect(node.parent).toBe('express');
    });

    it('creates a pypi node', () => {
      const node = createDependencyNode({ name: 'flask', version: '2.3.0', registry: 'pypi' });
      expect(node.registry).toBe('pypi');
    });
  });

  // -----------------------------------------------------------------------
  // createDependencyTree
  // -----------------------------------------------------------------------

  describe('createDependencyTree()', () => {
    it('creates an empty tree with the given root and manifest', () => {
      const tree = createDependencyTree('my-project', '/path/to/package.json');
      expect(tree.root).toBe('my-project');
      expect(tree.manifest).toBe('/path/to/package.json');
      expect(tree.nodes.size).toBe(0);
      expect(tree.totalDirect).toBe(0);
      expect(tree.totalTransitive).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // CollectorResult helpers
  // -----------------------------------------------------------------------

  describe('collectorSuccess()', () => {
    it('wraps data with status "success"', () => {
      const result = collectorSuccess({ foo: 'bar' });
      expect(result.status).toBe('success');
      expect(result.data).toEqual({ foo: 'bar' });
      expect(result.error).toBeUndefined();
    });
  });

  describe('collectorError()', () => {
    it('wraps an error message with null data', () => {
      const result = collectorError('Network timeout');
      expect(result.status).toBe('error');
      expect(result.data).toBeNull();
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('collectorCached()', () => {
    it('wraps cached data with a collectedAt timestamp', () => {
      const ts = '2025-01-15T10:30:00.000Z';
      const result = collectorCached({ pkg: 'express' }, ts);
      expect(result.status).toBe('cached');
      expect(result.data).toEqual({ pkg: 'express' });
      expect(result.collectedAt).toBe(ts);
    });
  });

  describe('collectorOffline()', () => {
    it('wraps an offline response with null data and error message', () => {
      const result = collectorOffline();
      expect(result.status).toBe('offline');
      expect(result.data).toBeNull();
      expect(result.error).toContain('offline');
    });
  });
});
