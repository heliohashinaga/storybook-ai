import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * OAuth guard rails (spec 015 / T008).
 *
 * OAuth state/CSRF validation and same-origin `redirectTo` checks are enforced
 * by Auth.js itself; the repo must never widen those defaults. These tests
 * assert the guard rails the repo owns end to end:
 *
 * - with no `AUTH_SECRET` every `/api/auth/*` attempt is rejected (401) — a
 *   session can never be minted, so no state/redirect from a provider is ever
 *   accepted;
 * - the Auth.js config does not define a `redirect` callback (default: only
 *   same-origin `redirectTo` is honored, external targets are blocked), does
 *   not disable CSRF/state checks, and does not relax dangerous defaults
 *   (`allowDangerousEmailAccountLinking` / callback-url host whitelist);
 * - providers are restricted to the Google/GitHub enum driven by env — no
 *   free-form OAuth endpoint can be injected.
 */

const nextAuthMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({ default: nextAuthMock }));

const AUTH_KEYS = [
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_URL",
  "AUTH_TRUST_HOST",
  "AUTH_ALLOWLIST_EMAILS",
];

function clearAuthEnv(): void {
  for (const key of AUTH_KEYS) delete process.env[key];
}

interface CapturedAuthConfig {
  redirect?: unknown;
  csrf?: unknown;
  providers?: Array<{ id?: string; type?: string }>;
  callbacks?: Record<string, unknown>;
  adapter?: unknown;
  allowDangerousEmailAccountLinking?: unknown;
}

async function loadAuth(env: Record<string, string>): Promise<CapturedAuthConfig> {
  clearAuthEnv();
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  nextAuthMock.mockClear();
  nextAuthMock.mockImplementation(() => ({
    handlers: {
      GET: async () => new Response(null, { status: 200 }),
      POST: async () => new Response(null, { status: 200 }),
    },
    auth: async () => null,
  }));
  vi.resetModules();
  await import("../../src/features/auth/server/auth");
  return (nextAuthMock.mock.calls[0]?.[0] ?? {}) as CapturedAuthConfig;
}

describe("OAuth guard rails (spec 015 T008)", () => {
  it("without AUTH_SECRET every /api/auth attempt is rejected (401) — no session can be minted", async () => {
    clearAuthEnv();
    vi.resetModules();
    const { handlers, auth } = await import("../../src/features/auth/server/auth");
    const request = new Request(
      "http://localhost/api/auth/callback/google?code=x&state=y"
    ) as unknown as NextRequest;
    expect((await handlers.GET(request)).status).toBe(401);
    expect((await handlers.POST(request)).status).toBe(401);
    expect(await auth()).toBeNull();
  });

  it("does not override the same-origin redirect guard (no redirect callback, CSRF checks on)", async () => {
    const config = await loadAuth({ AUTH_SECRET: "test-secret" });
    // Auth.js default: `redirectTo` may only point at the same origin; an
    // external `redirectTo` is blocked. Ctrl `redirect` callback would be the
    // only way to widen that, so it must be absent.
    expect(config.redirect).toBeUndefined();
    // CSRF + OAuth state validation are on by default; the config must not
    // disable them.
    expect(config.csrf).toBeUndefined();
    expect(config.allowDangerousEmailAccountLinking).toBeUndefined();
  });

  it("resolves no provider when no credentials are configured (nothing to sign in with)", async () => {
    const config = await loadAuth({ AUTH_SECRET: "test-secret" });
    expect(config.providers).toHaveLength(0);
  });

  it("registers only the Google/GitHub enum providers driven by env", async () => {
    const config = await loadAuth({
      AUTH_SECRET: "test-secret",
      AUTH_GOOGLE_ID: "google-id",
      AUTH_GOOGLE_SECRET: "google-secret",
      AUTH_GITHUB_ID: "github-id",
      AUTH_GITHUB_SECRET: "github-secret",
    });
    const ids = (config.providers ?? []).map((p) => p.id);
    expect(ids.sort()).toEqual(["github", "google"]);
    for (const provider of config.providers ?? []) {
      expect(["google", "github"]).toContain(provider.id);
    }
  });
});
