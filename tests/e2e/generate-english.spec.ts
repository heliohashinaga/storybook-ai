import { test, expect, type Page } from "@playwright/test";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";

/**
 * `en` generation journey (US4, T053) — English, age 9 + friendship.
 *
 * Mirrors the pt-BR journey but selects the `en` locale explicitly, so it
 * proves the full avatar of the anonymous flow works for English too: the REAL
 * `POST /api/stories` route is driven with the deterministic dev provider
 * (which, in US4, returns an English story when `locale === "en"`).
 *
 * Playwright only:
 *   - captures + asserts the outbound payload (privacy contract: exactly
 *     `ageBand`/`locale`/`theme` — never an exact age or a direct identifier);
 *   - blocks any request to a non-local host as a safety net, so nothing can
 *     ever leak to a live AI service.
 *
 * Then the response is asserted against real server behaviour: `no-store`, a
 * valid three-scene safety-approved story with WebP data URIs and English
 * (non-diacritic) localized alt text, rendered with no template/interpolation
 * markers or identifiers.
 *
 * Deterministic: the dev provider is a fixed fake, so there is no wall-clock,
 * network, or live-provider dependence.
 */

const ALLOWED_KEYS = ["ageBand", "locale", "theme", "sceneCount"] as const;

interface RequestPayload {
  ageBand?: string;
  locale?: string;
  theme?: string;
  [key: string]: unknown;
}

/** Fills the form with age 9 + friendship and selects the English locale. */
async function fillAndSubmitEnglish(page: Page): Promise<void> {
  await page.goto("/");

  // No name / direct-identifier field exists on the form (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  await page.getByLabel(/Idade|Age/i).fill("9");
  await page
    .locator("form")
    .getByLabel(/Idioma|Language/i)
    .selectOption("en");
  // Selecting the story language flips the whole UI to English (ADR 0003).
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Friendship/i }).click();
  await page.getByRole("button", { name: /Create story/i }).click();
}

test("en journey sends only ageBand/locale/theme and renders a safe English story", async ({
  page,
}) => {
  const requestedPayloads: RequestPayload[] = [];

  // Safety net: abort any request to a live AI / non-local host.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  // Capture the outbound payload, then let the REAL route (dev provider) handle it.
  await page.route("**/api/stories", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    requestedPayloads.push(request.postDataJSON() as RequestPayload);
    await route.continue();
  });

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await fillAndSubmitEnglish(page);
  const response = await responsePromise;

  // ---- Request-payload privacy assertions --------------------------------
  expect(requestedPayloads).toHaveLength(1);
  const payload = requestedPayloads[0]!;

  const payloadKeys = Object.keys(payload);
  expect(payloadKeys.sort()).toEqual([...ALLOWED_KEYS].sort());
  for (const key of ["name", "exactAge", "childName", "identifier"] as const) {
    expect(payloadKeys).not.toContain(key);
    expect(payload[key]).toBeUndefined();
  }
  expect(payload.age).toBeUndefined();
  expect(payload.ageBand).toBe("8-9"); // age 9 derives to the 8-9 band
  expect(payload.locale).toBe("en");
  expect(payload.theme).toBe("friendship");

  // ---- Response assertions (real server + deterministic dev provider) ----
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as GeneratedStory;
  expect(body.locale).toBe("en");
  expect(body.ageBand).toBe("8-9");
  expect(body.theme).toBe("friendship");
  expect(body.scenes).toHaveLength(3);

  // ---- Reader view assertions --------------------------------------------
  // The reader (T040) shows exactly one scene at a time and navigates with
  // the previous/next buttons; every scene is reached and asserted in order.
  const imgs = page.locator('img[src^="data:image/webp;base64,"]');
  // The reader chrome is English because the selected story language drives
  // the whole UI (ADR 0003 / T056): region, buttons and counter are localized.
  const reader = page.getByRole("region", { name: "Your story" });
  const nextButton = page.getByRole("button", { name: "Next" });
  let fullStoryText = "";

  for (let i = 0; i < body.scenes.length; i += 1) {
    const scene = body.scenes[i]!;
    expect(scene.illustrationDataUri).toMatch(/^data:image\/webp;base64,/);
    expect(scene.altText.length).toBeGreaterThan(0);
    // English alt text has no Portuguese diacritics — proves it is actually
    // English, not a pt-BR fallback.
    expect(scene.altText).not.toMatch(/[áàâãçéêíóôõúü]/i);
    expect(scene.altText).toMatch(/[A-Za-z]+/);

    // Exactly one scene is mounted at a time, with its localized progress
    // indicator and matching alt text.
    await expect(imgs).toHaveCount(1);
    await expect(page.getByText(`Scene ${i + 1} of ${body.scenes.length}`)).toBeVisible();
    const alt = await imgs.getAttribute("alt");
    expect(alt).toBe(scene.altText);

    // The visible scene is in English with no template markers/identifiers.
    const visibleText = await reader.innerText();
    fullStoryText += visibleText;
    for (const marker of ["{{name}}", "{{child}}", "${", "{{", "}}"]) {
      expect(visibleText).not.toContain(marker);
    }
    for (const token of ["Bela do Carmo", "Maria", "João", "estrelinha"]) {
      expect(visibleText).not.toContain(token);
    }

    if (i < body.scenes.length - 1) await nextButton.click();
  }
  // The full story text is in English and mentions the star hero.
  expect(fullStoryText).toMatch(/\bstar\b/i);
  // Forward bound: the last scene disables "next".
  await expect(nextButton).toBeDisabled();
});
