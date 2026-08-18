import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import {
  LoginScreenView,
  type LoginCredentials,
} from "../../src/features/auth/components/login-screen-view";
import { getMessages } from "../../src/i18n/config";

/**
 * LoginScreenView (spec 015 US1) — anonymous-by-design login gate.
 *
 * OAuth is simulated: `next-auth/react` signIn is mocked (never a live
 * provider), `next/navigation` useSearchParams is mocked so ?error= states can
 * be asserted per-case. Messages come from the real pt-BR catalog.
 */

const authState = vi.hoisted(() => {
  const signIn = vi.fn<(provider: string) => Promise<void>>();
  return { signIn };
});

const navState = vi.hoisted(() => {
  let error: string | null = null;
  // Stable object reference — `useSearchParams` must not churn per render.
  const params = {
    get: (key: string) => (key === "error" ? error : null),
  };
  return {
    setError: (value: string | null) => {
      error = value;
    },
    params,
  };
});

vi.mock("next-auth/react", () => ({
  signIn: authState.signIn,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navState.params,
}));

function renderLogin(credentials: LoginCredentials) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <LoginScreenView credentials={credentials} />
    </NextIntlClientProvider>
  );
}

const WITH_PROVIDERS: LoginCredentials = { google: true, github: true };
const WITHOUT_PROVIDERS: LoginCredentials = { google: false, github: false };

describe("LoginScreenView — anonymous login gate (spec 015)", () => {
  beforeEach(() => {
    navState.setError(null);
    authState.signIn.mockReset();
    authState.signIn.mockResolvedValue(undefined);
  });

  it("renders the page title, brand headline and subtitle", () => {
    renderLogin(WITH_PROVIDERS);

    // Brand title (Storybook AI) + the storytelling tagline + the description
    // stay as page content below the icon.
    expect(screen.getByRole("heading", { level: 1, name: "Storybook AI" })).toBeVisible();
    expect(screen.getByText("Crie histórias mágicas com IA.")).toBeVisible();
    expect(
      screen.getByText("Crie histórias infantis personalizadas com belas ilustrações.")
    ).toBeVisible();
  });

  it("renders the AI Playground card with both provider buttons when credentials exist", () => {
    renderLogin(WITH_PROVIDERS);

    const playground = screen.getByRole("heading", { level: 2, name: "AI Playground" });
    expect(playground).toBeVisible();
    expect(screen.getByText("Gere histórias usando modelos de IA reais.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar com o Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continuar com o GitHub" })).toBeEnabled();
  });

  it("disables both OAuth buttons when no AUTH_* credentials are configured", () => {
    renderLogin(WITHOUT_PROVIDERS);

    // No providers configured → playground card is hidden, a notice explains why.
    expect(screen.queryByRole("heading", { name: "AI Playground" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "O acesso ainda não está configurado nesta instância."
    );
  });

  it('separates the sign-in card from the demo entry with an "or" divider', () => {
    renderLogin(WITH_PROVIDERS);

    // Blossom-style divider: OAuth card … — ou — … Explore the Demo.
    expect(screen.getByText("— ou —")).toBeVisible();
    // The demo entry remains a separate section (not merged into the sign-in card).
    expect(screen.getByRole("region", { name: "Explorar a Demo" })).toBeVisible();
  });

  it("keeps the demo entry always enabled and pointing at /demo", () => {
    renderLogin(WITHOUT_PROVIDERS);

    const demo = screen.getByRole("link", { name: "Explorar a Demo" });
    expect(demo).toHaveAttribute("href", "/demo");
    expect(demo).toBeVisible();
    // The demo section is labeled with the same localized string (a11y).
    expect(screen.getByRole("region", { name: "Explorar a Demo" })).toBeVisible();
  });

  it("groups the not-configured notice, the demo button and its hint in one card", () => {
    renderLogin(WITHOUT_PROVIDERS);

    // Without any provider credentials, the "sign-in isn't configured" notice,
    // the Explore-the-Demo button and the hint all live in the same card.
    const card = screen.getByRole("region", { name: "Explorar a Demo" });
    expect(within(card).getByRole("note")).toHaveTextContent(
      "O acesso ainda não está configurado nesta instância."
    );
    expect(within(card).getByRole("link", { name: "Explorar a Demo" })).toBeVisible();
    expect(
      within(card).getByText("Experimente histórias pré-geradas — sem precisar de conta.")
    ).toBeVisible();
  });

  it("does not call signIn when a disabled provider button is clicked", async () => {
    const user = userEvent.setup();
    renderLogin({ google: false, github: true });

    const google = screen.getByRole("button", { name: "Continuar com o Google" });
    expect(google).toBeDisabled();
    await user.click(google);
    expect(authState.signIn).not.toHaveBeenCalled();
  });

  it("signs in with the provider when the enabled button is activated by keyboard (Enter)", async () => {
    const user = userEvent.setup();
    renderLogin(WITH_PROVIDERS);

    const google = screen.getByRole("button", { name: "Continuar com o Google" });
    google.focus();
    expect(google).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(authState.signIn).toHaveBeenCalledWith("google");
  });

  it("calls signIn(github) when the GitHub button is clicked", async () => {
    const user = userEvent.setup();
    renderLogin(WITH_PROVIDERS);

    await user.click(screen.getByRole("button", { name: "Continuar com o GitHub" }));
    expect(authState.signIn).toHaveBeenCalledWith("github");
  });

  it("maps an AccessDenied callback to the localized restricted-access message", () => {
    navState.setError("AccessDenied");
    renderLogin(WITH_PROVIDERS);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Esta conta não tem permissão para entrar aqui.");
  });

  it("maps any other OAuth callback error to the generic sign-in message", () => {
    navState.setError("Configuration");
    renderLogin(WITH_PROVIDERS);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível concluir o acesso. Tente novamente ou use outra conta."
    );
  });

  it("surfaces a transient signIn() failure as the same localized generic error", async () => {
    const user = userEvent.setup();
    authState.signIn.mockRejectedValueOnce(new Error("network"));
    renderLogin(WITH_PROVIDERS);

    await user.click(screen.getByRole("button", { name: "Continuar com o Google" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível concluir o acesso. Tente novamente ou use outra conta."
      );
    });
  });

  it("shows no alert without an error callback", () => {
    renderLogin(WITH_PROVIDERS);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the localizable privacy note (anonymous by design)", () => {
    renderLogin(WITHOUT_PROVIDERS);
    expect(
      screen.getByText("Anônimo por design — nenhum dado de conta ou história é armazenado.")
    ).toBeVisible();
  });
});
