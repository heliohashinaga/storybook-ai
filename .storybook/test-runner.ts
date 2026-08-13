import type { TestRunnerConfig } from "@storybook/test-runner";
import { getStoryContext } from "@storybook/test-runner";
import { injectAxe, checkA11y } from "axe-playwright";

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
