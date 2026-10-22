import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { LoginScreenView } from "./login-screen-view";

/**
 * Porteiro demo-mode regression guard (ADR 0015): with the gatekeeper
 * unconfigured the login screen must render the demo entry WITHOUT any
 * password field — the anonymous demo path stays cookie-free and never
 * prompts for a secret that could never validate.
 */
function renderDemoLogin() {
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <LoginScreenView gateConfigured={false} />
    </LocaleProvider>
  );
}

describe("LoginScreenView (demo mode, gatekeeper unconfigured)", () => {
  it("renders the anonymous demo entry", () => {
    renderDemoLogin();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /demo/i })).toBeInTheDocument();
  });

  it("never shows a password prompt in demo mode", () => {
    renderDemoLogin();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
  });
});
