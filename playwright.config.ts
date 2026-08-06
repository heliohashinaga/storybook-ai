import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
// Chromium may need native libraries (e.g. libasound.so.2) to launch on a
// minimal Linux host. Point at the project-local vendored copies produced by
// `scripts/setup-chromium-deps.sh` (gitignored). scripts/run-with-chromium.sh
// prepends the same path so the Playwright and Storybook test runners both
// pick it up even when launched outside this config.
const DEFAULT_NATIVE_LIBRARY_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".playwright-deps",
  "lib"
);

if (
  process.platform === "linux" &&
  !process.env.LD_LIBRARY_PATH &&
  existsSync(DEFAULT_NATIVE_LIBRARY_PATH)
) {
  process.env.LD_LIBRARY_PATH = DEFAULT_NATIVE_LIBRARY_PATH;
}

export default defineConfig({
  testDir: "./tests",
  // Playwright specs only — Vitest unit tests use `.test.ts(x)` and live
  // under `tests/` + `src/`; scoping here avoids the two runners colliding.
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never" }]]
    : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Anonymous by design: no cookies/persistent state. Visual snapshots in
    // `tests/visual` use screenshot-based regression via `toHaveScreenshot`.
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Visual regression: approved screenshots live in tests/visual/__screenshots__.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
});
