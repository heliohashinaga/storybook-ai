import { describe, expect, it, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeToggle } from "../../src/features/theme/components/theme-toggle";
import { getMessages } from "../../src/i18n/config";

/** Emulates the OS light/dark preference (reuses the hook test's approach). */
function setSystemPrefersDark(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? dark : !dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderToggle() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <ThemeToggle />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
  vi.restoreAllMocks();
});

describe("ThemeToggle — hydration-safe light/dark toggle (blossom-design §7.1)", () => {
  it("renders as a button that targets the action it performs on a light system", () => {
    setSystemPrefersDark(false);
    renderToggle();
    const button = screen.getByRole("button", { name: "Ativar modo escuro" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects the effective dark appearance when the OS prefers dark", () => {
    setSystemPrefersDark(true);
    renderToggle();
    // In dark, the toggle offers to turn the app light.
    const button = screen.getByRole("button", { name: "Ativar modo claro" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking the toggle flips the session-only override (adds .dark, then .light)", () => {
    setSystemPrefersDark(false);
    renderToggle();
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo escuro" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: "Ativar modo claro" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo claro" }));
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button", { name: "Ativar modo escuro" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});
