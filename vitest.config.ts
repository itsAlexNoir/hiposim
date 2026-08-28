import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone config for `vitest`, kept separate from vite.config.ts (which
// Tauri drives and expects a fixed dev-server port). Only src/core is
// unit-tested — see plan: "the UI is not unit-tested; the engine is, hard."
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // The engine (src/core) is the hard-tested layer; src/data covers the
    // small static Salamanca dataset with a sanity check.
    include: ["src/core/**/*.test.ts", "src/data/**/*.test.ts"],
  },
});
