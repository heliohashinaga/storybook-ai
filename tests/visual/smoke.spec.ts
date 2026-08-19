import { test, expect } from "@playwright/test";

/**
 * Phase 1 visual smoke test. Confirms the root route renders in the real
 * browser. Approved-screenshot visual regression baselines (reader screen,
 * etc.) are introduced with the feature work in Phase 3+.
 *
 * Spec 015 changed the contract: `/` is now the login gate (it no longer
 * redirects to `/form`). The smoke asserts the gate itself renders with its
 * English heading and anonymous "Explore the Demo" entry point.
 */
test("root route renders the login gate", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  // Default locale is en (defaultLocale "en").
  await expect(page.locator("html[lang='en']")).toHaveCount(1);
  // The login gate is up with its English heading and the anonymous demo entry.
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore the Demo/i })).toBeVisible();
  // An anonymous visitor is NOT redirected off the gate to /form (spec 015).
  await expect(page).toHaveURL(/\/$/);
});
