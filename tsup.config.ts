import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry — needs shebang for npx
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    target: "node20",
    platform: "node",
    sourcemap: true,
    dts: false,
    clean: true,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
  },
  // Library + MCP server — no shebang
  {
    entry: {
      index: "src/index.ts",
      "mcp/server": "src/mcp/server.ts",
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    splitting: true,
    sourcemap: true,
    dts: false,
    shims: true,
    outDir: "dist",
  },
  // GitHub Action — self-contained bundle
  {
    entry: { "action/index": "action/index.ts" },
    format: ["esm"],
    target: "node20",
    platform: "node",
    sourcemap: false,
    dts: false,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
    noExternal: [/./],
  },
]);
