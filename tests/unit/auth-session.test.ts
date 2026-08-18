// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { decode, encode } from "next-auth/jwt";

/**
 * Session JWT contract (spec 015 / T006).
 *
 * Auth.js v5 issues **encrypted** session JWTs (JWE, A256CBC-HS512) whose
 * decryption salt is the session-cookie name (`authjs.session-token`), the
 * same salt the runtime `decode` uses server-side (see
 * node_modules/@auth/core/lib/actions/session.js). These tests verify the
 * exact seam `session.isAuthenticated()` relies on:
 *
 * - only a token signed+encrypted with the configured `AUTH_SECRET` decodes;
 * - a token encrypted under any other key is rejected (never authenticates);
 * - an expired token is rejected (jose enforces `exp` within the 15 s clock
 *   tolerance Auth.js applies);
 * - `isAuthenticated`/`requireSession` map a decoded session to the playground
 *   guard (redirect to `/` when unauthenticated).
 */

const SESSION_COOKIE_NAME = "authjs.session-token"; // Auth.js default cookie name = JWT salt
const SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";

const redirectMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("../../src/features/auth/server/auth", () => ({ auth: authMock }));

/** Signs an encrypted session JWT the way Auth.js would for our config. */
async function issueSessionToken(
  payload: Record<string, unknown>,
  secret = SECRET,
  maxAge = 24 * 60 * 60
) {
  return encode({ token: payload, secret, salt: SESSION_COOKIE_NAME, maxAge });
}

/** Mirrors the server's decode step; never throws, returns null on failure. */
async function tryDecode(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    return await decode({ token, secret, salt: SESSION_COOKIE_NAME });
  } catch {
    return null;
  }
}

describe("session JWT — signature/expiry guard (spec 015 T006)", () => {
  it("a correctly signed, unexpired test JWT decodes and authenticates", async () => {
    const token = await issueSessionToken({ provider: "google" });
    const decoded = await tryDecode(token, SECRET);
    expect(decoded?.provider).toBe("google");
  });

  it("a JWT signed with the wrong key must NOT authenticate (decode yields nothing)", async () => {
    const token = await issueSessionToken({ provider: "google" });
    // Direct decode rejects: never returns a payload under a foreign key.
    await expect(
      decode({ token, secret: "attacker-key", salt: SESSION_COOKIE_NAME })
    ).rejects.toThrow();
    // And the seam-level helper yields null (anonymous), not a session.
    expect(await tryDecode(token, "attacker-key")).toBeNull();
  });

  it("an expired JWT must NOT authenticate", async () => {
    // A negative maxAge forces `exp` into the past (encode sets exp = now + maxAge).
    const expired = await issueSessionToken({ provider: "google" }, SECRET, -60);
    expect(await tryDecode(expired, SECRET)).toBeNull();
  });

  it("a tampered token (valid key material, invalid ciphertext) is rejected", async () => {
    const token = await issueSessionToken({ provider: "google" });
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await tryDecode(tampered, SECRET)).toBeNull();
  });
});

describe("session guards — isAuthenticated / requireSession (spec 015 T006)", () => {
  it("isAuthenticated is true only for a session that reports authenticated", async () => {
    vi.resetModules();
    const { isAuthenticated } = await import("../../src/features/auth/server/session");
    authMock.mockResolvedValue({ authenticated: true, provider: "google" });
    expect(await isAuthenticated()).toBe(true);
    authMock.mockResolvedValue({ authenticated: false });
    expect(await isAuthenticated()).toBe(false);
    authMock.mockResolvedValue(null);
    expect(await isAuthenticated()).toBe(false);
  });

  it("requireSession redirects to '/' when there is no valid session", async () => {
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT_TO_LOGIN");
    });
    vi.resetModules();
    const { requireSession } = await import("../../src/features/auth/server/session");
    authMock.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT_TO_LOGIN");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("requireSession passes through for an authenticated session", async () => {
    vi.resetModules();
    const { requireSession } = await import("../../src/features/auth/server/session");
    authMock.mockResolvedValue({ authenticated: true, provider: "github" });
    await expect(requireSession()).resolves.toBeUndefined();
  });
});
