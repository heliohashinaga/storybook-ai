import { describe, expect, it, vi } from "vitest";

/**
 * AUTH_ALLOWLIST_EMAILS access control (spec 015 / T010, FR-016).
 *
 * The `signIn` callback is the allowlist gate: emails outside the list are
 * rejected (Auth.js answers AccessDenied), emails inside are accepted, the
 * comparison is case-insensitive and happens purely in memory — the email is
 * never logged, stored, or returned (anonymous-by-design).
 */

const nextAuthMock = vi.hoisted(() => vi.fn());
const logMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth", () => ({ default: nextAuthMock }));
vi.mock("../../src/features/auth/server/anonymous-logger", () => ({ logAuthEvent: logMock }));

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

async function loadSignInCallback(
  allowlist: string | undefined
): Promise<
  (params: {
    user?: { email?: string | null };
    account?: { provider?: string };
  }) => Promise<boolean>
> {
  clearAuthEnv();
  process.env.AUTH_SECRET = "test-secret";
  if (allowlist !== undefined) process.env.AUTH_ALLOWLIST_EMAILS = allowlist;
  nextAuthMock.mockClear();
  logMock.mockClear();
  nextAuthMock.mockImplementation(() => ({ handlers: {}, auth: async () => null }));
  vi.resetModules();
  await import("../../src/features/auth/server/auth");
  const captured = nextAuthMock.mock.calls[0]?.[0] as {
    callbacks?: { signIn?: (p: unknown) => Promise<boolean> };
  };
  const signIn = captured?.callbacks?.signIn;
  if (!signIn) throw new Error("signIn callback was not registered");
  return signIn as (p: {
    user?: { email?: string | null };
    account?: { provider?: string };
  }) => Promise<boolean>;
}

describe("AUTH_ALLOWLIST_EMAILS — signIn gate (spec 015 T010)", () => {
  it("accepts an allowlisted email (case-insensitive)", async () => {
    const signIn = await loadSignInCallback("a@example.com, B@example.com");
    await expect(
      signIn({ user: { email: "a@example.com" }, account: { provider: "google" } })
    ).resolves.toBe(true);
    await expect(
      signIn({ user: { email: "B@EXAMPLE.COM" }, account: { provider: "github" } })
    ).resolves.toBe(true);
    expect(logMock).toHaveBeenCalledWith("signin_success", { provider: "google" });
    expect(logMock).toHaveBeenCalledWith("signin_success", { provider: "github" });
  });

  it("rejects an email outside the allowlist (no session) and logs only the outcome", async () => {
    const signIn = await loadSignInCallback("a@example.com");
    await expect(
      signIn({ user: { email: "stranger@example.com" }, account: { provider: "google" } })
    ).resolves.toBe(false);
    expect(logMock).toHaveBeenCalledWith("signin_denied", { provider: "google" });
  });

  it("rejects a sign-in without an email (nothing to compare, no session)", async () => {
    const signIn = await loadSignInCallback("a@example.com");
    await expect(signIn({ user: {}, account: { provider: "github" } })).resolves.toBe(false);
  });

  it("accepts any provider email when no allowlist is configured (open mode)", async () => {
    const signIn = await loadSignInCallback(undefined);
    await expect(
      signIn({ user: { email: "anyone@example.com" }, account: { provider: "google" } })
    ).resolves.toBe(true);
  });

  it("never leaks an email into logs or the response", async () => {
    const signIn = await loadSignInCallback("a@example.com");
    await signIn({ user: { email: "secret@example.com" }, account: { provider: "google" } });
    const logged = JSON.stringify(logMock.mock.calls);
    expect(logged).not.toContain("secret@example.com");
    expect(logged).not.toContain("a@example.com");
    // Every logged event remains the anonymous { ns, event, provider } shape.
    for (const call of logMock.mock.calls) {
      expect(Object.keys((call[1] ?? {}) as object).sort()).toEqual(["provider"]);
    }
  });
});
