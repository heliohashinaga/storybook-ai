// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { TtsProviderError } from "../../src/features/story-read-aloud/server/tts-provider";
import { createOpenRouterTtsProvider } from "../../src/features/story-read-aloud/server/openrouter-tts-provider";
import { fakeSynthesize, fakeNarrateRequest } from "./tts/fake";

/**
 * Deterministic provider tests (spec 004, T007/T008). No live TTS: the
 * OpenRouter adapter is driven through an injected fake transport returning
 * canned responses, mirroring the story-generation provider tests.
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

/** A valid OpenRouter audio completion envelope (MP3 base64 inside). */
function audioCompletion(base64Audio: string): Response {
  return jsonResponse({ choices: [{ message: { audio: { data: base64Audio } } }] });
}

const SCENE_TEXT = "Era uma vez uma estrelinha no céu.";
const BASE64_AUDIO = Buffer.from("fake-mp3-tone").toString("base64");
const AUDIO_BYTES = Uint8Array.from(Buffer.from(BASE64_AUDIO, "base64"));

const deps = {
  apiKey: "sk-test",
  model: "test/tts-model",
  baseUrl: "https://openrouter.test/api/v1",
  maxRetries: 0,
};

function headerOf(call: FetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

describe("TtsProvider fake fixtures (T007)", () => {
  it("fakeSynthesize returns a deterministic MP3 result", () => {
    const first = fakeSynthesize(SCENE_TEXT);
    const second = fakeSynthesize("qualquer outro texto");
    expect(first.format).toBe("audio/mpeg");
    expect(first.audio).toBeInstanceOf(Uint8Array);
    // Deterministic: the same bytes regardless of the input text.
    expect(second.audio).toEqual(first.audio);
  });

  it("fakeNarrateRequest carries only the anonymous sceneText + locale", () => {
    const request = fakeNarrateRequest();
    expect(request.sceneText).toBeTypeOf("string");
    expect(request.locale).toBe("pt-BR");
    expect(Object.keys(request).sort()).toEqual(["locale", "sceneText"]);
  });
});

describe("createOpenRouterTtsProvider (T008)", () => {
  it("synthesize returns MP3 bytes and sends only the anonymous scene text", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => audioCompletion(BASE64_AUDIO));
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    const result = await provider.synthesize(SCENE_TEXT, { locale: "pt-BR" });

    expect(result.format).toBe("audio/mpeg");
    expect(result.audio).toEqual(AUDIO_BYTES);

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat).toBeDefined();
    expect(chat!.body).toMatchObject({ model: "test/tts-model" });
    expect(headerOf(chat!, "authorization")).toBe("Bearer sk-test");

    // Privacy invariant: the provider payload carries only the anonymous scene
    // text in the user message — never a name or identifier.
    const userMessage = (chat!.body as { messages: { role: string; content: string }[] })
      .messages[0]!;
    expect(userMessage.content).toBe(SCENE_TEXT);
    expect(JSON.stringify(chat!.body)).not.toContain("name");
    expect(JSON.stringify(chat!.body)).not.toContain("childName");
  });

  it("uses the en voice profile for the en locale", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => audioCompletion(BASE64_AUDIO));
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    await provider.synthesize("Once upon a time.", { locale: "en" });

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat!.body).toMatchObject({ audio: { voice: "verse", format: "mp3" } });
    expect((chat!.body as { modalities?: string[] }).modalities).toContain("audio");
  });

  it("rejects with a typed invalid error when the response has no audio", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ choices: [{ message: { content: "nothing to hear" } }] })
    );
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    await expect(provider.synthesize(SCENE_TEXT, { locale: "pt-BR" })).rejects.toMatchObject({
      name: "TtsProviderError",
      kind: "invalid",
    });
  });

  it("rejects with a typed invalid error when the response is not JSON-shaped audio", async () => {
    const { fetchImpl } = createFakeFetch(
      () =>
        new Response("<html>not audio</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
    );
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    const error = await provider.synthesize(SCENE_TEXT, { locale: "pt-BR" }).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(TtsProviderError);
    expect((error as TtsProviderError).kind).toBe("invalid");
  });

  it("rejects with a typed unavailable error on a network failure", async () => {
    const { fetchImpl } = createFakeFetch(() => {
      throw new Error("ECONNREFUSED");
    });
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    const error = await provider.synthesize(SCENE_TEXT, { locale: "pt-BR" }).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(TtsProviderError);
    expect((error as TtsProviderError).kind).toBe("unavailable");
  });

  it("rejects with a typed unavailable error on a provider 5xx", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ error: { message: "overloaded" } }, 503)
    );
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl });

    await expect(provider.synthesize(SCENE_TEXT, { locale: "pt-BR" })).rejects.toMatchObject({
      name: "TtsProviderError",
      kind: "unavailable",
    });
  });

  it("maps a request timeout to a typed timeout error", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      });
    const provider = createOpenRouterTtsProvider({ ...deps, fetchImpl, timeoutMs: 25 });

    const error = await provider.synthesize(SCENE_TEXT, { locale: "pt-BR" }).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(TtsProviderError);
    expect((error as TtsProviderError).kind).toBe("timeout");
  });
});

describe("createOpenRouterTtsProvider — env-based model (T018 seam)", () => {
  it("uses the env READER_MODEL when no model is injected", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-env");
    vi.stubEnv("OPENCODE_GO_API_KEY", "sk-opencode-env");
    vi.stubEnv("PLANNER_MODEL", "opencode-go/env/text-model");
    vi.stubEnv("WRITER_MODEL", "opencode-go/env/text-model");
    vi.stubEnv("MODERATOR_MODEL", "openrouter/env/moderation-model");
    vi.stubEnv("ILLUSTRATOR_MODEL", "openrouter/env/image-model");
    vi.stubEnv("READER_MODEL", "openrouter/env/reader-model");
    vi.stubEnv("AI_NARRATION_ENABLED", "true");

    const { fetchImpl, calls } = createFakeFetch(() => audioCompletion(BASE64_AUDIO));
    const provider = createOpenRouterTtsProvider({ fetchImpl, maxRetries: 0 });

    const result = await provider.synthesize(SCENE_TEXT, { locale: "pt-BR" });
    expect(result.format).toBe("audio/mpeg");

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat!.body).toMatchObject({ model: "openrouter/env/reader-model" });
    expect(headerOf(chat!, "authorization")).toBe("Bearer sk-env");

    vi.unstubAllEnvs();
  });
});
