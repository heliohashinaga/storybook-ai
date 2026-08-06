import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // server-only is a no-op outside the Next.js server boundary; allow
      // server modules (src/lib/env) to be imported by Node tests.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/app/**",
        "src/i18n/**",
        "src/lib/**",
      ],
      // AGENTS.md: ≥80% overall; ≥90% for safety/validation/orchestration are
      // enforced via per-file thresholds applied in Phase 2+ once real modules
      // exist. Global floor applies now (Phase 1 has no src modules to measure).
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
