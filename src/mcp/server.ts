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
import { registerTools } from './tools.js';

const server = new Server(
  { name: 'dep-oracle', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
