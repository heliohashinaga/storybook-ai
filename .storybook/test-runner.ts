import type { TestRunnerConfig } from "@storybook/test-runner";
import { getStoryContext } from "@storybook/test-runner";
import { injectAxe, checkA11y } from "axe-playwright";

/**
 * Storybook 10 initializes its preview (and the story store that
 * test-runner's `getStoryContext` reads in `postVisit`) asynchronously,
 * after the manager finishes navigating to a story. `postVisit` can therefore
 * run before `window.__STORYBOOK_PREVIEW__.storyStoreValue` is populated,
 * making every `getStoryContext(...)` call throw
 * `Cannot read properties of undefined (reading 'storyStore')`.
 *
 * Waiting for DOM load states alone is insufficient (it does not correlate
 * with the store being ready), so we poll until the story store index is
 * present before visiting each story.
 */
async function waitForStorybookStoreReady(page: import("@playwright/test").Page): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const preview = (globalThis as Record<string, unknown>)["__STORYBOOK_PREVIEW__"];
      if (!preview) return false;
      const store = (preview as Record<string, unknown>)["storyStoreValue"];
      if (!store) return false;
      const storyIndex = (store as Record<string, unknown>)["storyIndex"];
      return Boolean(storyIndex && (storyIndex as { entries?: unknown }).entries);
    });
  } catch {
    // If the store never becomes ready within the timeout, let the subsequent
    // a11y/context calls surface the real error instead of masking it.
  }
}

/**
 * Storybook test-runner config: renders every story and runs axe a11y checks
 * against it (WCAG 2 A/AA). Per-story opt-out via `parameters.a11y.disable`.
 */
const config: TestRunnerConfig = {
  async prepare({ page }) {
    // Workaround for a known test-runner/Storybook navigation issue where the
    // hard iframe navigation on slow/loaded hosts exceeds Playwright's default
    // 30s `page.goto` timeout (the fixed ({{viewMode}}) URL is re-navigated).
    // Bumping the default here keeps the a11y checks unchanged.
    await page.setDefaultTimeout(120_000);
  },
  async preVisit(page) {
    await waitForStorybookStoreReady(page);
    await injectAxe(page);
  },
  async postVisit(page, context) {
    const storyContext = await getStoryContext(page, context);
    if (storyContext?.parameters?.a11y?.disable) {
      return;
    }
    await checkA11y(page, "#storybook-root", {
      detailedReport: true,
      detailedReportOptions: { html: true },
      runOptions: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      },
    });
  },
};

export default config;
