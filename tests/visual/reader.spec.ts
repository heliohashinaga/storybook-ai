import { expect, test } from "@playwright/test";
import { switchToPortuguese } from "../e2e/helpers";

// Both reader specs below generate a full story through the deterministic fake
// provider (3 and 5 scenes). The five-scene generation can legitimately run up
// to the project's 120s end-to-end budget, so run them serially (no concurrent
// fake generations) with a 180s per-test budget (120s generation + margin).
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

/**
 * T037 — reader visual regression: one approved screenshot per scene position.
 *
 * Runs against the production build with the deterministic fake provider
 * (STORIES_TEST_MODE=fake); no live AI, no wall-clock dependence. Baselines
 * live in tests/visual/__screenshots__ and are reviewed before merge.
 *
 * The reader shows exactly one scene at a time (T040), so each position is
 * reached by navigating with the "next" button until the final scene, where
 * the button becomes disabled (forward bound).
 */
test.describe("reader visual regression", () => {
  test("reader scenes render consistently across all three positions", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);

    // The form defaults to en (defaultLocale "en"); switch the UI to pt-BR so
    // the interaction labels match the approved pt-BR screenshot baselines.
    await switchToPortuguese(page);

    // Deterministic form: age 6 -> band 5-7, pt-BR and courage theme.
    await page.getByRole("slider", { name: /Idade/i }).fill("6");
    await page.getByRole("button", { name: /^Coragem/i }).click();
    // Register the response waiter BEFORE submitting (anti-race: the fake
    // provider can answer before a waiter registered after the click).
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /criar história/i }).click();
    await response;
    await expect(page).toHaveURL(/\/reader$/);

    const reader = page.getByRole("region", { name: /sua história/i });
    await expect(reader).toBeVisible();
    const illustration = page.locator('img[src^="data:image/webp;base64,"]').first();
    await expect(illustration).toBeVisible();

    // Scene 1 — initial position.
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();
    await expect(reader).toHaveScreenshot("reader-scene-1.png");

    // Scene 2.
    await page.getByRole("button", { name: /^Próxima$/i }).click();
    await expect(page.getByText("Cena 2 de 3")).toBeVisible();
    await expect(reader).toHaveScreenshot("reader-scene-2.png");

    // Scene 3 — final position, "next" disabled.
    await page.getByRole("button", { name: /^Próxima$/i }).click();
    await expect(page.getByText("Cena 3 de 3")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();
    await expect(reader).toHaveScreenshot("reader-scene-3.png");
  });

  /**
   * T035 — a five-scene story (MAX_SCENES) renders consistently at every
   * position, including the added middle scenes (4 and 5), with the "next"
   * button only disabled on the true final scene.
   *
   * Same deterministic setup as above, but the 5-cena radio is selected so a
   * longer story exercises mid-arc navigation and the final forward bound.
   */
  test("a five-scene story renders consistently across every position", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);

    // Same pt-BR switch as above (baselines are approved in pt-BR).
    await switchToPortuguese(page);

    // Deterministic form: age 6 -> band 5-7, pt-BR/courage, 5 scenes.
    await page.getByRole("slider", { name: /Idade/i }).fill("6");
    await page.getByRole("button", { name: /5cenas/i }).click();
    await page.getByRole("button", { name: /^Coragem/i }).click();
    // Same anti-race pattern: register the waiter before submitting.
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /criar história/i }).click();
    await response;
    await expect(page).toHaveURL(/\/reader$/);

    const reader = page.getByRole("region", { name: /sua história/i });
    await expect(reader).toBeVisible();
    const illustration = page.locator('img[src^="data:image/webp;base64,"]').first();
    await expect(illustration).toBeVisible();

    // Scene 1 — initial position.
    await expect(page.getByText("Cena 1 de 5")).toBeVisible();
    await expect(reader).toHaveScreenshot("five-scene-1.png");

    const next = page.getByRole("button", { name: /^Próxima$/i });

    // Scenes 2-4 — middle positions.
    for (let sceneNo = 2; sceneNo <= 4; sceneNo += 1) {
      await next.click();
      await expect(page.getByText(`Cena ${sceneNo} de 5`)).toBeVisible();
      await expect(page.getByRole("button", { name: /^Próxima$/i })).toBeEnabled();
      await expect(reader).toHaveScreenshot(`five-scene-${sceneNo}.png`);
    }

    // Scene 5 — final position, "next" disabled (forward bound).
    await next.click();
    await expect(page.getByText("Cena 5 de 5")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();
    await expect(reader).toHaveScreenshot("five-scene-5.png");
  });
});
