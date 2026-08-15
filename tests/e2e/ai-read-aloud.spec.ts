import { expect, test, type Page } from "@playwright/test";

/**
 * AI narration journey (spec 004, US1-US3): on-demand AI voice, accessible
 * controlled error without Web Speech fallback, and zero persistence.
 *
 * Runs against the production build whose server was started with
 * `STORIES_TEST_MODE=fake` (deterministic offline provider) and
 * `AI_NARRATION_ENABLED=true` so `/api/narrate` answers with transient audio
 * bytes from the fixed TTS provider — never a live TTS service. Every test
 * blocks non-local hosts so no real provider is ever reached.
 */
async function fillAndSubmit(page: Page) {
  await page.getByLabel(/Idade da criança/i).fill("6");
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Coragem/i }).click();
  // Select the longest journey (5 scenes, MAX_SCENES) so the e2e exercises a
  // multi-scene story with a middle span, not just the MVP default of three.
  await page.getByRole("button", { name: /5cenas/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();
}

test("AI narration plays on demand, sends only anonymous fields, and stops on navigation", async ({
  page,
}) => {
  // Safety net: never touch a live AI / non-local host; the fixed dev
  // provider on the server answers locally (US3 network guard).
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  // Capture every POST /api/narrate payload the hook issues.
  const narrateBodies: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/narrate") && request.method() === "POST") {
      narrateBodies.push(request.postData() ?? "");
    }
  });

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.goto("/");
  await fillAndSubmit(page);
  await responsePromise;

  // Reader is up with the narration control (pt-BR idle label).
  await expect(page.getByText("Cena 1 de 5")).toBeVisible();
  const listen = page.getByRole("button", { name: /Ouvir esta cena/i });
  await expect(listen).toBeVisible();

  // Keyboard-only trigger: focus the control and activate it with Enter.
  await listen.focus();
  await page.keyboard.press("Enter");

  // The server received exactly one anonymous payload: sceneText + locale
  // only — never a name/identifier/exact age (privacy invariant).
  await expect.poll(() => narrateBodies.length).toBe(1);
  const payload = JSON.parse(narrateBodies[0]!) as Record<string, unknown>;
  expect(Object.keys(payload).sort()).toEqual(["locale", "sceneText"]);
  expect(payload.locale).toBe("pt-BR");
  expect(typeof payload.sceneText).toBe("string");

  // Navigate away: the in-flight narration is stopped (object URL revoked)
  // and the control is reachable again for the new scene (US1/US3).
  await page.getByRole("button", { name: /Próxima cena/i }).click();
  await expect(page.getByText("Cena 2 de 5")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ouvir esta cena/i })).toBeVisible();
});

test("AI narration failure shows an accessible error and never falls back to Web Speech", async ({
  page,
}) => {
  // Prove Web Speech is never invoked while AI narration is active (US2):
  // spy on speechSynthesis.speak before the app loads.
  await page.addInitScript(() => {
    const win = window as Window & { __speechCalled?: boolean };
    win.__speechCalled = false;
    const synth = window.speechSynthesis;
    if (synth) {
      const originalSpeak = synth.speak.bind(synth);
      synth.speak = (utterance) => {
        win.__speechCalled = true;
        return originalSpeak(utterance);
      };
    }
  });

  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );
  // Force the TTS provider to fail with a 502 while AI narration is active.
  await page.route("**/api/narrate", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        code: "narration_unavailable",
        messageKey: "story.narration.unavailable",
        retryable: true,
      }),
    })
  );

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.goto("/");
  await fillAndSubmit(page);
  await responsePromise;

  await expect(page.getByText("Cena 1 de 5")).toBeVisible();
  await page.getByRole("button", { name: /Ouvir esta cena/i }).click();

  // Accessible, localized error without a Web Speech retry. (The Next.js
  // route announcer also carries role=alert, so match the specific text.)
  await expect(
    page.getByText("Não foi possível reproduzir o áudio. Tente novamente.")
  ).toBeVisible();
  // The scene body stays fully readable.
  await expect(page.getByText(/Era uma vez uma estrelinha/)).toBeVisible();

  // No Web Speech audio was ever issued during the AI failure.
  const speechCalled = await page.evaluate(
    () => (window as Window & { __speechCalled?: boolean }).__speechCalled
  );
  expect(speechCalled).toBe(false);
});

test("narration is on-demand with zero persistence (no prefetch, no storage)", async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  let narrateRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/narrate") && request.method() === "POST") {
      narrateRequests += 1;
    }
  });

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.goto("/");
  await fillAndSubmit(page);
  await responsePromise;

  await expect(page.getByText("Cena 1 de 5")).toBeVisible();

  // US3: nothing hit /narrate before the user asked to listen (no prefetch).
  expect(narrateRequests).toBe(0);

  // Anonymous by design: no cookies or localStorage from the story flow.
  const storage = await page.evaluate(() => ({
    cookies: document.cookie,
    localStorageEntries: Object.keys(localStorage).length,
  }));
  expect(storage.cookies).toBe("");
  expect(storage.localStorageEntries).toBe(0);

  // On-demand: only a user gesture triggers narration.
  await page.getByRole("button", { name: /Ouvir esta cena/i }).click();
  await expect.poll(() => narrateRequests).toBe(1);

  // Reload: the in-memory story (and any transient audio) is gone entirely.
  await page.reload();
  await expect(page.getByRole("heading", { name: /storybook ai/i })).toBeVisible();
  await expect(page.locator('img[src^="data:image/webp;base64,"]')).toHaveCount(0);
});
