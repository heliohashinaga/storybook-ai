import { test, expect, type Page, type Response as RouteResponse } from "@playwright/test";
import { switchToPortuguese } from "./helpers";

/**
 * Spec 015 frontend-routes contract: exercises the routing state machine
 * end-to-end against the production build with the deterministic dev provider.
 *
 * The spec 015 contract (contracts/auth-flow.md + specs/015) changes the routing:
 *   1. `/` is the LOGIN GATE (no more implicit redirect to `/form`). The
 *      anonymous playground lives at `/demo` (mirrors the old `/form`) and its
 *      reader at `/demo/reader` (mirrors the old `/reader`). Both are cookie-less.
 *   2. `/form` and `/reader` are the authenticated playground and redirect to
 *      `/` when no session cookie is present.
 *   3. `demo→demo/reader` uses `router.replace`: a single browser `history.back()`
 *      LEAVES the app (it does not return to a stale `/demo`).
 *   4. During `POST /api/stories` the URL stays `/demo` (no `/steps`).
 *   5. Navigation between already-created stories lives in `/demo/reader` only
 *      (no `?story=` in the URL).
 *   6. The active locale survives `demo↔demo/reader` navigation.
 *   7. `aria-busy` while submitting; `aria-current` on the home nav on `/`.
 *
 * The app defaults to English, so tests that assert pt-BR labels call
 * `switchToPortuguese`; tests that only assert routes use locale-agnostic
 * selectors (the submit button reads "Criar história" or "Create story").
 *
 * Deterministic: the dev provider is a fixed fake; no wall-clock/network/live
 * provider dependence.
 */

/** Fills the pt-BR demo form (age 6 + courage) and returns the POST response promise. */
async function startPtBrSubmission(page: Page): Promise<RouteResponse> {
  const response = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();
  return response;
}

test("/ renders the login gate and never redirects anonymous visitors to /form", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  // The login gate (spec 015) is shown, with the anonymous demo entry point.
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore the Demo/i })).toBeVisible();
  // The clean login gate has no name/direct-identifier input (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);
});

test("demo→demo/reader uses replace: a single history.back() leaves the app", async ({ page }) => {
  await page.goto("/demo");
  await switchToPortuguese(page);
  const response = startPtBrSubmission(page);
  await response;
  // Landed on /demo/reader via replace.
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // One "back" must NOT return to a stale /demo: it leaves the app (the entry
  // navigation replaced the demo entry, so back goes to the previous page).
  await page.goBack();
  await expect(page).not.toHaveURL(/\/demo$/);
});

test("deep-link /reader without a session redirects to the login gate /", async ({ page }) => {
  await page.goto("/reader");
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
});

test("during submission the URL stays /demo (no /steps route)", async ({ page }) => {
  // Defer the server response so the request stays in flight while we assert
  // the URL; release it to let the app navigate to /demo/reader.
  let releaseFetch!: () => void;
  await page.route("**/api/stories", async (route) => {
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    await route.continue();
  });

  await page.goto("/demo");
  await switchToPortuguese(page);
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();

  // While the request is in flight the URL remains /demo and the panel is busy.
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page).not.toHaveURL(/steps|progress/i);

  // Release the request; the app then navigates to /demo/reader.
  releaseFetch();
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });
});

test("navigation between already-created stories happens in /demo/reader without ?story=", async ({
  page,
}) => {
  await page.goto("/demo");
  await switchToPortuguese(page);
  const first = startPtBrSubmission(page);
  await first;
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // Append a second story via "Nova história" → clean /demo → submit.
  const second = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /Nova história/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole("button", { name: /Criar história/i }).click();
  await second;
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });

  // The switcher lists both stories; switching is via the in-session context
  // (no ?story= query is ever present).
  const switcher = page.getByLabel("Suas histórias");
  await expect(switcher).toBeVisible();
  await expect(switcher.getByRole("button")).toHaveCount(2);
  expect(page.url()).not.toMatch(/\?story=/);
});

test("the active locale survives demo↔demo/reader navigation", async ({ page }) => {
  await page.goto("/demo");
  await switchToPortuguese(page);

  // Locale is pt-BR on the demo form (pt-BR label visible).
  await expect(page.getByRole("slider", { name: /Idade/i })).toBeVisible();

  // Generate a story: the reader stays pt-BR (same locale provider, one level
  // above the routes).
  const response = startPtBrSubmission(page);
  await response;
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // Back to the clean demo form via internal nav: still pt-BR.
  await page.getByRole("button", { name: /Nova história/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("slider", { name: /Idade/i })).toBeVisible();
});

test("aria-busy is set while submitting and aria-current marks the home nav on /", async ({
  page,
}) => {
  // On the login gate `/` the home nav button carries aria-current (active route).
  await page.goto("/");
  const home = page.getByRole("button", { name: /voltar ao início|back to home/i });
  await expect(home).toHaveAttribute("aria-current", "page");

  // Then verify the submitting panel is busy on the anonymous demo form.
  let releaseFetch!: () => void;
  await page.route("**/api/stories", async (route) => {
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    await route.continue();
  });

  await page.goto("/demo");
  await switchToPortuguese(page);
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();

  // The progress panel is busy.
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-busy", "true");

  releaseFetch();
  await expect(page).toHaveURL(/\/demo\/reader$/, { timeout: 20_000 });
});
