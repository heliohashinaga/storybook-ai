import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    // Ignore build/cache/test-artifact directories and generated files.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      "next-env.d.ts",
      "*.config.*",
    ],
  },
  // Next.js core-web-vitals + strict TypeScript flat configs (native).
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow intentionally-unused function parameters prefixed with `_` (e.g.
      // a deterministic fake provider that must satisfy an interface contract
      // but ignores its input). Non-underscore unused args still warn.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Cyclomatic-complexity guard-rail. Threshold set to 16 (the current
      // global maximum) so the existing codebase stays green while new code is
      // kept from growing beyond it. Tracked as a follow-up to reduce the top
      // offenders toward a healthier limit (<=10): url-safety ipv4IsPrivate
      // (15), UI Progress/Select (~13/11), i18n deepMerge (12), and the
      // resolveDeps env-parse helpers (13-16, incl. TTS provider). Do NOT lower
      // the threshold until those functions are split.
      complexity: ["error", { max: 16 }],
    },
  },
];
