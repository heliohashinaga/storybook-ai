import { test, expect } from "@playwright/test";
import { AUTH_COOKIE_NAME } from "./helpers";

/**
 * Allowlist denial UX (spec 015, T034).
 *
 * The access-control check itself (email outside `AUTH_ALLOWLIST_EMAILS`) runs
 * in the sign-in callback during the real OAuth dance and is unit-tested against
 * the server module. This E2E validates the resulting UX deterministically: the
 * sign-in initiation is fulfilled with the same JSON contract Auth.js returns
 * for `X-Auth-Return-Redirect`, pointing the redirect back at the gate with the
 * `AccessDenied` error marker — exactly what Auth.js redirects to when the
 * sign-in callback rejects the account. The gate must:
 *   1. surface the localized denial message (`role="alert"`),
 *   2. drop the `?error=` marker from the URL afterwards,
 *   3. never establish a session cookie.
 *
 * Env contract: requires `AUTH_SECRET` + Google credentials (the button is only
 * exposed when the server has them configured).
 */

const authSecret = process.env.AUTH_SECRET;
const googleCredentials = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

test.skip(!authSecret, "AUTH_SECRET must be set in the e2e env to exercise authenticated journeys");
test.skip(
  !googleCredentials,
  "AUTH_GOOGLE_ID/_SECRET required for the server to expose the button"
);

test("an email outside the allowlist is denied: localized message, no session", async ({
  page,
  context,
}) => {
  // Auth.js redirects to `/?error=AccessDenied` when the sign-in callback
  // rejects the account (allowlist miss).
  await page.route("**/api/auth/signin/google*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/?error=AccessDenied" }),
    })
  );

  await page.goto("/");
  await page.getByRole("button", { name: /Continue with Google/i }).click();

  // Localized denial message (default UI locale is en).
  await expect(page.getByRole("alert")).toHaveText("This account can't sign in here.");
  // The consumed error marker is cleaned from the URL (no ?error= residue).
  await expect.poll(() => new URL(page.url()).searchParams.has("error")).toBe(false);
  // No session was ever created.
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(false);
});

test("other sign-in errors surface the generic localized message without a session", async ({
  page,
  context,
}) => {
  await page.route("**/api/auth/signin/google*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/?error=Configuration" }),
    })
  );

  await page.goto("/");
  await page.getByRole("button", { name: /Continue with Google/i }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "We couldn’t complete that sign-in. Please try again or use a different account."
  );
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(false);
});
