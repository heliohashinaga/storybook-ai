import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Session-cookie contract (spec 015 / T007 + ADR 0012 ratification).
 *
 * The only allowed cookie is the Auth.js session token: httpOnly, SameSite=Lax,
 * Secure in production, 24h TTL. The config must not weaken Auth.js defaults
 * (`cookies: undefined` ⇒ httpOnly + SameSite=Lax + Secure on https), must be
 * stateless (no adapter/database), and the demo path (`/demo`, anonymous
 * stories) never sets any cookie.
 */

const nextAuthMock = vi.hoisted(() => vi.fn());
const storyRequestAppMock = vi.hoisted(() => vi.fn());
storyRequestAppMock.mockReturnValue(null);

vi.mock("next-auth", () => ({ default: nextAuthMock }));
vi.mock("../../src/features/story-request/components/story-request-app", () => ({
  StoryRequestApp: storyRequestAppMock,
}));

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

async function loadAuthConfig(env: Record<string, string>) {
  clearAuthEnv();
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  nextAuthMock.mockClear();
  nextAuthMock.mockImplementation(() => ({ handlers: {}, auth: async () => null }));
  vi.resetModules();
  await import("../../src/features/auth/server/auth");
  const captured = nextAuthMock.mock.calls[0]?.[0] as
    | { session?: { strategy?: string; maxAge?: number }; adapter?: unknown; cookies?: unknown }
    | undefined;
  return captured;
}

describe("session cookie contract (spec 015 T007)", () => {
  it("uses a stateless JWT session with a 24h TTL and never an adapter/database", async () => {
    const config = await loadAuthConfig({ AUTH_SECRET: "test-secret" });
    expect(config?.session?.strategy).toBe("jwt");
    expect(config?.session?.maxAge).toBe(24 * 60 * 60);
    expect(config?.session?.maxAge ?? Infinity).toBeLessThanOrEqual(24 * 60 * 60);
    expect(config?.adapter).toBeUndefined();
  });

  it("does not override Auth.js cookie defaults (httpOnly, SameSite=Lax, Secure in prod)", async () => {
    const config = await loadAuthConfig({ AUTH_SECRET: "test-secret" });
    // Auth.js default cookies (defaultCookies): httpOnly=true, sameSite=lax,
    // secure=auto (Secure when the site is served over https). Overriding
    // `cookies` would be the only way to weaken these, so it must stay unset.
    expect(config?.cookies).toBeUndefined();
  });

  it("received no session cookie on the anonymous story response (demo path is cookie-less)", async () => {
    const { createStoriesHandler } = await import("../../src/app/api/stories/route");
    const { createFakeProvider } = await import("../fixtures/story-generation/provider-fixtures");
    const { InMemoryRateLimiter } = await import("../../src/lib/rate-limit");
    const handler = createStoriesHandler({
      provider: createFakeProvider({ scenario: "safe" }).provider,
      illustrate: async () => ({ dataUri: "data:image/webp;base64,QUJDRA" }),
      rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 100 }),
      salt: "test-salt",
      trustForwardedFor: false,
    });
    const response = await handler(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ageBand: "5-7", locale: "pt-BR", theme: "courage" }),
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("/demo renders the demo app without any auth/session surface (no cookie capable mount)", async () => {
    vi.resetModules();
    const { default: DemoPage } = await import("../../src/app/demo/page");
    render(DemoPage());
    expect(storyRequestAppMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ isFake: true })
    );
  });
});
