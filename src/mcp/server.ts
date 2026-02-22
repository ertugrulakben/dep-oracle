/**
 * MCP stdio server entry point for dep-oracle.
 *
 * Exposes the full dep-oracle analysis engine as MCP tools so that
 * Claude (and other MCP clients) can scan projects, evaluate trust
 * scores, detect zombies, and more -- all through the standard
 * Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerTools } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkgVersion = (() => {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version as string;
  } catch {
    return '1.3.0';
  }
})();

const server = new Server(
  { name: 'dep-oracle', version: pkgVersion },
  { capabilities: { tools: {} } },
);

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
