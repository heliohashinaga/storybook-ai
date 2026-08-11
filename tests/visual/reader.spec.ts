import { expect, test } from "@playwright/test";

/**
 * T037 — reader visual regression: one approved screenshot per scene position.
 *
 * Runs against the production build with the deterministic fake provider
 * (STORIES_PROVIDER=fake); no live AI, no wall-clock dependence. Baselines
 * live in tests/visual/__screenshots__ and are reviewed before merge.
 *
 * The reader shows exactly one scene at a time (T040), so each position is
 * reached by navigating with the "next" button until the final scene, where
 * the button becomes disabled (forward bound).
 */
test("reader scenes render consistently across all three positions", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);

  // Deterministic form: age 6 -> band 5-7, default pt-BR and courage theme.
  await page.getByLabel(/idade da criança/i).fill("6");
  await page.getByRole("button", { name: /criar história/i }).click();

  const reader = page.getByRole("region", { name: /sua história/i });
  await expect(reader).toBeVisible();
  const illustration = page.locator('img[src^="data:image/webp;base64,"]');
  await expect(illustration).toBeVisible();

  // Scene 1 — initial position.
  await expect(page.getByText("Cena 1 de 3")).toBeVisible();
  await expect(reader).toHaveScreenshot("reader-scene-1.png");

  // Scene 2.
  await page.getByRole("button", { name: /próxima cena/i }).click();
  await expect(page.getByText("Cena 2 de 3")).toBeVisible();
  await expect(reader).toHaveScreenshot("reader-scene-2.png");

  // Scene 3 — final position, "next" disabled.
  await page.getByRole("button", { name: /próxima cena/i }).click();
  await expect(page.getByText("Cena 3 de 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /próxima cena/i })).toBeDisabled();
  await expect(reader).toHaveScreenshot("reader-scene-3.png");
});
