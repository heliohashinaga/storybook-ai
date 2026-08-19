import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  OAuthProviderButton,
  type OAuthProvider,
} from "../../src/features/auth/components/oauth-provider-button";

/**
 * OAuthProviderButton (spec 015) — presentational blossom button.
 * `onClick` is injected by the login screen, so this unit covers rendering,
 * disabled/busy states and click wiring for both providers.
 */

function renderButton(overrides: Partial<Parameters<typeof OAuthProviderButton>[0]> = {}) {
  const onClick = overrides.onClick ?? vi.fn();
  const props = {
    provider: "google" as OAuthProvider,
    label: "Continue with Google",
    onClick,
    ...overrides,
  };
  const utils = render(<OAuthProviderButton {...props} />);
  return { onClick, ...utils };
}

describe("OAuthProviderButton — blossom OAuth action (spec 015)", () => {
  it("renders a labelled button for the Google provider", () => {
    renderButton({ provider: "google", label: "Continue with Google" });
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  it("renders a labelled button for the GitHub provider", () => {
    renderButton({ provider: "github", label: "Continue with GitHub" });
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  });

  it("calls the injected onClick when the enabled button is clicked", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ label: "Continue with GitHub" });
    const button = screen.getByRole("button", { name: "Continue with GitHub" });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks clicks and reports disabled when the provider isn't configured", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ disabled: true, label: "Continue with Google" });
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("enters a busy (aria-busy) state that also disables further clicks", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ busy: true, label: "Continue with Google" });
    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clears aria-busy when idle", () => {
    renderButton({ label: "Continue with Google" });
    expect(screen.getByRole("button", { name: "Continue with Google" })).not.toHaveAttribute(
      "aria-busy"
    );
  });
});
