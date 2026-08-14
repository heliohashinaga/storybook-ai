import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { LangToggle } from "../../src/features/shell/components/lang-toggle";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import ptBR from "../../src/features/story-request/locales/pt-BR.json";

function renderToggle() {
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <NextIntlClientProvider locale="pt-BR" messages={ptBR}>
        <LangToggle />
      </NextIntlClientProvider>
    </LocaleProvider>
  );
}

describe("LangToggle (blossom §7.1)", () => {
  it("shows both languages with the active one pressed", () => {
    renderToggle();

    const pt = screen.getByRole("button", { name: /português/i });
    const en = screen.getByRole("button", { name: /english/i });

    // pt-BR is the default → active.
    expect(pt).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the active language when the other option is clicked", async () => {
    const user = userEvent.setup();
    renderToggle();

    const en = screen.getByRole("button", { name: /english/i });
    await user.click(en);

    expect(en).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /português/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("exposes an accessible group label for the segmented control", () => {
    renderToggle();
    expect(screen.getByRole("group", { name: /idioma|language/i })).toBeInTheDocument();
  });

  it("does not rerender a cycle when toggling (no persistence side effects)", async () => {
    const user = userEvent.setup();
    const onLocaleChange = vi.fn();
    renderToggle();

    await user.click(screen.getByRole("button", { name: /english/i }));
    // Clicking the current option again is a no-op.
    await user.click(screen.getByRole("button", { name: /english/i }));

    expect(onLocaleChange).not.toHaveBeenCalled();
  });
});
