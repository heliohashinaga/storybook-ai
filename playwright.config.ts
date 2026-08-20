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

// Mobile-layout test matrix (feature 016, mobile-ux-refinements). Opt-in via
// `E2E_MOBILE=1` so the default desktop suite stays green and no extra browser
// is required unless asked. Scoped to the layout/visual specs (testMatch).
// When `E2E_WEBKIT=1` is ALSO set, WebKit (iOS Safari engine) viewports are
// added on top — requires `pnpm exec playwright install webkit`.
const E2E_MOBILE = process.env.E2E_MOBILE === "1";
const E2E_WEBKIT = process.env.E2E_WEBKIT === "1";

// 2026 mobile viewport matrix. Width is what drives layout (a device model is
// only a proxy for width × engine); heights are representative portrait sizes.
const MOBILE_VISUAL_MATCH = "tests/visual/**/*.spec.ts";
const MOBILE_VIEWPORTS = [
  { name: "mobile-small", width: 320, height: 568 }, // piso (feature 016 SC-001)
  { name: "mobile-main", width: 390, height: 844 }, // iPhone 13/14/15/16 (390)
  { name: "mobile-large", width: 430, height: 932 }, // Pro Max / grande
  { name: "tablet-portrait", width: 768, height: 1024 }, // iPad retrato
];

const mobileProjects = E2E_MOBILE
  ? [
      ...MOBILE_VIEWPORTS.map(({ name, width, height }) => ({
        name,
        testMatch: MOBILE_VISUAL_MATCH,
        use: {
          browserName: "chromium" as const,
          viewport: { width, height },
          isMobile: true,
          hasTouch: true,
        },
      })),
      ...(E2E_WEBKIT
        ? [
            {
              name: "mobile-main-webkit",
              testMatch: MOBILE_VISUAL_MATCH,
              use: { ...devices["iPhone 14"], browserName: "webkit" as const },
            },
            {
              name: "mobile-small-webkit",
              testMatch: MOBILE_VISUAL_MATCH,
              use: { ...devices["iPhone SE"], browserName: "webkit" as const },
            },
          ]
        : []),
    ]
  : [];

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
    baseURL: `http://127.0.0.1:${PORT}`,
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
    ...mobileProjects,
  ],
  // E2E runs against a production build (`next start`), not `next dev`: no
  // on-demand cold-compile in the test window, deterministic and fast.
  // `pnpm build` is a precondition (see the pretest:* hooks in package.json);
  // each slice builds the exact code under test — never reused across different
  // code states. See ADR 0002.
  webServer: {
    command: "pnpm start",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // E2E/visual/perf must be deterministic and offline: they run against the
    // fixed dev provider, never a paid/live model (AGENTS.md privacy/model
    // rules). A caller can still force a real provider by pre-setting
    // STORIES_TEST_MODE in their environment; default here is the fake.
    env: {
      ...(process.env.STORIES_TEST_MODE ? {} : { STORIES_TEST_MODE: "fake" }),
      // Auth.js must trust and rotate the suite's own origin: the specs drive
      // the browser against 127.0.0.1, so a localhost AUTH_URL (as in
      // .env.local) breaks cookie/CSRF host matching (MissingCSRF redirects)
      // and makes the sign-out journey flaky.
      AUTH_URL: `http://127.0.0.1:${PORT}`,
      ...(process.env.AUTH_TRUST_HOST ? {} : { AUTH_TRUST_HOST: "true" }),
      // E2E/visual/perf run against a production `next start` server, where the
      // dev-only fake load provides no UX value. Zero it here so suites stay fast
      // and deterministic: the multi-story E2E (4 generations) and the perf
      // budget check both depend on generation completing quickly. The progress
      // UI is still exercised via deferred-fetch tests (frontend-routing.spec),
      // not via this wall-clock delay. `pnpm dev` keeps the 1000ms default for
      // the intended UX-012 progress visibility.
      ...(process.env.STORY_FAKE_STEP_DELAY_MS ? {} : { STORY_FAKE_STEP_DELAY_MS: "0" }),
      ...(process.env.STORY_RATE_LIMIT_MAX_REQUESTS
        ? {}
        : { STORY_RATE_LIMIT_MAX_REQUESTS: "100" }),
      ...(process.env.STORY_RATE_LIMIT_WINDOW_MS ? {} : { STORY_RATE_LIMIT_WINDOW_MS: "60000" }),
      // AI narration is exercised in the ai-read-aloud e2e spec. With
      // STORIES_TEST_MODE=fake the server uses the offline fixed TTS provider,
      // so enabling narration is deterministic and needs no credentials; a
      // caller can override by pre-setting AI_NARRATION_ENABLED.
      ...(process.env.AI_NARRATION_ENABLED ? {} : { AI_NARRATION_ENABLED: "true" }),
    },
  },
  // Visual regression: approved screenshots live next to each spec in its
  // `<spec>.spec.ts-snapshots/` directory (Playwright default).
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
});
