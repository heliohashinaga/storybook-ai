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
    },
  },
];
