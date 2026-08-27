import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TURNSTILE_SITEVERIFY_URL,
  createTurnstileVerifier,
  type TurnstileVerifier,
} from "../../src/features/story-generation/server/turnstile-verify";

/**
 * Server-side Turnstile verification (feature 019 — US2/US4).
 * Hermetic: `fetch` is mocked. Failures must fail-closed (never `true`), and an
 * unconfigured verifier must be inert (feature off).
 */

describe("createTurnstileVerifier — unconfigured (feature off)", () => {
  it("is not configured without a secret key and never verifies", async () => {
    const v = createTurnstileVerifier(undefined);
    expect(v.configured).toBe(false);
    expect(await v.verify("any")).toBe(false);
  });
});

describe("createTurnstileVerifier — configured siteverify", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let verifier: TurnstileVerifier;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    verifier = createTurnstileVerifier("secret-x");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies a token when siteverify returns success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    expect(await verifier.verify("token-1")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL);
    // The secret travels in the form body, never in a header/log.
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret-x");
    expect(body.get("response")).toBe("token-1");
  });

  it("rejects when siteverify reports success=false", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false })));
    expect(await verifier.verify("token-1")).toBe(false);
  });

  it("rejects on a non-2xx response (fail-closed)", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    expect(await verifier.verify("token-1")).toBe(false);
  });

  it("rejects a redirect instead of following it (SSRF discipline)", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://x" } })
    );
    expect(await verifier.verify("token-1")).toBe(false);
  });

  it("rejects on a network error (fail-closed, never pass through)", async () => {
    fetchMock.mockRejectedValue(new Error("net down"));
    expect(await verifier.verify("token-1")).toBe(false);
  });

  it("rejects malformed/oversized tokens without calling the network", async () => {
    expect(await verifier.verify("")).toBe(false);
    expect(await verifier.verify("x".repeat(5000))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
