import { test, expect } from "@playwright/test";
import { AUTH_COOKIE_NAME } from "./helpers";

/**
 * Demo path is cookie-free (spec 015, T039).
 *
 * The demo surface (`/demo`, `/demo/reader`) is the anonymous-by-design path:
 * it must never set any cookie — in particular it must not receive the
 * `authjs.session-token` session cookie, and the login gate `/` sets no cookie
 * while the visitor stays anonymous. Asserted both on the HTTP response
 * headers and on the browser context state.
 */

test("the login gate and the demo routes set no cookie on the wire", async ({ request }) => {
  for (const path of ["/", "/demo", "/demo/reader"]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} should render`).toBe(true);
    expect(
      response.headers()["set-cookie"],
      `${path} must not set a cookie (anonymous by design)`
    ).toBeUndefined();
  }
});

test("browsing the demo leaves the browser context cookie-free", async ({ page, context }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/);
  expect(await context.cookies()).toEqual([]);

  // Generate a story (deterministic fake) and follow it into /demo/reader.
  await page.getByRole("slider", { name: /Age/i }).fill("5");
  await page.getByRole("button", { name: /^Kindness/i }).click();
  const response = page.waitForResponse(
    (res) => res.url().includes("/api/stories") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Create story" }).click();
  await response;
  await expect(page).toHaveURL(/\/demo\/reader$/);
  await expect(page.getByLabel("Your story")).toBeVisible();

  // Still zero cookies — including no auth session cookie.
  const cookies = await context.cookies();
  expect(cookies).toEqual([]);
  expect(cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(false);
});
