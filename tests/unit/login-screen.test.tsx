import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LoginScreenView } from "../../src/features/auth/components/login-screen-view";
import { getMessages } from "../../src/i18n/config";

/**
 * LoginScreenView (porteiro, ADR 0015) — anonymous-by-design password gate.
 *
 * With the gate configured the component renders the shared-password form
 * (submitted to `POST /api/gate/login`, never stored); without it, only the
 * demo-only panel. The gate internals (JWT, cookies) are covered by
 * `gate.test.ts` / `api/gate/route.test.ts` — here we assert the UI contract.
 */

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

function renderLogin(gateConfigured: boolean) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <LoginScreenView gateConfigured={gateConfigured} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  pushMock.mockClear();
  fetchMock.mockReset();
});

describe("LoginScreenView (porteiro, ADR 0015)", () => {
  it("renders the heading, password field, and demo entry when configured", () => {
    renderLogin(true);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  });

  it("renders the demo-only panel (no password field) when unconfigured", () => {
    renderLogin(false);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  });

  it("posts the password to /api/gate/login and enters on success", async () => {
    fetchMock.mockResolvedValue({ ok: true } as Response);
    renderLogin(true);

    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/gate/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ password: "correct-horse" }),
        })
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/form");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces a generic error and stays put on wrong password", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);
    renderLogin(true);

    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/senha incorreta/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
