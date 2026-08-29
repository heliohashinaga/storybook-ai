import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "../../../i18n/locale-provider";

/**
 * Feature 020 / US3 + FR-006 regression guard: on the anonymous demo path (no
 * Clerk configured) the login screen must render the demo entry WITHOUT any
 * access-denied / restricted message. Forcing the demo path requires the module
 * to load with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` unset, so it is (re)imported
 * dynamically after the env is set.
 */
async function renderDemoLogin() {
  const { LoginScreenView } = await import("./login-screen-view");
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <LoginScreenView />
    </LocaleProvider>
  );
}

describe("LoginScreenView (demo mode, no Clerk)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "";
    vi.resetModules();
  });

  it("renders the anonymous demo entry", async () => {
    await renderDemoLogin();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /demo/i })).toBeInTheDocument();
  });

  it("never shows an access-denied / restricted message in demo mode", async () => {
    await renderDemoLogin();
    expect(screen.queryByText(/acesso negado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acesso restrito/i)).not.toBeInTheDocument();
    // "Acesso restrito" é o título padrão do Clerk — não pode vazar na demo.
    expect(screen.queryByText("Acesso restrito")).not.toBeInTheDocument();
  });
});
