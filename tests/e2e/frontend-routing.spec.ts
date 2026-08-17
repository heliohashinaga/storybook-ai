import { test, expect, type Page, type Response as RouteResponse } from "@playwright/test";
import { switchToPortuguese } from "./helpers";

/**
 * Spec 009 frontend-routes contract (T313): exercises the routing state machine
 * end-to-end against the production build with the deterministic dev provider.
 *
 * The contract (contracts/frontend-routing.md) requires:
 *   1. `/` redirects to `/form`; `/form` renders the clean request form.
 *   2. `form→reader` uses `router.replace`: a single browser `history.back()`
 *      LEAVES the app (it does not return to a stale `/form`).
 *   3. Returning to the clean `/form` is the app's internal navigation
 *      (top-nav / "Nova história"), never the browser history.
 *   4. Deep-link `/reader` without a session redirects to `/form`.
 *   5. During `POST /api/stories` the URL stays `/form` (no `/steps`).
 *   6. Navigation between already-created stories lives in `/reader` only
 *      (no `?story=` in the URL).
 *   7. The active locale survives `form↔reader` navigation.
 *   8. `aria-busy` while submitting; `aria-current` on the active nav home.
 *
 * The app defaults to English, so tests that assert pt-BR labels call
 * `switchToPortuguese`; tests that only assert routes use locale-agnostic
 * selectors (the submit button reads "Criar história" or "Create story").
 *
 * Deterministic: the dev provider is a fixed fake; no wall-clock/network/live
 * provider dependence.
 */

/** Fills the pt-BR form (age 6 + courage) and returns the POST response promise. */
async function startPtBrSubmission(page: Page): Promise<RouteResponse> {
  const response = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();
  return response;
}

test("/ redirects to /form and the form is a clean, identifier-free screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/form$/);
  // The clean form has no name/direct-identifier input (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Criar história|Create story/i })).toBeVisible();
});

test("form→reader uses replace: a single history.back() leaves the app", async ({ page }) => {
  await page.goto("/form");
  await switchToPortuguese(page);
  const response = startPtBrSubmission(page);
  await response;
  // Landed on /reader via replace.
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // One "back" must NOT return to a stale /form: it leaves the app (the entry
  // navigation replaced the form entry, so back goes to the previous page).
  await page.goBack();
  // The app cannot be on /form after a single back (replace policy).
  await expect(page).not.toHaveURL(/\/form$/);
});

test("deep-link /reader without a session redirects to the clean /form", async ({ page }) => {
  await page.goto("/reader");
  await expect(page).toHaveURL(/\/form$/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Criar história|Create story/i })).toBeVisible();
});

test("during submission the URL stays /form (no /steps route)", async ({ page }) => {
  // Defer the server response so the request stays in flight while we assert
  // the URL; release it to let the app navigate to /reader.
  let releaseFetch!: () => void;
  await page.route("**/api/stories", async (route) => {
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    await route.continue();
  });

  await page.goto("/form");
  await switchToPortuguese(page);
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();

  // While the request is in flight the URL remains /form and the panel is busy.
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page).toHaveURL(/\/form$/);
  await expect(page).not.toHaveURL(/steps|progress/i);

  // Release the request; the app then navigates to /reader.
  releaseFetch();
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });
});

test("navigation between already-created stories happens in /reader without ?story=", async ({
  page,
}) => {
  await page.goto("/form");
  await switchToPortuguese(page);
  const first = startPtBrSubmission(page);
  await first;
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // Append a second story via "Nova história" → clean /form → submit.
  const second = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /Nova história/i }).click();
  await expect(page).toHaveURL(/\/form$/);
  await page.getByRole("button", { name: /Criar história/i }).click();
  await second;
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });

  // The switcher lists both stories; switching is via the in-session context
  // (no ?story= query is ever present).
  const switcher = page.getByLabel("Suas histórias");
  await expect(switcher).toBeVisible();
  await expect(switcher.getByRole("button")).toHaveCount(2);
  expect(page.url()).not.toMatch(/\?story=/);
});

test("the active locale survives form↔reader navigation", async ({ page }) => {
  await page.goto("/form");
  await switchToPortuguese(page);

  // Locale is pt-BR on the form (pt-BR label visible).
  await expect(page.getByRole("slider", { name: /Idade/i })).toBeVisible();

  // Generate a story: the reader stays pt-BR (same locale provider, one level
  // above the routes).
  const response = startPtBrSubmission(page);
  await response;
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });
  await expect(page.getByLabel("Sua história")).toBeVisible();

  // Back to the clean form via internal nav: still pt-BR.
  await page.getByRole("button", { name: /Nova história/i }).click();
  await expect(page).toHaveURL(/\/form$/);
  await expect(page.getByRole("slider", { name: /Idade/i })).toBeVisible();
});

test("aria-busy is set while submitting and aria-current marks the active home nav", async ({
  page,
}) => {
  // Defer the server response so the submitting panel stays visible.
  let releaseFetch!: () => void;
  await page.route("**/api/stories", async (route) => {
    await new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    await route.continue();
  });

  await page.goto("/form");
  await switchToPortuguese(page);
  await page.getByRole("slider", { name: /Idade/i }).fill("6");
  await page.getByRole("button", { name: /^Coragem/i }).click();

  // On /form the home nav button carries aria-current (active route).
  const home = page.getByRole("button", { name: /voltar ao início|back to home/i });
  await expect(home).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: /Criar história/i }).click();
  // The progress panel is busy.
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-busy", "true");

  releaseFetch();
  await expect(page).toHaveURL(/\/reader$/, { timeout: 20_000 });
});
