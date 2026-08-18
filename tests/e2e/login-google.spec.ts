import { test, expect } from "@playwright/test";
import {
  assertPrivacyContract,
  AUTH_COOKIE_NAME,
  captureStoryCalls,
  sessionCookie,
  waitForStoryResponse,
} from "./helpers";

/**
 * Simulated Google login journey (spec 015, T022).
 *
 * The OAuth *dance* itself cannot run in CI (it would hit accounts.google.com
 * and needs a live provider), so the flow is simulated deterministically:
 *   1. The login gate renders the "Continue with Google" button (when the
 *      server has Google credentials configured) and always renders the Demo
 *      entry point.
 *   2. The post-OAuth outcome — a valid `authjs.session-token` JWE signed with
 *      the server's `AUTH_SECRET` — is injected with Auth.js's own encoder
 *      (`next-auth/jwt`), then `/` must forward the session straight to `/form`.
 *   3. Generating a story stays anonymous-by-design: the outbound payload
 *      carries exactly `ageBand|locale|theme|sceneCount` — never an identity —
 *      and the deterministic fake provider renders the reader.
 *   4. Signing out clears the session cookie and returns to the login gate.
 *   5. Clicking the button is verified to issue the real sign-in POST (wired to
 *      `/api/auth/signin/google`) without any live provider navigation.
 *
 * Env contract: authenticated-journey tests skip unless `AUTH_SECRET` is
 * present; the button/wiring tests additionally require
 * `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (the server exposes the button only
 * when credentials are configured).
 */

const authSecret = process.env.AUTH_SECRET;
const googleCredentials = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

test.skip(!authSecret, "AUTH_SECRET must be set in the e2e env to exercise authenticated journeys");

test("the login gate shows the Demo entry and the configured Google button (no session stays on /)", async ({
  page,
}) => {
  test.skip(
    !googleCredentials,
    "AUTH_GOOGLE_ID/_SECRET required for the server to enable the button"
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  // The Google OAuth button is wired to the sign-in flow.
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  // The anonymous demo remains available side by side.
  await expect(page.getByRole("link", { name: /Explore the Demo/i })).toBeVisible();
  // No session → the gate stays on / (no implicit redirect to /form).
  await expect(page).toHaveURL(/\/$/);
});

test("a valid Google session lands on /form and generates an anonymous story", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie(authSecret!, { provider: "google" })]);

  const payloads = await captureStoryCalls(page);

  // The OAuth redirect-back outcome: the login gate sees a session and forwards
  // the visitor to the playground form.
  await page.goto("/");
  await expect(page).toHaveURL(/\/form$/);

  // The clean playground form has no direct-identifier input (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  // Generate a story with the deterministic fake provider (STORIES_TEST_MODE).
  const response = waitForStoryResponse(page);
  await page.getByRole("slider", { name: /Age/i }).fill("6");
  await page.getByRole("button", { name: /^Friendship/i }).click();
  await page.getByRole("button", { name: "Create story" }).click();
  const storyResponse = await response;

  await expect(page).toHaveURL(/\/reader$/);
  await expect(page.getByLabel("Your story")).toBeVisible();
  await expect(page.getByText(/Scene 1 of 3/i)).toBeVisible();
  expect(storyResponse.status()).toBe(200);
  expect(storyResponse.headers()["cache-control"]).toContain("no-store");

  // Privacy invariant: the outbound payload is exactly ageBand|locale|theme|sceneCount.
  expect(payloads).toHaveLength(1);
  assertPrivacyContract(payloads[0]!);
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(true);
});

test("signing out clears the session and returns to the login gate", async ({ page, context }) => {
  await context.addCookies([await sessionCookie(authSecret!, { provider: "google" })]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/form$/);

  // The header exposes "Sign out" only on the playground routes.
  await page
    .locator("header")
    .getByRole("button", { name: /Sign out/i })
    .click();

  // Back at the gate with the session cookie removed.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(false);
});

test("clicking Continue with Google issues the sign-in POST (no live provider navigation)", async ({
  page,
}) => {
  test.skip(
    !googleCredentials,
    "AUTH_GOOGLE_ID/_SECRET required for the server to expose the button"
  );

  // Fulfil the OAuth initiation with the same JSON contract the Auth.js server
  // returns for `X-Auth-Return-Redirect` requests; the client then navigates to
  // the returned URL. Pointing it back at `/` keeps the flow local.
  const signInRequest = page.waitForRequest("**/api/auth/signin/google");
  await page.route("**/api/auth/signin/google", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/" }),
    })
  );

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  await page.getByRole("button", { name: /Continue with Google/i }).click();

  const request = await signInRequest;
  expect(request.method()).toBe("POST");
  const body = request.postData() ?? "";
  expect(body).toContain("csrfToken");
  // The redirect target never leaves the app (no accounts.google.com hop).
  expect(request.url()).toContain("/api/auth/signin/google");
  await expect(page).toHaveURL(/\/$/);
  // No transient error surfaced by the sign-in attempt.
  await expect(page.getByRole("alert")).toHaveCount(0);
});
