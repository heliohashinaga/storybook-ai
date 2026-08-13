// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createOpenCodeIllustration } from "../../src/features/story-generation/server/create-opencode-illustration";
import { ProviderError } from "../../src/features/story-generation/server/story-generation-provider";

type Call = { url: string; init: RequestInit; body: unknown };

function createFakeFetch(respond: (call: { url: string; body: unknown }) => Response): {
  fetchImpl: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, init: init ?? {}, body });
    return respond({ url, body });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// A tiny 1x1 WebP, base64-encoded, used for deterministic illustration tests.
const WEBP_B64 = "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";

function illustrationJson(): unknown {
  return { data: [{ b64_json: WEBP_B64, media_type: "image/webp" }] };
}

const fullDeps = (fetchImpl: typeof fetch) => ({
  apiKey: "sk-opencode-test",
  imageModel: "qwen/qwen3_image",
  fetchImpl,
});

describe("OpenCode illustration adapter (spec 005, T011b/T011c)", () => {
  it("produces a WebP data-URI from a b64 image response", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(illustrationJson()));
    const illustrate = createOpenCodeIllustration(fullDeps(fetchImpl));
    const result = await illustrate("a soft watercolor fox");
    expect(result.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/images");
    // Effective model (prefix stripped) + OpenCode key are sent.
    expect(calls[0]!.body).toMatchObject({
      model: "qwen/qwen3_image",
      prompt: "a soft watercolor fox",
    });
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(
      "Bearer sk-opencode-test"
    );
  });

  it("uses the OpenCode base URL", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(illustrationJson()));
    const illustrate = createOpenCodeIllustration(fullDeps(fetchImpl));
    await illustrate("prompt");
    expect(calls[0]!.url).toContain("https://opencode.ai/zen/go/v1");
  });

  it("throws a typed ProviderError when the provider is unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ error: "boom" }, 503));
    const illustrate = createOpenCodeIllustration(fullDeps(fetchImpl));
    await expect(illustrate("prompt")).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws a typed ProviderError when no image data is returned", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ data: [] }));
    const illustrate = createOpenCodeIllustration(fullDeps(fetchImpl));
    await expect(illustrate("prompt")).rejects.toBeInstanceOf(ProviderError);
  });
});
