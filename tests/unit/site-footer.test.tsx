import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { GITHUB_REPO_URL, SiteFooter } from "../../src/features/shell/components/site-footer";
import { getMessages } from "../../src/i18n/config";

/**
 * SiteFooter — the globally-rendered portfolio footer. Rendered once in the
 * root layout, on every route incl. the reader. The repo link must open the
 * public portfolio repository safely (external target/rel) and stay localized.
 */

function renderFooter(locale: "pt-BR" | "en" = "pt-BR") {
  return render(
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}

describe("SiteFooter", () => {
  it("renders a localized GitHub portfolio link (pt-BR)", () => {
    renderFooter("pt-BR");

    const link = screen.getByRole("link", { name: "Ver código no GitHub" });
    expect(link).toBeVisible();
  });

  it("renders a localized GitHub portfolio link (en)", () => {
    renderFooter("en");

    const link = screen.getByRole("link", { name: "View source on GitHub" });
    expect(link).toBeVisible();
  });

  it("links out to the public portfolio repo safely", () => {
    renderFooter();

    const link = screen.getByRole("link", { name: "Ver código no GitHub" });
    expect(link).toHaveAttribute("href", GITHUB_REPO_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});
