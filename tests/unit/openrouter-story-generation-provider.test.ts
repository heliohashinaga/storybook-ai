// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
import { ProviderError } from "../../src/features/story-generation/server/story-generation-provider";
import type { OpenRouterDeps } from "../../src/features/story-generation/server/openrouter-story-generation-provider";
import {
  createOpenRouterIllustration,
  createOpenRouterStoryProvider,
} from "../../src/features/story-generation/server/openrouter-story-generation-provider";

/**
 * Deterministic tests for the OpenRouter adapter (T024). No live AI: every
 * call is served by an injected fake transport returning canned responses.
 */

interface FetchCall {
  url: string;
  init?: RequestInit;
  body?: unknown;
}

type Handler = (call: FetchCall) => Response | Promise<Response>;

function createFakeFetch(handler: Handler) {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: FetchCall = { url, init, body };
    calls.push(call);
    return handler(call);
  };
  return { fetchImpl, calls };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chatCompletion(content: string): Response {
  return jsonResponse({ choices: [{ message: { content } }] });
}

const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x00, 0x00, 0x00, 0x00,
]);
const WEBP_B64 = Buffer.from(WEBP_BYTES).toString("base64");

const deps: OpenRouterDeps = {
  apiKey: "sk-test",
  textModel: "test/text-model",
  imageModel: "test/image-model",
  moderationModel: "test/moderation-model",
  baseUrl: "https://openrouter.test/api/v1",
};

const storyInput = { ageBand: "5-7" as const, locale: "pt-BR" as const, theme: "courage" as const };

function validCandidateJson(): string {
  return JSON.stringify({
    title: "A Coragem do Passarinho",
    scenes: [1, 2, 3].map((ordinal) => ({
      ordinal,
      title: `Cena ${ordinal}`,
      body: `O passarinho voou pela manhã (cena ${ordinal}).`,
      illustrationPrompt: `Soft watercolor: a small bird flying over a sunny field (scene ${ordinal}).`,
    })),
  });
}

function headerOf(call: FetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createOpenRouterStoryProvider", () => {
  it("generateStory returns a validated candidate and sends only anonymous input", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => chatCompletion(validCandidateJson()));
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    const candidate = await provider.generateStory(storyInput);

    expect(candidate.title).toBe("A Coragem do Passarinho");
    expect(candidate.scenes).toHaveLength(3);
    expect(candidate.scenes[0]).toMatchObject({ ordinal: 1, title: "Cena 1" });

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat).toBeDefined();
    expect(headerOf(chat!, "authorization")).toBe("Bearer sk-test");
    // The SDK request uses the env/injected text model identifier.
    expect(chat!.body).toMatchObject({ model: "test/text-model" });

    // Privacy invariant: the provider-bound payload carries only the
    // ageBand/locale/theme inputs, never a name or exact child details.
    const userMessage = (chat!.body as { messages: { content: string }[] }).messages[1]!.content;
    const sent = JSON.parse(userMessage) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toContain("ageBand");
    expect(sent.ageBand).toBe("5-7");
    expect(sent.locale).toBe("pt-BR");
    expect(sent.theme).toBe("courage");
    expect(Object.keys(sent as object)).not.toContain("name");
    expect(Object.keys(sent as object)).not.toContain("childName");
  });

  it("generateStory maps malformed JSON content to invalid_structured_output", async () => {
    const { fetchImpl } = createFakeFetch(() => chatCompletion("not json at all"));
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      name: "ProviderError",
      kind: "invalid_structured_output",
    });
  });

  it("generateStory maps schema-invalid candidates to invalid_structured_output", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      chatCompletion(JSON.stringify({ title: "X", scenes: [] }))
    );
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "invalid_structured_output",
    });
  });

  it("generateStory maps a provider 5xx to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ error: { message: "overloaded" } }, 500)
    );
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl, maxRetries: 0 });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("generateStory maps a network failure to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl, maxRetries: 0 });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("generateStory maps a request timeout to timeout", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    const provider = createOpenRouterStoryProvider({
      ...deps,
      fetchImpl,
      timeoutMs: 25,
      maxRetries: 0,
    });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("moderateText reports safe content", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      chatCompletion(JSON.stringify({ safe: true, reason: null }))
    );
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.moderateText("O passarinho voou.")).resolves.toEqual({ safe: true });
  });

  it("moderateImage flags an unsafe illustration and keeps the reason", async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      chatCompletion(JSON.stringify({ safe: false, reason: "violence" }))
    );
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.moderateImage("a fight scene with weapons")).resolves.toEqual({
      safe: false,
      reason: "violence",
    });

    // The moderated prompt is forwarded to the moderation model directly.
    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat!.body).toMatchObject({ model: "test/moderation-model" });
  });

  it("moderateText maps an invalid classifier answer to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => chatCompletion("oops"));
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.moderateText("conteúdo")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("reads model identifiers only from the server environment", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-env");
    vi.stubEnv("OPENROUTER_TEXT_MODEL", "env/text-model");
    vi.stubEnv("OPENROUTER_IMAGE_MODEL", "env/image-model");
    vi.stubEnv("OPENROUTER_MODERATION_MODEL", "env/moderation-model");

    const { fetchImpl, calls } = createFakeFetch(() => chatCompletion(validCandidateJson()));

    const provider = createOpenRouterStoryProvider({ fetchImpl });
    await provider.generateStory(storyInput);

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat!.body).toMatchObject({ model: "env/text-model" });
    expect(headerOf(chat!, "authorization")).toBe("Bearer sk-env");
  });

  it("generateStory maps an empty completion to invalid_structured_output", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ choices: [] }));
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "invalid_structured_output",
    });
  });

  it("moderateText maps an out-of-schema classifier answer to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => chatCompletion(JSON.stringify({ safe: "yes" })));
    const provider = createOpenRouterStoryProvider({ ...deps, fetchImpl });

    await expect(provider.moderateText("conteúdo")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});

describe("createOpenRouterIllustration", () => {
  it("returns a WebP data URI from inline base64", async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse({ data: [{ b64_json: WEBP_B64, media_type: "image/webp" }] })
    );
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("soft watercolor bird")).resolves.toMatchObject({
      dataUri: `data:image/webp;base64,${WEBP_B64}`,
    });

    const image = calls.find((c) => c.url.endsWith("/images"));
    expect(image).toBeDefined();
    expect(image!.body).toMatchObject({
      model: "test/image-model",
      output_format: "webp",
      aspect_ratio: "1:1",
    });
    expect(headerOf(image!, "authorization")).toBe("Bearer sk-test");
  });

  it("fetches and wraps an image URL response", async () => {
    const { fetchImpl } = createFakeFetch((call) => {
      if (call.url.endsWith("/images")) {
        return jsonResponse({ data: [{ url: "https://cdn.test/i.webp" }] });
      }
      return new Response(WEBP_BYTES, {
        headers: { "content-type": "image/webp" },
      });
    });
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("cena 2")).resolves.toMatchObject({
      dataUri: `data:image/webp;base64,${WEBP_B64}`,
    });
  });

  it("maps an empty image payload to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ data: [] }));
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("x")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a provider 5xx to unavailable", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ error: "x" }, 503));
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("x")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a timeout to a ProviderError of kind timeout", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl, timeoutMs: 25 });

    const result = await illustrate("x").then(
      () => null,
      (error: unknown) => error
    );
    expect(result).toBeInstanceOf(ProviderError);
    expect((result as ProviderError).kind).toBe("timeout");
  });

  it("transcodes non-WebP bytes through the injected encoder", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const encoder = vi.fn(async (raw: Buffer) => {
      expect(raw).toEqual(Buffer.from(pngBytes));
      return Buffer.from("ENCODEDWEBP");
    });
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ data: [{ b64_json: Buffer.from(pngBytes).toString("base64") }] })
    );
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl, imageEncoder: encoder });

    await expect(illustrate("prompt")).resolves.toMatchObject({
      dataUri: "data:image/webp;base64," + Buffer.from("ENCODEDWEBP").toString("base64"),
    });
    expect(encoder).toHaveBeenCalledTimes(1);
  });

  it("accepts WebP bytes even without a media type", async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ data: [{ b64_json: WEBP_B64 }] }));
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("prompt")).resolves.toMatchObject({
      dataUri: `data:image/webp;base64,${WEBP_B64}`,
    });
  });

  it("maps a failed image URL fetch to unavailable", async () => {
    const { fetchImpl } = createFakeFetch((call) =>
      call.url.endsWith("/images")
        ? jsonResponse({ data: [{ url: "https://cdn.test/i.webp" }] })
        : new Response("not found", { status: 404 })
    );
    const illustrate = createOpenRouterIllustration({ ...deps, fetchImpl });

    await expect(illustrate("prompt")).rejects.toMatchObject({ kind: "unavailable" });
  });
});
