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

const ALLOWED_KEYS = ["ageBand", "locale", "theme"] as const;

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

  await page.getByLabel(/Idade da criança|Child's age/i).fill("9");
  await page.getByLabel(/Idioma|Story language|language/i).selectOption("en");
  await page.getByLabel(/Tema da história|Story theme/i).selectOption("friendship");
  await page.getByRole("button", { name: /Criar história|Create story/i }).click();
}

test("en journey sends only ageBand/locale/theme and renders a safe English story", async ({
  page,
}) => {
  const requestedPayloads: RequestPayload[] = [];

  // Safety net: abort any request to a live AI / non-local host.
  await page.route(/^https?:\/\/(?!localhost)/i, (route) => route.abort("failed"));

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
  expect(payload.ageBand).toBe("8-12"); // age 9 derives to the 8-12 band
  expect(payload.locale).toBe("en");
  expect(payload.theme).toBe("friendship");

  // ---- Response assertions (real server + deterministic dev provider) ----
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as GeneratedStory;
  expect(body.locale).toBe("en");
  expect(body.ageBand).toBe("8-12");
  expect(body.theme).toBe("friendship");
  expect(body.scenes).toHaveLength(3);

  // ---- Reader view assertions --------------------------------------------
  const imgs = page.locator('img[src^="data:image/webp;base64,"]');
  await expect(imgs).toHaveCount(3);

  for (let i = 0; i < body.scenes.length; i += 1) {
    const scene = body.scenes[i]!;
    expect(scene.illustrationDataUri).toMatch(/^data:image\/webp;base64,/);
    expect(scene.altText.length).toBeGreaterThan(0);
    // English alt text has no Portuguese diacritics — proves it is actually
    // English, not a pt-BR fallback.
    expect(scene.altText).not.toMatch(/[áàâãçéêíóôõúü]/i);
    expect(scene.altText).toMatch(/[A-Za-z]+/);
    const alt = await imgs.nth(i).getAttribute("alt");
    expect(alt).toBe(scene.altText);
  }

  // Scene content is visible, in English, with no template markers/identifiers.
  const visibleText = await page.locator("section").innerText();
  expect(visibleText).toMatch(/\bstar\b/i);
  for (const marker of ["{{name}}", "{{child}}", "${", "{{", "}}"]) {
    expect(visibleText).not.toContain(marker);
  }
  for (const token of ["Bela do Carmo", "Maria", "João", "estrelinha"]) {
    expect(visibleText).not.toContain(token);
  }
});
