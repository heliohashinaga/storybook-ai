import { describe, expect, it, vi } from "vitest";
import {
  createStoriesHandler,
  type StoriesRouteDeps,
} from "../../src/app/api/stories/create-stories-handler";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit";
import type { TurnstileVerifier } from "../../src/features/story-generation/server/turnstile-verify";

/**
 * Demo anti-bot gate on `POST /api/stories` (feature 019 — US2/US4).
 * A request on the demo path (`enforceTurnstile`) without a valid solved proof
 * must be refused with 403 BEFORE generation, and the provider must never run.
 */

const webpDataUri = "data:image/webp;base64,QUJDRA";

function makeDeps(overrides: Partial<StoriesRouteDeps> = {}): StoriesRouteDeps {
  const fake = createFakeProvider({ scenario: "safe" });
  return {
    provider: fake.provider,
    illustrate: async () => ({ dataUri: webpDataUri }),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 100 }),
    salt: "test-salt",
    trustForwardedFor: true,
    ...overrides,
  };
}

function verifier(verifyImpl: (token: string) => Promise<boolean>): TurnstileVerifier {
  return { configured: true, verify: vi.fn(verifyImpl) };
}

function post(handler: ReturnType<typeof createStoriesHandler>, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers["cf-turnstile-token"] = token;
  return handler(
    new Request("http://localhost/api/stories", {
      method: "POST",
      headers,
      body: JSON.stringify({ ageBand: "5-7", locale: "pt-BR", theme: "courage" }),
    })
  );
}

const validPayloadBody = JSON.stringify({
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
});

describe("POST /api/stories — demo anti-bot gate (US2)", () => {
  it("rejects demo without a proof (403) and never invokes the provider", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const handler = createStoriesHandler(
      makeDeps({
        provider: fake.provider,
        turnstile: verifier(async () => true),
        enforceTurnstile: true,
      })
    );
    const response = await post(handler);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("captcha_failed");
    expect(fake.requests).toHaveLength(0);
  });

  it("rejects demo with an invalid/expired/replayed proof (403) without generation", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const v = verifier(async () => false);
    const handler = createStoriesHandler(
      makeDeps({ provider: fake.provider, turnstile: v, enforceTurnstile: true })
    );
    const response = await post(handler, "bad-token");
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("captcha_failed");
    expect(v.verify).toHaveBeenCalledWith("bad-token");
    expect(fake.requests).toHaveLength(0);
  });

  it("accepts demo with a verified proof (200)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const handler = createStoriesHandler(
      makeDeps({
        provider: fake.provider,
        turnstile: verifier(async () => true),
        enforceTurnstile: true,
      })
    );
    const response = await post(handler, "good-token");
    expect(response.status).toBe(200);
    expect(fake.requests.length).toBeGreaterThan(0);
    const body = await response.text();
    expect(body).not.toMatch(/name/i);
  });

  it("rejects demo when the verifier is unreachable (fail-closed, US4)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const handler = createStoriesHandler(
      makeDeps({
        provider: fake.provider,
        turnstile: verifier(async () => false),
        enforceTurnstile: true,
      })
    );
    const response = await post(handler, "token");
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("captcha_failed");
    expect(body.retryable).toBe(true);
    expect(fake.requests).toHaveLength(0);
  });

  it("does NOT gate the playground path even when a verifier is present (FR-008)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const v = verifier(async () => true);
    const handler = createStoriesHandler(
      makeDeps({ provider: fake.provider, turnstile: v, enforceTurnstile: false })
    );
    const response = await post(handler);
    expect(response.status).toBe(200);
    expect(v.verify).not.toHaveBeenCalled();
    expect(validPayloadBody).toContain("ageBand");
  });
});
