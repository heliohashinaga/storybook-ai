import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { fileURLToPath } from "node:url";

// AGENTS.md coverage gates:
//  - ≥80% overall across statements, lines, branches, functions.
//  - ≥90% for every safety/validation/direct-identifier-exclusion/orchestration
//    module, enforced per-file so a single hot path can't carry the others.
const MODULE_THRESHOLD = { lines: 90, functions: 90, statements: 90, branches: 90 };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // server-only is a no-op outside the Next.js server boundary; allow
      // server modules (src/lib/env) to be imported by Node tests.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
      // Next's `next/server` subpath is not resolvable in Vitest, so
      // route/contract tests use a shape stub.
      "next/server": fileURLToPath(new URL("./tests/stubs/next-server.ts", import.meta.url)),
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
      // ≥80% global floor (all files) …
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // … and ≥90% per safety/validation/orchestration module.
        "**/features/story-generation/server/safety-pipeline.ts": MODULE_THRESHOLD,
        "**/features/story-generation/server/schemas.ts": MODULE_THRESHOLD,
        "**/features/story-generation/server/generation-runtime.ts": MODULE_THRESHOLD,
        "**/features/story-generation/server/generate-story.ts": MODULE_THRESHOLD,
        "**/features/story-request/client/story-preferences-schema.ts": MODULE_THRESHOLD,
        "**/features/story-request/client/age-band.ts": MODULE_THRESHOLD,
        "**/features/story-generation/server/turnstile-verify.ts": MODULE_THRESHOLD,
      },
    },
  },
});
