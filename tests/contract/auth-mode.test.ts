import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/stories — mode derivation from the auth session (spec 015, T005).
 *
 * The route must pick the deterministic **demo** runtime for anonymous
 * callers and the real **playground** runtime for authenticated ones,
 * `STORIES_TEST_MODE=fake` overrides everything to demo (e2e/visual
 * determinism), and the wire contract (`ageBand|locale|theme|sceneCount`) is
 * identical in both modes. `createRuntimeForMode` is faked with two tagged
 * runtimes so the response itself proves which runtime the handler used; the
 * real `resolveGenerationMode` drives the selection.
 */

const validPayload = { ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 };

const sessionMocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(async () => false),
}));

vi.mock("../../src/features/auth/server/session", () => ({
  isAuthenticated: sessionMocks.isAuthenticated,
  requireSession: vi.fn(),
  auth: vi.fn(async () => null),
}));

vi.mock("../../src/features/story-generation/server/generation-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/features/story-generation/server/generation-runtime")
    >();
  const { createFakeProvider } = await import("../fixtures/story-generation/provider-fixtures");
  const { InMemoryRateLimiter } = await import("../../src/lib/rate-limit");

  const webpDataUri = "data:image/webp;base64,QUJDRA";

  /** Wraps the deterministic fake provider so its story title carries a mode tag. */
  function taggedProvider(tag: "demo" | "playground") {
    const fake = createFakeProvider({ scenario: "safe" });
    return {
      provider: {
        generateStory: async (input: Parameters<typeof fake.provider.generateStory>[0]) => {
          const candidate = await fake.provider.generateStory(input);
          return { ...candidate, title: `${tag}:${candidate.title}` };
        },
        moderateText: fake.provider.moderateText,
        moderateImage: fake.provider.moderateImage,
      },
      illustrate: async () => ({ dataUri: webpDataUri }),
      rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 100 }),
      salt: "test-salt",
      trustForwardedFor: false,
    };
  }

  return {
    ...actual,
    createRuntimeForMode: vi.fn((mode: "playground" | "demo") => taggedProvider(mode)),
  };
});

import { resolveGenerationMode } from "../../src/features/story-generation/server/generation-runtime";

function post(body: unknown) {
  return new Request("http://localhost/api/stories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/stories — auth-driven runtime selection (spec 015 T005)", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
    sessionMocks.isAuthenticated.mockResolvedValue(false);
  });

  afterEach(() => {
    delete process.env.STORIES_TEST_MODE;
  });

  it("anonymous caller (no session) gets the deterministic demo runtime", async () => {
    sessionMocks.isAuthenticated.mockResolvedValue(false);
    const { POST } = await import("../../src/app/api/stories/route");
    const response = await POST(post(validPayload));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // The anonymous path must never set a session cookie (privacy invariant).
    expect(response.headers.get("set-cookie")).toBeNull();
    const story = (await response.json()) as { title: string };
    expect(story.title).toContain("demo:");
  });

  it("authenticated caller enters the playground runtime", async () => {
    sessionMocks.isAuthenticated.mockResolvedValue(true);
    const { POST } = await import("../../src/app/api/stories/route");
    const response = await POST(post(validPayload));
    expect(response.status).toBe(200);
    const story = (await response.json()) as { title: string };
    expect(story.title).toContain("playground:");
  });

  it("STORIES_TEST_MODE=fake forces the demo runtime even for authenticated callers", async () => {
    process.env.STORIES_TEST_MODE = "fake";
    sessionMocks.isAuthenticated.mockResolvedValue(true);
    const { POST } = await import("../../src/app/api/stories/route");
    const response = await POST(post(validPayload));
    expect(response.status).toBe(200);
    const story = (await response.json()) as { title: string };
    expect(story.title).toContain("demo:");
  });

  it("rejects an identity field before the provider runs (anonymous payload contract)", async () => {
    const { POST } = await import("../../src/app/api/stories/route");
    const response = await POST(post({ ...validPayload, name: "Luna" }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_input");
  });
});

describe("resolveGenerationMode — unit derivation (spec 015 T005)", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
  });
  afterEach(() => {
    delete process.env.STORIES_TEST_MODE;
  });

  it("anonymous -> demo, authenticated -> playground", () => {
    expect(resolveGenerationMode(false)).toBe("demo");
    expect(resolveGenerationMode(true)).toBe("playground");
  });

  it("STORIES_TEST_MODE=fake overrides every caller to demo", () => {
    process.env.STORIES_TEST_MODE = "fake";
    expect(resolveGenerationMode(false)).toBe("demo");
    expect(resolveGenerationMode(true)).toBe("demo");
  });
});
