// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gatekeeper session guard (ADR 0015).
 *
 * `isAuthenticated()`/`requireSession()` verify the `__Host-gatekeeper` JWT
 * from the request cookies. `next/headers` is mocked; real gate tokens are
 * minted through `gate.ts` (proves the wiring, not a stub). On a demo-only
 * deploy (no gatekeeper vars) everything resolves to anonymous — never
 * crashes, never authenticates.
 */

const SECRET = "test-gatekeeper-secret-0123456789abcdef";

const redirectMock = vi.hoisted(() => vi.fn());
const cookieGetMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));

/**
 * Loads the session module against a configured gatekeeper. Only the JWT
 * signing secret is required here: these tests exercise token verification, not
 * password verification (covered by `gate.test.ts` / `api/gate/route.test.ts`).
 */
async function loadSession() {
  process.env.GATEKEEPER_SECRET = SECRET;
  vi.resetModules();
  const session = await import("../../src/features/auth/server/session");
  const gate = await import("../../src/features/auth/server/gate");
  return { ...session, ...gate };
}

beforeEach(() => {
  redirectMock.mockReset();
  redirectMock.mockImplementation(() => {
    throw new Error("redirect");
  });
  cookieGetMock.mockReset();
  delete process.env.GATEKEEPER_SECRET;
  delete process.env.PLAYGROUND_PASSWORD_HASH;
});

describe("session — gatekeeper (ADR 0015)", () => {
  it("isAuthenticated true with a valid gate token cookie", async () => {
    const { isAuthenticated, createGateToken, GATE_COOKIE_NAME } = await loadSession();
    const token = await createGateToken();
    cookieGetMock.mockReturnValue({ value: token });
    expect(await isAuthenticated()).toBe(true);
    expect(cookieGetMock).toHaveBeenCalledWith(GATE_COOKIE_NAME);
  });

  it("isAuthenticated false with no cookie", async () => {
    const { isAuthenticated } = await loadSession();
    cookieGetMock.mockReturnValue(undefined);
    expect(await isAuthenticated()).toBe(false);
  });

  it("isAuthenticated false with a forged token", async () => {
    const { isAuthenticated } = await loadSession();
    cookieGetMock.mockReturnValue({ value: "forged.token.here" });
    expect(await isAuthenticated()).toBe(false);
  });

  it("isAuthenticated false on a demo-only deploy (gatekeeper unconfigured)", async () => {
    vi.resetModules();
    delete process.env.GATEKEEPER_SECRET;
    delete process.env.PLAYGROUND_PASSWORD_HASH;
    const { isAuthenticated } = await import("../../src/features/auth/server/session");
    cookieGetMock.mockReturnValue({ value: "anything" });
    expect(await isAuthenticated()).toBe(false);
  });

  it("requireSession redirects to / when not authenticated", async () => {
    const { requireSession } = await loadSession();
    cookieGetMock.mockReturnValue(undefined);
    await expect(requireSession()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("requireSession does not redirect when authenticated", async () => {
    const { requireSession, createGateToken } = await loadSession();
    cookieGetMock.mockReturnValue({ value: await createGateToken() });
    await expect(requireSession()).resolves.toBeUndefined();
  });
});
