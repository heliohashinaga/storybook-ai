import { expect, test, type Page } from "@playwright/test";
import { switchToPortuguese } from "./helpers";

/**
 * Fills the anonymous request form (age 6 → band 5-7, courage theme, 5 scenes)
 * in pt-BR and submits, like the T023 journey. Runs against the production
 * build whose server was started with `STORIES_TEST_MODE=fake` (deterministic
 * provider). The app defaults to English, so the UI is switched to pt-BR first.
 */
async function fillAndSubmit(page: Page) {
  // spec 015: the anonymous form lives on /demo (the playground /form is
  // session-gated); /demo uses the same StoryRequestApp with isFake=true.
  await page.goto("/demo");
  await switchToPortuguese(page);
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Coragem/i }).click();
  // Select the longest journey (5 scenes, MAX_SCENES) so the e2e exercises a
  // multi-scene story with a middle span, not just the MVP default of three.
  await page.getByRole("button", { name: /5cenas/i }).click();
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
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await fillAndSubmit(page);
  await responsePromise;

  // Spec 015: successful generation lands on /demo/reader.
  await expect(page).toHaveURL(/\/demo\/reader$/);

  // ---- Opens on the first scene: previous disabled, next enabled --------
  await expect(page.getByText("Cena 1 de 5")).toBeVisible();
  await expect(page.getByText(/Num dia ensolarado, um coelhinho/)).toBeVisible();
  const previous = page.getByRole("button", { name: /^Anterior$/i });
  const next = page.getByRole("button", { name: /^Próxima$/i });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  // Exactly one scene image renders inside the reader region (the in-session
  // history sidebar also shows a webp thumbnail, so scope to the region).
  const readerRegion = page.locator('section[aria-label="Sua história"]');
  await expect(readerRegion.locator('img[src^="data:image/webp;base64,"]')).toHaveCount(1);

  // ---- Keyboard-only journey ----------------------------------------------
  // A keyboard user lands on the first focusable control (the next button;
  // previous is disabled and skipped), then uses the arrow keys.
  await next.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByText("Cena 2 de 5")).toBeVisible();
  await expect(page.getByText(/colocou uma pata na ponte/)).toBeVisible();
  // Focus moved to the new scene heading (G194-adjacent dynamic-content cue);
  // the scene heading is the reader's `[data-scene-heading]` h1.
  await expect(page.locator("[data-scene-heading]")).toBeFocused();
  await expect(previous).toBeEnabled();

  // Advance through the middle scenes added by the five-scene selection.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 3 de 5")).toBeVisible();
  await expect(page.getByText(/respirou fundo/)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 4 de 5")).toBeVisible();
  await expect(page.getByText(/olhou para baixo/)).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Cena 5 de 5")).toBeVisible();
  await expect(page.getByText(/chegou à campina/)).toBeVisible();
  // Forward bound: last scene disables next and ArrowRight is a no-op.
  await expect(next).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/chegou à campina/)).toBeVisible();

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
  // A reload on /demo/reader loses the in-memory story entirely; the demo
  // route stays anonymous and shows the clean form shell again.
  await page.reload();
  await expect(page.getByRole("heading", { name: /storybook ai/i })).toBeVisible();
  await expect(page.getByText("Sua história")).toHaveCount(0);
  await expect(page.locator('img[src^="data:image/webp;base64,"]')).toHaveCount(0);
});
