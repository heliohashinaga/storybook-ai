import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TtsRuntime } from "../../src/features/story-read-aloud/server/tts-runtime";
import { TtsProviderError } from "../../src/features/story-read-aloud/server/tts-provider";
import { InMemoryRateLimiter } from "../../src/lib/rate-limit";

/**
 * `POST /api/narrate` route tests (spec 004, T011/T023).
 *
 * The route module instantiates the real TTS runtime at load time, which reads
 * the validated server env (`src/lib/env.ts`), so the required OpenRouter
 * provider vars are stubbed before the dynamic import. All assertions exercise
 * the exported `createNarrateHandler` seam with an injected fake runtime —
 * never a live TTS service.
 *
 * Privacy invariants asserted here: the endpoint accepts ONLY `sceneText` +
 * `locale`; a payload smuggling an identifier (e.g. `name`) is rejected before
 * the runtime is invoked; every response carries `Cache-Control: no-store`.
 */

/** Required env vars so the module-level runtime boots in tests. */
const REQUIRED_ENV: Record<string, string> = {
  OPENROUTER_API_KEY: "test-key",
};

let route: typeof import("../../src/app/api/narrate/route");

beforeAll(async () => {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value);
  }
  vi.resetModules();
  route = await import("../../src/app/api/narrate/route");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/** Builds a fake runtime, returning the mock so tests can assert the call. */
function makeRuntime(overrides: Partial<TtsRuntime> = {}) {
  const synthesize = vi.fn();
  return {
    runtime: { enabled: true, synthesize, ...overrides } as TtsRuntime,
    synthesize,
  };
}

/** Builds a handler wired with a high-cap anonymous rate limiter + salt. */
function makeHandler(runtime: TtsRuntime) {
  return route.createNarrateHandler({
    runtime,
    rateLimiter: new InMemoryRateLimiter({
      limit: 1_000_000,
      windowMs: 60_000,
    }),
    salt: "test-salt",
  });
}

/** Builds a handler with a low (e.g. 1-request) anonymous rate limit + salt. */
function makeLimitedHandler(runtime: TtsRuntime, limit: number) {
  return route.createNarrateHandler({
    runtime,
    rateLimiter: new InMemoryRateLimiter({
      limit,
      windowMs: 60_000,
    }),
    salt: "test-salt",
  });
}

function post(
  handler: ReturnType<typeof route.createNarrateHandler>,
  body: unknown
): Promise<Response> {
  return handler(
    new Request("http://localhost/api/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

function rawPost(handler: ReturnType<typeof route.createNarrateHandler>, body: string | null) {
  return handler(
    new Request("http://localhost/api/narrate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === null ? {} : { body }),
    })
  );
}

describe("POST /api/narrate — route", () => {
  it("answers 204 (no-store, empty body) when AI narration is disabled, without touching the runtime", async () => {
    const { runtime, synthesize } = makeRuntime({ enabled: false });
    const handler = makeHandler(runtime);
    const response = await post(handler, { sceneText: "Era uma vez", locale: "pt-BR" });

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.body).toBeNull();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("returns transient audio bytes (200, audio/mpeg, no-store) for a valid request", async () => {
    const { runtime, synthesize } = makeRuntime();
    const audio = new Uint8Array([1, 2, 3, 4, 5]);
    synthesize.mockResolvedValue({ format: "audio/mpeg", audio, mode: "ai" });
    const handler = makeHandler(runtime);

    const response = await post(handler, {
      sceneText: "Era uma vez uma estrelinha.",
      locale: "pt-BR",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(audio);
    // Only sceneText + locale reach the runtime.
    expect(synthesize).toHaveBeenCalledWith("Era uma vez uma estrelinha.", {
      locale: "pt-BR",
    });
  });

  it("rejects malformed JSON as invalid input (400) without calling the runtime", async () => {
    const { runtime, synthesize } = makeRuntime();
    const handler = makeHandler(runtime);

    const response = await rawPost(handler, "{not-json");

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("invalid_input");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("rejects a missing/empty body as invalid input (400)", async () => {
    const { runtime, synthesize } = makeRuntime();
    const handler = makeHandler(runtime);

    const response = await rawPost(handler, null);

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_input");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("rejects empty/whitespace-only sceneText (400) and a missing locale (400)", async () => {
    const { runtime, synthesize } = makeRuntime();
    const handler = makeHandler(runtime);

    const whitespace = await post(handler, { sceneText: "   ", locale: "pt-BR" });
    expect(whitespace.status).toBe(400);
    expect((await whitespace.json()).code).toBe("invalid_input");
    expect(whitespace.headers.get("cache-control")).toBe("no-store");

    const noLocale = await post(handler, { sceneText: "Era uma vez" });
    expect(noLocale.status).toBe(400);
    expect((await noLocale.json()).code).toBe("invalid_input");
    expect(noLocale.headers.get("cache-control")).toBe("no-store");

    expect(synthesize).not.toHaveBeenCalled();
  });

  it("rejects an unsupported locale as unsupported_locale (422)", async () => {
    const { runtime, synthesize } = makeRuntime();
    const handler = makeHandler(runtime);

    const response = await post(handler, { sceneText: "Era uma vez", locale: "fr" });

    expect(response.status).toBe(422);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("unsupported_locale");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("rejects a payload smuggling an identifier (400) before the runtime is invoked", async () => {
    const { runtime, synthesize } = makeRuntime();
    const handler = makeHandler(runtime);

    const response = await post(handler, {
      sceneText: "Era uma vez",
      locale: "pt-BR",
      name: "Luna",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).code).toBe("invalid_input");
    // Privacy invariant: the identifier never reaches the runtime.
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("is anonymous: the runtime receives only sceneText + locale, never an identifier", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockResolvedValue({
      format: "audio/mpeg",
      audio: new Uint8Array([7]),
      mode: "ai",
    });
    const handler = makeHandler(runtime);

    const response = await post(handler, { sceneText: "Era uma vez", locale: "en" });

    expect(response.status).toBe(200);
    expect(synthesize).toHaveBeenCalledTimes(1);
    const callArgs = synthesize.mock.calls[0] as unknown;
    expect(JSON.stringify(callArgs)).not.toMatch(/"name"/i);
  });

  it("accepts sceneText at the max length and rejects one char beyond (400) without calling the runtime", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockResolvedValue({
      format: "audio/mpeg",
      audio: new Uint8Array([3]),
      mode: "ai",
    });
    const handler = makeHandler(runtime);
    const max = route.NARRATE_TEXT_MAX;

    const atMax = await post(handler, { sceneText: "a".repeat(max), locale: "pt-BR" });
    expect(atMax.status).toBe(200);
    expect(atMax.headers.get("cache-control")).toBe("no-store");

    const overMax = await post(handler, { sceneText: "a".repeat(max + 1), locale: "pt-BR" });
    expect(overMax.status).toBe(400);
    expect((await overMax.json()).code).toBe("invalid_input");
    expect(overMax.headers.get("cache-control")).toBe("no-store");

    // Only the in-range request reached the provider.
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("maps a provider unavailable error to 502 (narration_unavailable, no-store)", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockRejectedValue(
      new TtsProviderError({ kind: "unavailable", message: "TTS down" })
    );
    const handler = makeHandler(runtime);

    const response = await post(handler, { sceneText: "Era uma vez", locale: "pt-BR" });

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("narration_unavailable");
  });

  it("maps a provider timeout error to 504 (narration_timeout, no-store)", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockRejectedValue(new TtsProviderError({ kind: "timeout", message: "TTS slow" }));
    const handler = makeHandler(runtime);

    const response = await post(handler, { sceneText: "Era uma vez", locale: "pt-BR" });

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("narration_timeout");
  });

  it("does not retry the provider on failure (single synthesize call)", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockRejectedValue(
      new TtsProviderError({ kind: "unavailable", message: "TTS down" })
    );
    const handler = makeHandler(runtime);

    const response = await post(handler, { sceneText: "Era uma vez", locale: "pt-BR" });

    expect(response.status).toBe(502);
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("ratelimits a second request under a 1-request limit with 429 narration_rate_limited (T028/FR-005)", async () => {
    const { runtime, synthesize } = makeRuntime();
    synthesize.mockResolvedValue({
      format: "audio/mpeg",
      audio: new Uint8Array([1]),
      mode: "ai",
    });
    const handler = makeLimitedHandler(runtime, 1);

    const first = await post(handler, { sceneText: "Era uma vez", locale: "pt-BR" });
    expect(first.status).toBe(200);
    expect(synthesize).toHaveBeenCalledTimes(1);

    const second = await post(handler, { sceneText: "Outra estrelinha", locale: "pt-BR" });
    expect(second.status).toBe(429);
    expect(second.headers.get("cache-control")).toBe("no-store");
    expect(second.headers.get("retry-after")).toBeTruthy();
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe("narration_rate_limited");
    // The throttled request never reaches the expensive TTS provider.
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
});
