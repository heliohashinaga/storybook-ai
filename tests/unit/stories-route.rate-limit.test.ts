import { describe, expect, it } from "vitest";
import { createStoriesHandler } from "../../src/app/api/stories/route";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit";
import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  StoryGenerationProvider,
} from "../../src/features/story-generation/server/story-generation-provider";

/**
 * Rate limiting / cost-per-capacity edge case (spec 005 FR-005/SC-002, T028).
 *
 * A cheap, fully-integrated, deterministic check that a second request to the
 * **dual story router** (`POST /api/stories`) under a limit of 1 responds with
 * HTTP 429 `rate_limited` (retryable, with `Retry-After`) — never a hard error
 * and never an expensive second provider call. The handler seam is exercised
 * directly with an injected limit-1 limiter so no real provider, story payload,
 * or env configuration is required.
 */

function fakeProvider(): StoryGenerationProvider {
  const candidate: GeneratedStoryCandidate = {
    title: "História de teste",
    scenes: [1, 2, 3].map((ordinal) => ({
      ordinal,
      title: `Cena ${ordinal}`,
      body: `Corpo da cena ${ordinal}.`,
      illustrationPrompt: `Ilustração da cena ${ordinal}.`,
    })),
  };
  const safe: ModerationDecision = { safe: true };
  return {
    generateStory: async () => candidate,
    moderateText: async () => safe,
    moderateImage: async () => safe,
  };
}

function makeHandler(limit: number) {
  return createStoriesHandler({
    provider: fakeProvider(),
    illustrate: async () => ({ dataUri: "data:image/webp;base64,QUJDRA==" }),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit }),
    salt: "test-salt",
  });
}

const REQUEST_BODY = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

describe("dual story route rate limiting (T028)", () => {
  it("allows the first request and ratelimits the second with a retryable 429", async () => {
    const handler = makeHandler(1);

    const first = await handler(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(REQUEST_BODY),
      })
    );
    expect(first.status).toBe(200);

    const second = await handler(
      new Request("http://localhost/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(REQUEST_BODY),
      })
    );
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBeTruthy();
    const body = (await second.json()) as { code?: string };
    expect(body.code).toBe("rate_limited");
    expect(second.headers.get("cache-control")).toBe("no-store");
  });

  it("distinguishes clients via the pseudo-anonymous key (different IPs not throttled together)", async () => {
    const handler = makeHandler(1);

    const ipA = new Request("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
      body: JSON.stringify(REQUEST_BODY),
    });
    const ipB = new Request("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.9" },
      body: JSON.stringify(REQUEST_BODY),
    });

    expect((await handler(ipA)).status).toBe(200);
    expect((await handler(ipA)).status).toBe(429); // A throttled after first
    expect((await handler(ipB)).status).toBe(200); // B not throttled (own bucket)
  });
});
