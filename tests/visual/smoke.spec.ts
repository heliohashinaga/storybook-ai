import { test, expect } from "@playwright/test";

/**
 * Phase 1 visual smoke test. Confirms the root route renders in the real
 * browser. Approved-screenshot visual regression baselines (reader screen,
 * etc.) are introduced with the feature work in Phase 3+.
 */
test("root route renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  // The root redirects to /form; default locale is en (defaultLocale "en").
  await expect(page.locator("html[lang='en']")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
});
