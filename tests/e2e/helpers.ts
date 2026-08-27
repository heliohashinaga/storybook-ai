import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers for Spec 009 frontend-routes journeys.
 *
 * The app defaults to English (layout `defaultLocale="en"`), so pt-BR journeys
 * must explicitly switch to pt-BR first. Two independent controls exist:
 *   - the header kebab ("Menu") holds a `LangToggle` that switches the whole
 *     UI locale (stable label "Português (Brasil)" in both locales). The
 *     header actions are collapsed behind the kebab on every breakpoint;
 *   - the form's story-locale selector drives the generation payload
 *     (`locale`), independent of the UI locale.
 * A pt-BR journey needs BOTH switched, so the reader assertions (pt-BR labels)
 * and the payload (`locale === "pt-BR"`) are consistent.
 */

/** Switches the UI and the form's story-locale to pt-BR. */
export async function switchToPortuguese(page: Page): Promise<void> {
  // 1. Header LangToggle → pt-BR UI. The header actions live behind the kebab
  //    ("Menu") menu on every breakpoint, so open it and pick the language.
  const header = page.locator("header");
  await header.getByRole("button", { name: "Menu" }).click();
  await header
    .getByRole("menuitem", { name: /português/i })
    .first()
    .click();
  // 2. Form story-locale selector → pt-BR (drives the generation payload).
  await page.locator("form").getByRole("button", { name: "Português (Brasil)" }).click();
  // The UI re-renders in pt-BR; wait for a pt-BR label to be present.
  await expect(page.getByLabel(/Idioma/i).first()).toBeVisible();
}

/**
 * Session cookie name Clerk sets once authenticated (spec 018 / ADR 0013). Used by
 * the demo privacy checks to assert the anonymous demo never establishes a session.
 */
export const CLERK_SESSION_COOKIE_NAME = "__clerk_session";

const ALLOWED_KEYS = ["ageBand", "locale", "theme", "sceneCount"] as const;

export interface StoryPayload {
  ageBand?: string;
  locale?: string;
  theme?: string;
  sceneCount?: number;
  [key: string]: unknown;
}

/** Asserts the mandatory privacy contract on an outbound story payload. */
export function assertPrivacyContract(payload: StoryPayload): void {
  expect(Object.keys(payload)).toEqual([...ALLOWED_KEYS]);
  for (const forbidden of ["name", "exactAge", "childName", "identifier", "age"]) {
    expect(payload[forbidden]).toBeUndefined();
  }
  expect(payload.ageBand).toMatch(/^2-4|5-7|8-9$/);
  expect(payload.locale).toMatch(/^pt-BR|en$/);
  expect(payload.theme).toMatch(/^courage|friendship|kindness|curiosity|perseverance|empathy$/);
}

/**
 * Aborts non-local traffic and captures every outbound `POST /api/stories`
 * payload while still letting the real (deterministic fake) route handle it.
 */
export async function captureStoryCalls(page: Page): Promise<StoryPayload[]> {
  const payloads: StoryPayload[] = [];

  // Safety net: abort any request to a live AI / non-local host.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i, (route) =>
    route.abort("failed")
  );

  await page.route("**/api/stories", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    payloads.push(request.postDataJSON() as StoryPayload);
    await route.continue();
  });

  return payloads;
}

/** Awaits the story-generation response for the current action. */
export function waitForStoryResponse(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
}
