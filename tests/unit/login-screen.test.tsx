import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LoginScreenView } from "../../src/features/auth/components/login-screen-view";
import { getMessages } from "../../src/i18n/config";

/**
 * LoginScreenView (spec 018) — anonymous-by-design login gate.
 *
 * In the test (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) the component renders the
 * demo-only panel; we assert the app frame that exists in both modes (heading +
 * "explore the demo" entry). The Clerk `<SignIn>` internals are not unit-tested
 * here (covered by the divergence note in ADR 0013 / tasks T-20).
 */
function renderLogin() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <LoginScreenView />
    </NextIntlClientProvider>
  );
}

describe("LoginScreenView (spec 018)", () => {
  it("renders the heading and demo entry in demo-only mode", () => {
    renderLogin();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  });
});
