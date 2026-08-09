import { describe, expect, it } from "vitest";
import { createStoriesHandler, type StoriesRouteDeps } from "../../src/app/api/stories/route";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit";
import { storyResponseSchema } from "../../src/features/story-generation/server/schemas";

const webpDataUri = "data:image/webp;base64,QUJDRA";

function makeDeps(overrides: Partial<StoriesRouteDeps> = {}): StoriesRouteDeps {
  const fake = createFakeProvider({ scenario: "safe" });
  return {
    provider: fake.provider,
    illustrate: async () => ({ dataUri: webpDataUri }),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 100 }),
    salt: "test-salt",
    ...overrides,
  };
}

function post(handler: ReturnType<typeof createStoriesHandler>, body: unknown) {
  return handler(
    new Request("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/stories — route", () => {
  it("returns a validated story with Cache-Control: no-store for a valid request", async () => {
    const response = await post(createStoriesHandler(makeDeps()), {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(storyResponseSchema.safeParse(body).success).toBe(true);
    expect(body.scenes).toHaveLength(3);
  });

  it("never surfaces an exact age or direct identifier in the response", async () => {
    const response = await post(createStoriesHandler(makeDeps()), {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
    });
    expect(await response.text()).not.toMatch(/"name"/i);
  });

  it("rejects a request that includes a name field (400)", async () => {
    const response = await post(createStoriesHandler(makeDeps()), {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      name: "Luna",
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("invalid_input");
  });

  it("rejects missing/invalid fields (400) and unsupported locale (422)", async () => {
    const handler = createStoriesHandler(makeDeps());
    const noTheme = await post(handler, { ageBand: "5-7", locale: "pt-BR" });
    expect(noTheme.status).toBe(400);

    const badLocale = await post(handler, { ageBand: "5-7", locale: "fr", theme: "courage" });
    expect(badLocale.status).toBe(422);
    expect((await badLocale.json()).code).toBe("unsupported_locale");

    const badTheme = await post(handler, { ageBand: "5-7", locale: "pt-BR", theme: "flying" });
    expect(badTheme.status).toBe(400);
    expect((await badTheme.json()).code).toBe("invalid_input");
    expect(badTheme.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a malformed or empty JSON body as invalid input (400)", async () => {
    const handler = createStoriesHandler(makeDeps());
    const malformed = await handler(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
        body: "{not-json",
      })
    );
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).code).toBe("invalid_input");
    expect(malformed.headers.get("cache-control")).toBe("no-store");

    const empty = await handler(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7" },
      })
    );
    expect(empty.status).toBe(400);
    expect((await empty.json()).code).toBe("invalid_input");
    expect(empty.headers.get("cache-control")).toBe("no-store");
  });

  it("routes anonymously when no x-forwarded-for header is present", async () => {
    const response = await createStoriesHandler(makeDeps())(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ageBand: "5-7", locale: "pt-BR", theme: "courage" }),
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("is anonymous: provider sees only ageBand/locale/theme", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const handler = createStoriesHandler(makeDeps({ provider: fake.provider }));
    await post(handler, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(fake.requests[0]).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(JSON.stringify(fake.requests[0])).not.toMatch(/"name"/i);
  });

  it("returns 429 with Retry-After and no-store when rate-limited", async () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 60_000, limit: 1 });
    const handler = createStoriesHandler(makeDeps({ rateLimiter: limiter }));
    await post(handler, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    const second = await post(handler, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(second.status).toBe(429);
    expect(second.headers.get("cache-control")).toBe("no-store");
    expect(second.headers.get("retry-after")).not.toBeNull();
    expect((await second.json()).code).toBe("rate_limited");
  });

  it("maps provider timeout to 504 and availability failure to 502", async () => {
    const timeout = createFakeProvider({ scenario: "timeout" });
    const h1 = createStoriesHandler(makeDeps({ provider: timeout.provider }));
    const res504 = await post(h1, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(res504.status).toBe(504);
    expect(res504.headers.get("cache-control")).toBe("no-store");
    expect((await res504.json()).code).toBe("generation_timeout");

    const unavailable = createFakeProvider({ scenario: "unavailable" });
    const h2 = createStoriesHandler(makeDeps({ provider: unavailable.provider }));
    const res502 = await post(h2, { ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(res502.status).toBe(502);
    expect(res502.headers.get("cache-control")).toBe("no-store");
    expect((await res502.json()).code).toBe("generation_unavailable");
  });
});
