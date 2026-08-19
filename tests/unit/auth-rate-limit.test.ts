import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * OAuth endpoint rate limiting (spec 010 hardening / spec 015 T009).
 *
 * `/api/auth/*` handlers are wrapped by `withAuthRateLimit`: an anonymous,
 * pseudo-anonymous key (salted hash of the client IP) with a bounded bucket —
 * exceeding the limit yields 429 + `Retry-After`, and every auth response
 * carries `Cache-Control: no-store`. Raw IPs are never retained (only a salted
 * hash) and the wrapper keeps working without any trustworthy IP via the
 * shared anonymous global key.
 */

const LIMIT_KEYS = [
  "AUTH_RATE_LIMIT_MAX_REQUESTS",
  "AUTH_RATE_LIMIT_WINDOW_MS",
  "TRUST_PROXY",
  "VERCEL",
];

function clearLimitEnv(): void {
  for (const key of LIMIT_KEYS) delete process.env[key];
}

type Wrapped = (request: NextRequest) => Promise<Response>;

async function loadWrapped(env: Record<string, string>): Promise<Wrapped> {
  clearLimitEnv();
  for (const [key, value] of Object.entries(env)) process.env[key] = value;
  vi.resetModules();
  const { withAuthRateLimit } = await import("../../src/features/auth/server/auth-rate-limit");
  const okHandler = async () => new Response("ok", { status: 200 });
  return withAuthRateLimit(okHandler);
}

function authRequest(ip?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/auth/callback/google?code=c&state=s", {
    method: "POST",
    headers,
  }) as unknown as NextRequest;
}

describe("withAuthRateLimit (spec 015 T009)", () => {
  it("allows up to the limit then answers 429 with Retry-After", async () => {
    const wrapped = await loadWrapped({
      AUTH_RATE_LIMIT_MAX_REQUESTS: "3",
      AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      TRUST_PROXY: "1",
    });
    for (let i = 0; i < 3; i += 1) {
      const response = await wrapped(authRequest("198.51.100.7"));
      expect(response.status).toBe(200);
    }
    const blocked = await wrapped(authRequest("198.51.100.7"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });

  it("stamps Cache-Control: no-store on every response (allowed and 429)", async () => {
    const wrapped = await loadWrapped({
      AUTH_RATE_LIMIT_MAX_REQUESTS: "2",
      AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      TRUST_PROXY: "1",
    });
    const allowed = await wrapped(authRequest("198.51.100.9"));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    const allowedToo = await wrapped(authRequest("198.51.100.9"));
    expect(allowedToo.status).toBe(200);
    expect(allowedToo.headers.get("cache-control")).toBe("no-store");
    const blocked = await wrapped(authRequest("198.51.100.9"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
  });

  it("a single allowed request stays under the limit (limit=1)", async () => {
    const wrapped = await loadWrapped({
      AUTH_RATE_LIMIT_MAX_REQUESTS: "1",
      AUTH_RATE_LIMIT_WINDOW_MS: "60000",
      TRUST_PROXY: "1",
    });
    expect((await wrapped(authRequest("198.51.100.10"))).status).toBe(200);
    expect((await wrapped(authRequest("198.51.100.10"))).status).toBe(429);
  });

  it("rate limits even without a trustworthy IP (shared anonymous global key)", async () => {
    const wrapped = await loadWrapped({
      AUTH_RATE_LIMIT_MAX_REQUESTS: "1",
      AUTH_RATE_LIMIT_WINDOW_MS: "60000",
    });
    // No TRUST_PROXY/VERCEL → X-Forwarded-For is client-forgeable and ignored.
    expect((await wrapped(authRequest("198.51.100.11"))).status).toBe(200);
    expect((await wrapped(authRequest("198.51.100.11"))).status).toBe(429);
  });
});
