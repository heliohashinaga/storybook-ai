import { test, expect } from "@playwright/test";
import { assertPrivacyContract, captureStoryCalls, waitForStoryResponse } from "./helpers";

/**
 * Anonymous demo journey (spec 015, T038).
 *
 * The login gate always offers "Explore the Demo" — no account, no cookie. The
 * journey drives the real `POST /api/stories` route against the deterministic
 * fake provider and verifies the anonymous privacy contract end to end:
 *   1. `/` (login gate) → "Explore the Demo" → `/demo`.
 *   2. The demo form has no direct-identifier input.
 *   3. Generating a story sends exactly `ageBand|locale|theme|sceneCount` and
 *      lands on `/demo/reader` with the reader UI.
 */

test("login gate → demo → generate fake story → demo reader", async ({ page }) => {
  const payloads = await captureStoryCalls(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();

  // Demo entry point is available without any authentication.
  await page.getByRole("link", { name: /Explore the Demo/i }).click();
  await expect(page).toHaveURL(/\/demo$/);

  // No direct-identifier input on the demo form (privacy invariant).
  await expect(page.getByLabel(/nome|child|filho|name/i)).toHaveCount(0);

  const response = waitForStoryResponse(page);
  await page.getByRole("slider", { name: /Age/i }).fill("6");
  await page.getByRole("button", { name: /^Friendship/i }).click();
  await page.getByRole("button", { name: "Create story" }).click();
  const storyResponse = await response;

  // The demo reader mirrors the playground reader route.
  await expect(page).toHaveURL(/\/demo\/reader$/);
  await expect(page.getByLabel("Your story")).toBeVisible();
  await expect(page.getByText(/Scene 1 of 3/i)).toBeVisible();
  expect(storyResponse.status()).toBe(200);
  expect(storyResponse.headers()["cache-control"]).toContain("no-store");

  expect(payloads).toHaveLength(1);
  assertPrivacyContract(payloads[0]!);
});
