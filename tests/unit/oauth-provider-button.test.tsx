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

// --- spec 016 US2: accessible touch target + nothing touch-only ---
describe("OAuthProviderButton — accessible touch target (spec 016 US2)", () => {
  it("preserves a >=44px touch target whether idle, busy, or disabled", () => {
    for (const state of [{}, { busy: true }, { disabled: true }] as const) {
      const { container } = renderButton({ label: "Continue with Google", ...state });
      const button = container.querySelector("button") as HTMLButtonElement;
      // The button keeps min-h-12 (48px token) in all states; jsdom does not
      // compute layout, so we assert the responsive height utility is present
      // rather than measuring pixels. min-h-12 >= the 44px accessible minimum
      // and never reduces the target below it.
      expect(button.className).toContain("min-h-12");
      expect(button.className).not.toContain("min-h-8");
    }
  });

  it("remains fully operable by keyboard (not touch-only)", async () => {
    const user = userEvent.setup();
    const { onClick } = renderButton({ label: "Continue with GitHub" });
    const button = screen.getByRole("button", { name: "Continue with GitHub" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
