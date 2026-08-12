import { expect, test, type Page } from "@playwright/test";

/**
 * Fills the anonymous request form (age 6 → band 5-7, courage theme, 5 scenes)
 * and submits, like the T023 journey. Runs against the production build whose
 * server was started with `STORIES_PROVIDER=fake` (deterministic provider).
 */
async function fillAndSubmit(page: Page) {
  await page.getByLabel(/Idade da criança/i).fill("6");
  await page.getByLabel(/Tema da história/i).selectOption("courage");
  // Select the longest journey (5 scenes, MAX_SCENES) so the e2e exercises a
  // multi-scene story with a middle span, not just the MVP default of three.
  await page.getByRole("radio", { name: /5 cenas/i }).check();
  await page.getByRole("button", { name: /Criar história/i }).click();
}

/**
 * Scene-by-scene keyboard journey (T036) across a five-scene story (T025).
 *
 * Generates a 5-scene story with the fictional default provider, then drives
 * the reader with the keyboard alone: bounds at first/middle/last scene,
 * progress indicator, focus moving to the scene heading, and in-session
 * resume (position retained while the reader stays mounted). Ends with a
 * privacy check: a reload loses the in-memory story entirely.
 */
test("reader keyboard journey navigates bounds with progress, focus, and in-session resume", async ({
  page,
}) => {
  // Safety net: never touch a live AI / non-local host; the fixed dev
  // provider on the server answers locally.
  await page.route(/^https?:\/\/(?!localhost)/i, (route) => route.abort("failed"));

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.goto("/");
  await fillAndSubmit(page);
  await responsePromise;

  // ---- Opens on the first scene: previous disabled, next enabled --------
  await expect(page.getByText("Cena 1 de 5")).toBeVisible();
  await expect(page.getByText(/Era uma vez uma estrelinha/)).toBeVisible();
  const previous = page.getByRole("button", { name: /Cena anterior/i });
  const next = page.getByRole("button", { name: /Próxima cena/i });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(page.locator('img[src^="data:image/webp;base64,"]')).toHaveCount(1);

  // ---- Keyboard-only journey ----------------------------------------------
  // A keyboard user lands on the first focusable control (the next button;
  // previous is disabled and skipped), then uses the arrow keys.
  await next.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByText("Cena 2 de 5")).toBeVisible();
  await expect(page.getByText(/desceu devagar até a areia/)).toBeVisible();
  // Focus moved to the new scene heading (G194-adjacent dynamic-content cue).
  await expect(page.locator("h2")).toBeFocused();
  await expect(previous).toBeEnabled();

  // Advance through the middle scenes added by the five-scene selection.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 3 de 5")).toBeVisible();
  await expect(page.getByText(/conheceu uma conchinha curiosa/)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 4 de 5")).toBeVisible();
  await expect(page.getByText(/se aconchegaram na areia/)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 5 de 5")).toBeVisible();
  await expect(page.getByText(/voltou ao céu feliz/)).toBeVisible();
  // Forward bound: last scene disables next and ArrowRight is a no-op.
  await expect(next).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/voltou ao céu feliz/)).toBeVisible();

  // Back through the middle scenes.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Cena 4 de 5")).toBeVisible();

  // ---- In-session resume ---------------------------------------------------
  // The position is retained in memory while the reader stays mounted:
  // moving away and back returns to the exact same scene.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 5 de 5")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 5 de 5")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Cena 1 de 5")).toBeVisible();

  // ---- Privacy: nothing is persisted across sessions -----------------------
  await page.reload();
  await expect(page.getByText("Crie uma história personalizada")).toBeVisible();
  await expect(page.getByText("Sua história")).toHaveCount(0);
  await expect(page.locator('img[src^="data:image/webp;base64,"]')).toHaveCount(0);
});
