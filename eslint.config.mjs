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
];
