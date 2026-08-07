import { test, expect, type Page } from "@playwright/test";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";

/**
 * Default `pt-BR` generation journey (US1, T023).
 *
 * Drives the anonymous form with age 6 + courage (pt-BR is the default locale)
 * and lets the REAL `POST /api/stories` route handle it. The server binds the
 * deterministic development provider (a fixed fake — never a live AI service),
 * so the whole server path (Zod `.strict()` re-validation, rate limit,
 * safety pipeline, illustration generation) actually runs. Playwright only:
 *   - captures + asserts the outbound payload (privacy contract: exactly
 *     `ageBand`/`locale`/`theme` — never an exact age or a direct identifier);
 *   - blocks any request to a non-local host as a safety net, so nothing can
 *     ever leak to a live AI service (unchanged because localhost never
 *     matches the negative-lookahead matcher, and `route.continue()` keeps the
 *     development-provider request on the local dev server).
 *
 * The response is then asserted against real server behaviour: `no-store`,
 * a valid three-scene safety-approved story with WebP data URIs and localized
 * pt-BR alt text, and a reader that renders every scene with no template/
 * interpolation markers or identifiers.
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

/** Fills the form with age 6 + courage, leaving the default pt-BR locale. */
async function fillAndSubmit(page: Page): Promise<void> {
  await page.goto("/");

  // No name / direct-identifier field exists on the form (privacy invariant).
  // The only age input derives a band in-browser and is never transmitted.
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  await page.getByLabel(/Idade da criança/i).fill("6");
  await page.getByLabel(/Tema da história/i).selectOption("courage");
  await page.getByRole("button", { name: /Criar história/i }).click();
}

test("default pt-BR journey sends only ageBand/locale/theme and renders a safe story", async ({
  page,
}) => {
  const requestedPayloads: RequestPayload[] = [];

  // Safety net: abort any request to a live AI / non-local host. Registered
  // first so the specific capture handler below (added last) wins for
  // `/api/stories`.
  await page.route(/^https?:\/\/(?!localhost)/i, (route) => route.abort("failed"));

  // Capture the outbound payload, then let the REAL route (dev provider)
  // handle it so server-side validation/safety actually run.
  await page.route("**/api/stories", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    requestedPayloads.push(request.postDataJSON() as RequestPayload);
    await route.continue();
  });

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await fillAndSubmit(page);
  const response = await responsePromise;

  // ---- Request-payload privacy assertions --------------------------------
  expect(requestedPayloads).toHaveLength(1);
  const payload = requestedPayloads[0]!;

  // Only allow-listed keys — no exact age, no name, no direct identifier.
  const payloadKeys = Object.keys(payload);
  expect(payloadKeys.sort()).toEqual([...ALLOWED_KEYS].sort());
  for (const key of ["name", "exactAge", "childName", "identifier"] as const) {
    expect(payloadKeys).not.toContain(key);
    expect(payload[key]).toBeUndefined();
  }
  expect(payload.age).toBeUndefined();
  expect(payload.ageBand).toBe("5-7"); // age 6 derives to the 5-7 band
  expect(payload.locale).toBe("pt-BR"); // default
  expect(payload.theme).toBe("courage");

  // ---- Response assertions (real server + deterministic dev provider) ----
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as GeneratedStory;
  expect(body.locale).toBe("pt-BR");
  expect(body.ageBand).toBe("5-7");
  expect(body.theme).toBe("courage");
  expect(body.scenes).toHaveLength(3);

  // ---- Reader view assertions --------------------------------------------
  const imgs = page.locator('img[src^="data:image/webp;base64,"]');
  await expect(imgs).toHaveCount(3);

  for (let i = 0; i < body.scenes.length; i += 1) {
    const scene = body.scenes[i]!;
    expect(scene.illustrationDataUri).toMatch(/^data:image\/webp;base64,/);
    expect(scene.altText.length).toBeGreaterThan(0);
    // Localized pt-BR alt text contains Portuguese diacritics — a
    // placeholder-only response must not pass.
    expect(scene.altText).toMatch(/[áàâãçéêíóôõúü]/i);
    const alt = await imgs.nth(i).getAttribute("alt");
    expect(alt).toBe(scene.altText);
  }

  // Scene content is visible and contains no template/interpolation markers
  // and no identifier tokens.
  const visibleText = await page.locator("section").innerText();
  for (const marker of ["{{name}}", "{{child}}", "${", "{{", "}}"]) {
    expect(visibleText).not.toContain(marker);
  }
  for (const token of ["Bela do Carmo", "Maria", "João"]) {
    expect(visibleText).not.toContain(token);
  }
});
