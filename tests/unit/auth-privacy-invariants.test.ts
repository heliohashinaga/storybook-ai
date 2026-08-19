import { describe, expect, it, vi } from "vitest";
import { createStoriesHandler } from "../../src/app/api/stories/route";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";
import { logAuthEvent } from "../../src/features/auth/server/anonymous-logger";
import { generateRequestSchema } from "../../src/features/story-generation/server/schemas";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit";

/**
 * Anonymous-by-design invariants (spec 015 / T011, AGENTS.md "Non-Negotiable
 * Privacy Rules").
 *
 * No email, name, sub, or any direct identifier may ever appear in: auth logs,
 * incoming payloads (rejected at the schema boundary), provider fakes, or
 * client responses. The wire contract stays exactly
 * `ageBand | locale | theme | sceneCount`.
 */

function makeHandler() {
  const fake = createFakeProvider({ scenario: "safe" });
  const handler = createStoriesHandler({
    provider: fake.provider,
    illustrate: async () => ({ dataUri: "data:image/webp;base64,QUJDRA" }),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 100 }),
    salt: "test-salt",
    trustForwardedFor: false,
  });
  return { fake, handler };
}

function post(handler: ReturnType<typeof createStoriesHandler>, body: unknown) {
  return handler(
    new Request("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("anonymous auth logging (spec 015 T011)", () => {
  it("logAuthEvent emits only ns/event/provider — never identity fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      logAuthEvent("signin_success", { provider: "google" });
      logAuthEvent("signin_denied");
      const lines = info.mock.calls.map((call) => String(call[0]));
      expect(lines).toHaveLength(2);
      const first = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
      const second = JSON.parse(lines[1] ?? "{}") as Record<string, unknown>;
      expect(Object.keys(first).sort()).toEqual(["event", "ns", "provider"]);
      expect(Object.keys(second).sort()).toEqual(["event", "ns"]);
      expect(first.ns).toBe("auth");
      expect(first.provider).toBe("google");
      // PII-shaped keys/values must be absent from the serialized output.
      const serialized = lines.join(" ");
      expect(serialized).not.toMatch(/email|name|sub\b|token|password|"ip"/i);
    } finally {
      info.mockRestore();
    }
  });
});

describe("story request schema — closed enum surface (spec 015 T011)", () => {
  it("accepts only ageBand | locale | theme | sceneCount", () => {
    expect(
      generateRequestSchema.safeParse({
        ageBand: "2-4",
        locale: "en",
        theme: "kindness",
        sceneCount: 5,
      }).success
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({ ageBand: "2-4", locale: "en", theme: "kindness" }).success
    ).toBe(true);
  });

  it("rejects every direct identifier field (email/name/sub/id)", () => {
    for (const extra of ["email", "name", "sub", "userId", "childName"]) {
      const result = generateRequestSchema.safeParse({
        ageBand: "5-7",
        locale: "pt-BR",
        theme: "courage",
        [extra]: "anything",
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("provider fakes and responses — no identifier leakage (spec 015 T011)", () => {
  it("records only the anonymous input (ageBand/locale/theme/sceneCount)", async () => {
    const { fake, handler } = makeHandler();
    const response = await post(handler, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(response.status).toBe(200);
    const recorded = fake.requests[0] as Record<string, unknown> | undefined;
    if (!recorded) throw new Error("provider recorded no request");
    expect(Object.keys(recorded).sort()).toEqual(["ageBand", "locale", "sceneCount", "theme"]);
  });

  it("rejects an identity field with 400 and never reaches the provider or the response", async () => {
    const { fake, handler } = makeHandler();
    const response = await post(handler, {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      email: "child@example.com",
    });
    expect(response.status).toBe(400);
    expect(fake.requests).toHaveLength(0);
    expect(await response.text()).not.toContain("child@example.com");
  });
});
