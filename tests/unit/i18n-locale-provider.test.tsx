import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations } from "next-intl";
import { LocaleProvider, useLocaleContext } from "../../src/i18n/locale-provider";
import type { Locale } from "../../src/features/story-request/client/story-preferences-schema";

/**
 * LocaleProvider — single-locale experience (ADR 0003 / T056).
 *
 * The selected story language drives the whole UI: switching `setLocale("en")`
 * re-renders every `useTranslations` consumer in English (chrome, reader,
 * aria-live). Selection lives in React state only — anonymous by design, no
 * persistence.
 */

function Probe() {
  const t = useTranslations("story");
  const { locale, setLocale } = useLocaleContext();
  return (
    <div>
      <p data-testid="subtitle">{t("form.subtitle")}</p>
      <p data-testid="locale">{locale}</p>
      <button onClick={() => setLocale("en")}>to-en</button>
      <button onClick={() => setLocale("pt-BR")}>to-pt</button>
    </div>
  );
}

function renderProbe(defaultLocale: Locale = "pt-BR") {
  return render(
    <LocaleProvider defaultLocale={defaultLocale}>
      <Probe />
    </LocaleProvider>
  );
}

describe("LocaleProvider — single-locale experience (ADR 0003 / T056)", () => {
  it("defaults to pt-BR messages and exposes the locale", () => {
    renderProbe();
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Escolha um tema, diga a idade e receba uma história única."
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("pt-BR");
  });

  it("switches the whole UI to English when setLocale('en') is called", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "to-en" }));
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Pick a theme, set an age, and get a one-of-a-kind story."
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    // The page language follows the experience language (a11y).
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches back to pt-BR", async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "to-en" }));
    await user.click(screen.getByRole("button", { name: "to-pt" }));
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Escolha um tema, diga a idade e receba uma história única."
    );
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("normalizes an unsupported default locale to pt-BR (T052 recovery)", () => {
    renderProbe("fr" as never);
    expect(screen.getByTestId("locale")).toHaveTextContent("pt-BR");
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Escolha um tema, diga a idade e receba uma história única."
    );
  });
});
