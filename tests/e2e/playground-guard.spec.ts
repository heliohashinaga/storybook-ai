import { test, expect } from "@playwright/test";
import { GATE_E2E_PASSWORD } from "./gate-fixtures";
import { GATE_SESSION_COOKIE_NAME } from "./helpers";

/**
 * Playground access guard (spec 015, T023).
 *
 * `/form` and `/reader` are the gated playground: without a session the
 * server redirects deep links back to the porteiro gate `/`. The anonymous
 * `POST /api/stories` surface stays open for the demo path and runs the
 * deterministic fake provider (no identity, `Cache-Control: no-store`) — the
 * guard gates the *UI routes*, never the anonymous story API.
 *
 * The porteiro is configured for the browser suites by `playwright.config.ts`
 * (see `gate-fixtures.ts`), so the password flow is exercised here: a wrong
 * password keeps the visitor on the gate with a generic error (no enumeration)
 * and the right one opens the playground with a `__Host-gatekeeper` cookie that
 * carries no identity.
 */

test("/form without a session redirects to the porteiro gate", async ({ page }) => {
  await page.goto("/form");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  // The playground form itself is not exposed.
  await expect(page.getByRole("slider", { name: /Age/i })).toHaveCount(0);
});

test("/reader without a session redirects to the porteiro gate", async ({ page }) => {
  await page.goto("/reader");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  await expect(page.getByLabel("Your story")).toHaveCount(0);
});

test("a wrong password keeps the visitor on the gate with a generic error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/password/i).fill("wrong-password");
  await page.getByRole("button", { name: /enter/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // No session is established by a failed attempt.
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === GATE_SESSION_COOKIE_NAME)).toBe(false);
});

test("the correct password opens the playground with a cookie-free-of-identity session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel(/password/i).fill(GATE_E2E_PASSWORD);
  await page.getByRole("button", { name: /enter/i }).click();

  // The gatekeeper redirects an authenticated visitor into the playground.
  await expect(page).toHaveURL(/\/form$/, { timeout: 20_000 });
  await expect(page.getByRole("slider", { name: /Age/i })).toBeVisible();

  // The session cookie is httpOnly in the browser and carries no identity:
  // it is a `{ gate: true }` JWT, never an e-mail/name/user id.
  const session = (await page.context().cookies()).find((c) => c.name === GATE_SESSION_COOKIE_NAME);
  expect(session, "the gatekeeper must set its session cookie").toBeDefined();
  expect(session?.httpOnly).toBe(true);
  const claims = JSON.parse(
    Buffer.from(session!.value.split(".")[1]!, "base64url").toString("utf8")
  ) as Record<string, unknown>;
  expect(claims.gate).toBe(true);
  for (const forbidden of ["email", "name", "sub", "userId", "identifier"]) {
    expect(claims[forbidden]).toBeUndefined();
  }
});

test("anonymous POST /api/stories runs the demo mode (deterministic, no identity)", async ({
  request,
}) => {
  const response = await request.post("/api/stories", {
    data: { ageBand: "5-7", locale: "en", theme: "friendship" },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const story = (await response.json()) as {
    title?: string;
    scenes?: unknown[];
    safetyDecision?: string;
    [key: string]: unknown;
  };
  // Demo mode: the fake provider returns the fixed catalog story (≥3 scenes).
  expect(typeof story.title).toBe("string");
  expect(story.scenes).toBeInstanceOf(Array);
  expect(story.scenes!.length).toBeGreaterThanOrEqual(3);
  expect(typeof story.safetyDecision).toBe("string");
  // The contract never leaks identity fields back to the caller.
  for (const forbidden of ["name", "email", "identifier", "childName"]) {
    expect(story[forbidden]).toBeUndefined();
  }
});
