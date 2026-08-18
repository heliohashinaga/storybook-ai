import { test, expect } from "@playwright/test";

/**
 * Playground access guard (spec 015, T023).
 *
 * `/form` and `/reader` are the authenticated playground: without a session the
 * server redirects deep links back to the login gate `/`. The anonymous
 * `POST /api/stories` surface stays open for the demo path and runs the
 * deterministic fake provider (no identity, `Cache-Control: no-store`) — the
 * guard gates the *UI routes*, never the anonymous story API.
 */

test("/form without a session redirects to the login gate", async ({ page }) => {
  await page.goto("/form");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  // The playground form itself is not exposed.
  await expect(page.getByRole("slider", { name: /Age/i })).toHaveCount(0);
});

test("/reader without a session redirects to the login gate", async ({ page }) => {
  await page.goto("/reader");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Storybook AI/i })).toBeVisible();
  await expect(page.getByLabel("Your story")).toHaveCount(0);
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
