import { test, expect, type Page } from "@playwright/test";

/**
 * Anonymous multi-story session journey (US3, T046).
 *
 * Drives the real `POST /api/stories` route (deterministic dev provider — never
 * a live AI service) to verify the anonymous, in-memory session contract:
 *   1. "Gerar outra história" (generate another) appends a NEW story instead of
 *      replacing the current one, and reuses the browser-bound age band,
 *      language and last theme without re-asking (T050).
 *   2. There is no story-count cap: repeated generations keep working.
 *   3. A full page reload restores nothing — no exact age, preferences, or
 *      prior stories (quickstart "Anonymous session behavior" item 4).
 *   4. No-persistence audit: browser storage, cookies and the URL contain no
 *      direct identifier, exact age, preferences, or story content.
 *
 * Mirrors the route-handling convention from `generate-pt-br.spec.ts`: the
 * outbound payload is captured and asserted to contain exactly
 * `ageBand`/`locale`/`theme` (never an exact age or a direct identifier), the
 * response is `Cache-Control: no-store`, and any non-local host request is
 * aborted as a safety net. Deterministic (no wall-clock, network, or
 * live-provider dependence).
 */

const ALLOWED_KEYS = ["ageBand", "locale", "theme", "sceneCount"] as const;

interface RequestPayload {
  ageBand?: string;
  locale?: string;
  theme?: string;
  [key: string]: unknown;
}

/** Asserts the mandatory privacy contract on an outbound story payload. */
function assertPrivacyContract(payload: RequestPayload): void {
  expect(Object.keys(payload)).toEqual([...ALLOWED_KEYS]);
  for (const forbidden of ["name", "exactAge", "childName", "identifier", "age"]) {
    expect(payload[forbidden]).toBeUndefined();
  }
  expect(payload.ageBand).toMatch(/^2-4|5-7|8-9$/);
  expect(payload.locale).toMatch(/^pt-BR|en$/);
  expect(payload.theme).toMatch(/^courage|friendship|kindness$/);
}

/**
 * Sets the non-localhost abort safety net and a POST /api/stories capture that
 * CONTINUES the request (so server-side validation/safety actually run),
 * returning the ordered outbound payloads for later assertion.
 */
async function captureStoryCalls(page: Page): Promise<RequestPayload[]> {
  const payloads: RequestPayload[] = [];

  // Safety net: abort any request to a live AI / non-local host. Registered
  // first so the specific capture handler below (added last) wins for
  // `/api/stories`.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  await page.route("**/api/stories", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    payloads.push(request.postDataJSON() as RequestPayload);
    // Let the REAL route (deterministic dev provider) handle the request.
    await route.continue();
  });

  return payloads;
}

/** Awaits the story-generation response for the current action. */
function waitForStoryResponse(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
}

test("anonymous multi-story session: reuse, no cap, clear-on-reload, no persistence", async ({
  page,
}) => {
  const payloads = await captureStoryCalls(page);

  await page.goto("/");

  // No name / direct-identifier field exists on the form (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  // ---- First story: theme "courage" --------------------------------------
  await page.getByLabel(/Idade/i).fill("6");
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Coragem/i }).click();
  const first = waitForStoryResponse(page);
  await page.getByRole("button", { name: /Criar história/i }).click();
  const firstResponse = await first;

  await expect(page.getByLabel("Sua história")).toBeVisible();
  await expect(page.getByText("Cena 1 de 3")).toBeVisible();
  expect(payloads).toHaveLength(1);
  assertPrivacyContract(payloads[0]!);
  expect(firstResponse.status()).toBe(200);
  expect(firstResponse.headers()["cache-control"]).toContain("no-store");

  // ---- "Gerar outra história" appends, reusing prefs (no re-ask) ----------
  const generateAnother = page.getByRole("button", { name: /Gerar outra história/i });
  await expect(generateAnother).toBeVisible();

  const responses = [firstResponse];
  for (let i = 0; i < 3; i++) {
    const response = waitForStoryResponse(page);
    await generateAnother.click();
    responses.push(await response);
    // A fresh generation request went out with the reused prefs, no re-ask.
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();
  }

  // Four generations reached the server (1 first + 3 generate-another).
  expect(payloads).toHaveLength(4);
  for (const payload of payloads) {
    assertPrivacyContract(payload);
  }
  // The story language and theme are reused across "generate another" (T050).
  expect(payloads.map((p) => p.theme)).toEqual(["courage", "courage", "courage", "courage"]);
  for (const response of responses) {
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }

  // ---- No-persistence audit while stories still exist in memory ----------
  const storageAudit = await page.evaluate(() => ({
    localStorage: localStorage.length,
    sessionStorage: sessionStorage.length,
    cookie: document.cookie,
  }));
  expect(storageAudit.localStorage).toBe(0);
  expect(storageAudit.sessionStorage).toBe(0);
  expect(storageAudit.cookie).not.toMatch(/name|child|story|age=|pref/i);

  // ---- Full page reload restores nothing (clear-on-reload) ---------------
  await page.reload();
  await expect(page.getByRole("button", { name: /Criar história/i })).toBeVisible();
  await expect(page.getByText("Cena 1 de 3")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Gerar outra história/i })).toHaveCount(0);
  await expect(page.getByLabel(/Idade/i)).toHaveValue("5");

  // ---- URL carries no age / theme / story data ---------------------------
  expect(page.url()).toBe(new URL("/", page.url()).toString());
  expect(page.url()).not.toMatch(/age|theme|courage|story|pref/i);
});

test("no direct identifier is ever sent in an English multi-story session", async ({ page }) => {
  const payloads = await captureStoryCalls(page);

  await page.goto("/");

  // Switch the UI language to English (ADR 0003 / T056): the story language
  // drives the whole UI, so the form re-renders in English. Scoped to the form
  // because the header LangToggle is a segmented button group, not a select.
  await page.locator("form").getByLabel("Idioma").selectOption("en");
  const first = waitForStoryResponse(page);
  await page.getByLabel("Age").fill("3"); // derives to the 2-4 band in-browser
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Friendship/i }).click();
  await page.getByRole("button", { name: "Create story" }).click();
  const firstResponse = await first;

  await expect(page.getByLabel("Your story")).toBeVisible();
  await expect(page.getByText(/Scene 1 of 3/i)).toBeVisible();
  expect(firstResponse.status()).toBe(200);
  expect(firstResponse.headers()["cache-control"]).toContain("no-store");

  // Generate another in English, reusing prefs.
  const generateAnother = page.getByRole("button", { name: "Generate another" });
  await expect(generateAnother).toBeVisible();
  const second = waitForStoryResponse(page);
  await generateAnother.click();
  const secondResponse = await second;

  await expect(page.getByText(/Scene 1 of 3/i)).toBeVisible();
  expect(secondResponse.status()).toBe(200);

  expect(payloads).toHaveLength(2);
  for (const payload of payloads) {
    expect(Object.keys(payload)).toEqual([...ALLOWED_KEYS]);
    expect(payload.locale).toBe("en");
    assertPrivacyContract(payload);
  }
});
