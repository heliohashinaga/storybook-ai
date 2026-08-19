import { test, expect } from "@playwright/test";
import {
  assertPrivacyContract,
  captureStoryCalls,
  sessionCookie,
  waitForStoryResponse,
} from "./helpers";

/**
 * Simulated GitHub login journey (spec 015, T033) — mirrors login-google.spec.
 *
 * Deterministic OAuth simulation: the post-OAuth outcome (a valid
 * `authjs.session-token` JWE signed with the server's `AUTH_SECRET`) is injected
 * with Auth.js's own encoder, then `/` forwards the session to `/form`; the
 * story generation stays anonymous-by-design (payload = exactly
 * `ageBand|locale|theme|sceneCount`). Clicking the GitHub button is verified to
 * issue the real sign-in POST without any live provider navigation.
 *
 * Env contract: requires `AUTH_SECRET`; the button/wiring tests additionally
 * require `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`.
 */

const authSecret = process.env.AUTH_SECRET;
const githubCredentials = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

test.skip(!authSecret, "AUTH_SECRET must be set in the e2e env to exercise authenticated journeys");

test("the login gate shows the GitHub button when the provider is configured", async ({ page }) => {
  test.skip(
    !githubCredentials,
    "AUTH_GITHUB_ID/_SECRET required for the server to enable the button"
  );

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Continue with GitHub/i })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("a valid GitHub session lands on /form and generates an anonymous story", async ({
  page,
  context,
}) => {
  await context.addCookies([await sessionCookie(authSecret!, { provider: "github" })]);

  const payloads = await captureStoryCalls(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/form$/);
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  const response = waitForStoryResponse(page);
  await page.getByRole("slider", { name: /Age/i }).fill("6");
  await page.getByRole("button", { name: /^Friendship/i }).click();
  await page.getByRole("button", { name: "Create story" }).click();
  const storyResponse = await response;

  await expect(page).toHaveURL(/\/reader$/);
  await expect(page.getByLabel("Your story")).toBeVisible();
  expect(storyResponse.status()).toBe(200);
  expect(storyResponse.headers()["cache-control"]).toContain("no-store");

  expect(payloads).toHaveLength(1);
  assertPrivacyContract(payloads[0]!);
});

test("clicking Continue with GitHub issues the sign-in POST (no live provider navigation)", async ({
  page,
}) => {
  test.skip(
    !githubCredentials,
    "AUTH_GITHUB_ID/_SECRET required for the server to expose the button"
  );

  const signInRequest = page.waitForRequest("**/api/auth/signin/github*");
  await page.route("**/api/auth/signin/github*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "/" }),
    })
  );

  await page.goto("/");
  await expect(page.getByRole("button", { name: /Continue with GitHub/i })).toBeVisible();
  await page.getByRole("button", { name: /Continue with GitHub/i }).click();

  const request = await signInRequest;
  expect(request.method()).toBe("POST");
  expect(request.postData() ?? "").toContain("csrfToken");
  expect(request.url()).toContain("/api/auth/signin/github");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
