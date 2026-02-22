import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NpmParser } from '../parsers/npm.js';
import { PythonParser } from '../parsers/python.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'dep-oracle-test-'));
}

// ---------------------------------------------------------------------------
// NpmParser tests
// ---------------------------------------------------------------------------

describe('NpmParser', () => {
  const parser = new NpmParser();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('has name "npm"', () => {
    expect(parser.name).toBe('npm');
  });

  it('detect() returns true when package.json exists', async () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const result = await parser.detect(tmpDir);
    expect(result).toBe(true);
  });

  it('detect() returns false in an empty directory', async () => {
    const result = await parser.detect(tmpDir);
    expect(result).toBe(false);
  });

  it('parse() extracts direct dependencies from package.json', async () => {
    const pkg = {
      name: 'my-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        lodash: '^4.17.21',
      },
      devDependencies: {
        vitest: '^2.0.0',
      },
    };
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tree = await parser.parse(tmpDir);
    expect(tree.root).toBe('my-project');
    expect(tree.totalDirect).toBe(3);

    // Check that all three deps exist
    const names = [...tree.nodes.values()].map((n) => n.name);
    expect(names).toContain('express');
    expect(names).toContain('lodash');
    expect(names).toContain('vitest');
  });

  it('parse() handles package.json with no dependencies', async () => {
    const pkg = { name: 'empty-project', version: '0.0.1' };
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tree = await parser.parse(tmpDir);
    expect(tree.root).toBe('empty-project');
    expect(tree.totalDirect).toBe(0);
    expect(tree.totalTransitive).toBe(0);
    expect(tree.nodes.size).toBe(0);
  });

  it('parse() defaults root to "unknown" when name is missing', async () => {
    const pkg = { dependencies: { chalk: '^5.0.0' } };
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tree = await parser.parse(tmpDir);
    expect(tree.root).toBe('unknown');
  });

  it('parse() reads package-lock.json for transitive deps', async () => {
    const pkg = {
      name: 'lock-test',
      dependencies: { express: '^4.18.0' },
    };
    const lockfile = {
      lockfileVersion: 3,
      packages: {
        '': { name: 'lock-test', version: '1.0.0' },
        'node_modules/express': { version: '4.18.2' },
        'node_modules/express/node_modules/accepts': { version: '1.3.8' },
        'node_modules/body-parser': { version: '1.20.2' },
      },
    };
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(tmpDir, 'package-lock.json'), JSON.stringify(lockfile));

    const tree = await parser.parse(tmpDir);
    expect(tree.nodes.size).toBeGreaterThanOrEqual(3);

    // express should be direct
    const expressNode = [...tree.nodes.values()].find((n) => n.name === 'express' && n.version === '4.18.2');
    expect(expressNode).toBeDefined();
    expect(expressNode!.isDirect).toBe(true);
  });

  it('parse() marks all nodes with registry "npm"', async () => {
    const pkg = {
      name: 'registry-test',
      dependencies: { chalk: '^5.0.0', express: '^4.0.0' },
    };
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify(pkg));

    const tree = await parser.parse(tmpDir);
    for (const node of tree.nodes.values()) {
      expect(node.registry).toBe('npm');
    }
  });
});

// ---------------------------------------------------------------------------
// PythonParser tests
// ---------------------------------------------------------------------------

describe('PythonParser', () => {
  const parser = new PythonParser();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('has name "python"', () => {
    expect(parser.name).toBe('python');
  });

  it('detect() returns true when requirements.txt exists', async () => {
    writeFileSync(join(tmpDir, 'requirements.txt'), 'flask==2.0.0\n');
    const result = await parser.detect(tmpDir);
    expect(result).toBe(true);
  });

  it('detect() returns true when pyproject.toml exists', async () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]\nname = "myapp"\n');
    const result = await parser.detect(tmpDir);
    expect(result).toBe(true);
  });

  it('detect() returns false in an empty directory', async () => {
    const result = await parser.detect(tmpDir);
    expect(result).toBe(false);
  });

  it('parse() extracts deps from requirements.txt', async () => {
    const content = [
      'flask==2.3.0',
      'requests>=2.28.0',
      'numpy',
      '# this is a comment',
      '',
      'django~=4.2',
    ].join('\n');

    writeFileSync(join(tmpDir, 'requirements.txt'), content);
    const tree = await parser.parse(tmpDir);

    expect(tree.totalDirect).toBe(4);
    const names = [...tree.nodes.values()].map((n) => n.name);
    expect(names).toContain('flask');
    expect(names).toContain('requests');
    expect(names).toContain('numpy');
    expect(names).toContain('django');
  });

  it('parse() normalizes Python package names (PEP 503)', async () => {
    const content = 'My_Package==1.0.0\nAnother.Package>=2.0\n';
    writeFileSync(join(tmpDir, 'requirements.txt'), content);

    const tree = await parser.parse(tmpDir);
    const names = [...tree.nodes.values()].map((n) => n.name);
    expect(names).toContain('my-package');
    expect(names).toContain('another-package');
  });

  it('parse() marks all nodes with registry "pypi"', async () => {
    writeFileSync(join(tmpDir, 'requirements.txt'), 'flask==2.0.0\nrequests>=2.0\n');
    const tree = await parser.parse(tmpDir);

    for (const node of tree.nodes.values()) {
      expect(node.registry).toBe('pypi');
    }
  });

  it('parse() handles pyproject.toml with project.dependencies', async () => {
    const content = `
[project]
name = "my-python-app"
version = "0.1.0"
dependencies = [
  "fastapi>=0.100.0",
  "uvicorn>=0.23.0",
]
`;
    writeFileSync(join(tmpDir, 'pyproject.toml'), content);
    const tree = await parser.parse(tmpDir);

    expect(tree.root).toBe('my-python-app');
    const names = [...tree.nodes.values()].map((n) => n.name);
    expect(names).toContain('fastapi');
    expect(names).toContain('uvicorn');
  });

  it('parse() skips comments and blank lines in requirements.txt', async () => {
    const content = '# comment\n\n  \nflask==1.0\n# another comment\n';
    writeFileSync(join(tmpDir, 'requirements.txt'), content);

    const tree = await parser.parse(tmpDir);
    expect(tree.totalDirect).toBe(1);
  });
});
