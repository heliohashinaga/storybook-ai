import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Turnstile } from "../../src/features/story-request/components/turnstile";

/**
 * Turnstile widget (feature 019 — US1). Hermetic: `window.turnstile` is mocked
 * and the site key is toggled per-case via env (the config reads env at render).
 */

function renderWidget(opts: {
  onTokenChange?: (t: string) => void;
  onError?: (e: boolean) => void;
  resetKey?: number;
}) {
  const onTokenChange = opts.onTokenChange ?? vi.fn();
  const onError = opts.onError ?? vi.fn();
  const utils = render(
    <Turnstile onTokenChange={onTokenChange} onError={onError} resetKey={opts.resetKey ?? 0} />
  );
  return { onTokenChange, onError, ...utils };
}

describe("Turnstile widget", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete window.turnstile;
    document.querySelectorAll("script").forEach((s) => s.remove());
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete window.turnstile;
  });

  it("renders nothing (no-op) when the site key is not configured (feature off)", () => {
    renderWidget({});
    expect(screen.queryByTestId("turnstile-widget")).not.toBeInTheDocument();
  });

  it("renders the widget and reports a token via callback when configured", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x-test-site";
    const renderMock = vi.fn((_el, opts) => {
      opts.callback?.("resolved-token");
      return "w1";
    });
    window.turnstile = { render: renderMock, reset: vi.fn(), remove: vi.fn() };
    const { onTokenChange } = renderWidget({});
    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
    expect(onTokenChange).toHaveBeenCalledWith("resolved-token");
  });

  it("reports an error when the widget errors", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x-test-site";
    window.turnstile = {
      render: vi.fn((_el, opts) => {
        opts["error-callback"]?.();
        return "w1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    const { onError } = renderWidget({});
    expect(onError).toHaveBeenCalledWith(true);
  });

  it("resets the widget when resetKey changes", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x-test-site";
    const resetMock = vi.fn();
    window.turnstile = { render: vi.fn(() => "w1"), reset: resetMock, remove: vi.fn() };
    const { rerender } = renderWidget({ resetKey: 0 });
    act(() => rerender(<Turnstile onTokenChange={() => {}} onError={() => {}} resetKey={1} />));
    expect(resetMock).toHaveBeenCalled();
  });

  it("injects the challenge script and mounts on load when the API is lazy (live path)", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x-test-site";
    // No `window.turnstile` yet — the widget must inject the script and wait.
    renderWidget({});
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    expect(script).not.toBeNull();
    // Simulate the challenge CDN finishing load → render mounts.
    const renderMock = vi.fn(() => "w1");
    window.turnstile = { render: renderMock, reset: vi.fn(), remove: vi.fn() };
    act(() => script!.onload?.({} as Event));
    expect(renderMock).toHaveBeenCalled();
  });

  it("reports an error if the challenge script fails to load", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x-test-site";
    const { onError } = renderWidget({});
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    act(() => script!.onerror?.({} as Event));
    expect(onError).toHaveBeenCalledWith(true);
  });
});
