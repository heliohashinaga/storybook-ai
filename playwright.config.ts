import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
// Shared, user-level cache (outside any git worktree) so browsers install and
// native deps are reused across every devloop slice instead of being rebuilt
// per slice. See ADR 0002. Native libraries (e.g. libasound.so.2) are vendored
// here by `scripts/setup-chromium-deps.sh`; scripts/run-with-chromium.sh
// prepends the same dir to LD_LIBRARY_PATH for the Playwright and Storybook
// runners even when launched outside this config.
const SHARED_CACHE = path.join(
  process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
  "storybook-ai-e2e"
);
const DEFAULT_NATIVE_LIBRARY_PATH = path.join(SHARED_CACHE, "lib");

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
  // E2E runs against a production build (`next start`), not `next dev`: no
  // on-demand cold-compile in the test window, deterministic and fast.
  // `pnpm build` is a precondition (see the pretest:* hooks in package.json);
  // each slice builds the exact code under test — never reused across different
  // code states. See ADR 0002.
  webServer: {
    command: "pnpm start",
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
