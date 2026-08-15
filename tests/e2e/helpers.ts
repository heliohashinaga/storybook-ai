import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E helpers for Spec 009 frontend-routes journeys.
 *
 * The app defaults to English (layout `defaultLocale="en"`), so pt-BR journeys
 * must explicitly switch to pt-BR first. Two independent controls exist:
 *   - the header `LangToggle` switches the whole UI locale (stable
 *     `aria-label="Português (Brasil)"` in both locales);
 *   - the form's story-locale selector drives the generation payload
 *     (`locale`), independent of the UI locale.
 * A pt-BR journey needs BOTH switched, so the reader assertions (pt-BR labels)
 * and the payload (`locale === "pt-BR"`) are consistent.
 */

/** Switches the UI and the form's story-locale to pt-BR. */
export async function switchToPortuguese(page: Page): Promise<void> {
  // 1. Header LangToggle → pt-BR UI (aria-label is stable across locales).
  await page.locator("header").getByRole("button", { name: "Português (Brasil)" }).click();
  // 2. Form story-locale selector → pt-BR (drives the generation payload).
  await page.locator("form").getByRole("button", { name: "Português (Brasil)" }).click();
  // The UI re-renders in pt-BR; wait for a pt-BR label to be present.
  await expect(page.getByLabel(/Idioma/i).first()).toBeVisible();
}
