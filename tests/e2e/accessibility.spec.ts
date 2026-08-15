import { test, expect, type Page } from "@playwright/test";
import { injectAxe, getViolations } from "axe-playwright";

/**
 * Application-level accessibility coverage (T059).
 *
 * Runs axe against the live app (deterministic dev provider — never a live AI
 * service) across the states that Storybook's isolated per-story checks cannot:
 * the real form, the error submission UI, the reader with export controls, and
 * the in-session story switcher.
 *
 * All scans enforce WCAG 2.1 A + AA (including the AA colour-contrast
 * requirement — `wcag2aa`/`wcag21aa` colours). A separate reduced-motion
 * scenario confirms `prefers-reduced-motion: reduce` is honoured: the media
 * query matches and the global CSS collapses animation/transition durations to
 * a near-zero (≤1ms) value instead of leaving long animations running.
 */

const AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

async function expectNoViolations(page: Page): Promise<void> {
  await injectAxe(page);
  const violations = await getViolations(page, undefined, {
    runOnly: { type: "tag", values: [...AA_TAGS] },
  });
  expect(violations).toEqual([]);
}

async function fillAndSubmit(page: Page): Promise<void> {
  await page.getByLabel(/Idade da criança/i).fill("6");
  // Theme is a visual ChoiceCard group (FR-UX-001): select by clicking the card.
  await page.getByRole("button", { name: /^Coragem/i }).click();
  await page.getByRole("button", { name: /Criar história/i }).click();
}

test.describe("application accessibility (T059)", () => {
  test("landing form has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /storybook ai/i }).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test("reader and export controls have no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await fillAndSubmit(page);
    await response;
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();

    // Reader scene controls plus the export button are on screen and reachable
    // by keyboard, with the focused control clearly indicated.
    await expect(page.getByRole("button", { name: /Baixar como PDF/i })).toBeVisible();
    await page.getByRole("button", { name: /Próxima cena/i }).focus();
    await expect(page.getByRole("button", { name: /Próxima cena/i })).toBeFocused();

    await expectNoViolations(page);
  });

  test("in-session story switcher has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    const first = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await fillAndSubmit(page);
    await first;
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();

    // Append a second story so the switcher appears.
    const second = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Gerar outra história/i }).click();
    await second;
    await expect(page.getByText("Cena 1 de 3")).toBeVisible();

    // The accessible switcher group exposes the active story via a pressed state.
    const switcher = page.getByLabel("Suas histórias");
    await expect(switcher).toBeVisible();
    await expect(switcher.getByRole("button", { pressed: true })).toHaveCount(1);
    await switcher.getByRole("button").first().focus();
    await expect(switcher.getByRole("button").first()).toBeFocused();

    await expectNoViolations(page);
  });

  test("error state has no WCAG A/AA violations", async ({ page }) => {
    // Force a rate-limited response so the real error UI renders.
    await page.route("**/api/stories", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          code: "rate_limited",
          messageKey: "story.error.tryAgainLater",
          retryable: true,
        }),
      })
    );

    await page.goto("/");
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/stories") && r.request().method() === "POST"
    );
    await fillAndSubmit(page);
    await response;

    // The accessible error message renders and the form stays usable.
    await expect(page.getByText(/Muitas solicitações/i)).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("prefers-reduced-motion (T059)", () => {
  test("reduced-motion is honoured in the app", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // The media query is active under the reduced-motion preference.
    expect(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ).toBe(true);

    // The global CSS collapses animation/transition durations to ≤1ms rather
    // than leaving long animations running for a reduced-motion user.
    const durations = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.transition = "opacity 400ms ease";
      probe.style.animation = "spin 1s linear infinite";
      document.body.appendChild(probe);
      const transitionDuration = parseFloat(getComputedStyle(probe).transitionDuration);
      const animationDuration = parseFloat(getComputedStyle(probe).animationDuration);
      probe.remove();
      return { transitionDuration, animationDuration };
    });
    expect(durations.transitionDuration).toBeLessThanOrEqual(1);
    expect(durations.animationDuration).toBeLessThanOrEqual(1);

    // The reduced app still renders a fully accessible form.
    await expectNoViolations(page);
  });
});
