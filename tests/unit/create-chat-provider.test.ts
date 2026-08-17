// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import {
  createChatCompletionsProvider,
  type ChatCompletionsProviderDeps,
} from "../../src/features/story-generation/server/provider-core";

/**
 * Deterministic unit tests for the shared chat-completions orchestration
 * factory (spec 013, T012). These prove the factory reproduces the adapter
 * behavior byte-for-byte (parity with `tests/unit/openrouter-*` /
 * `opencode-*` fixtures), so the adapters can be made thin without changing
 * expectations (SC-003).
 *
 * No live AI: a fake OpenAI client (injected `fetch`) returns canned
 * responses, mirroring the adapter fixtures.
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

function headerOf(call: FetchCall, name: string): string | null {
  return new Headers(call.init?.headers).get(name);
}

const textModel = "test/text-model";
const moderationModel = "test/moderation-model";

/** Builds a lazy-getter factory over an OpenAI client bound to a fake transport. */
function makeFactory(handler: Handler): {
  provider: ReturnType<typeof createChatCompletionsProvider>;
  calls: FetchCall[];
} {
  const { fetchImpl, calls } = createFakeFetch(handler);
  const client = new OpenAI({
    apiKey: "sk-test",
    baseURL: "https://provider.test/v1",
    fetch: fetchImpl,
    maxRetries: 0,
  });
  const deps: ChatCompletionsProviderDeps = {
    getClient: () => client,
    textModel,
    moderationModel,
  };
  return { provider: createChatCompletionsProvider(deps), calls };
}

const storyInput = {
  ageBand: "5-7" as const,
  locale: "pt-BR" as const,
  theme: "courage" as const,
  sceneCount: 3,
};

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

describe("createChatCompletionsProvider", () => {
  it("generateStory returns a validated candidate and sends only anonymous input", async () => {
    const { provider, calls } = makeFactory(() => chatCompletion(validCandidateJson()));

    const candidate = await provider.generateStory(storyInput);

    expect(candidate.title).toBe("A Coragem do Passarinho");
    expect(candidate.scenes).toHaveLength(3);
    expect(candidate.scenes[0]).toMatchObject({ ordinal: 1, title: "Cena 1" });

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat).toBeDefined();
    expect(headerOf(chat!, "authorization")).toBe("Bearer sk-test");
    expect(chat!.body).toMatchObject({ model: textModel });

    // Privacy invariant: the payload carries only ageBand/locale/theme.
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
    const { provider } = makeFactory(() => chatCompletion("not json at all"));

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      name: "ProviderError",
      kind: "invalid_structured_output",
    });
  });

  it("generateStory maps schema-invalid candidates to invalid_structured_output", async () => {
    const { provider } = makeFactory(() =>
      chatCompletion(JSON.stringify({ title: "X", scenes: [] }))
    );

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "invalid_structured_output",
    });
  });

  it("generateStory maps a provider 5xx to unavailable", async () => {
    const { provider } = makeFactory(() =>
      jsonResponse({ error: { message: "overloaded" } }, 500)
    );

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("generateStory maps a network failure to unavailable", async () => {
    const { provider } = makeFactory(() => {
      throw new Error("ECONNREFUSED");
    });

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
    const client = new OpenAI({
      apiKey: "sk-test",
      baseURL: "https://provider.test/v1",
      fetch: fetchImpl,
      timeout: 25,
      maxRetries: 0,
    });
    const provider = createChatCompletionsProvider({
      getClient: () => client,
      textModel,
      moderationModel,
    });

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("generateStory maps an empty completion to invalid_structured_output", async () => {
    const { provider } = makeFactory(() => jsonResponse({ choices: [] }));

    await expect(provider.generateStory(storyInput)).rejects.toMatchObject({
      kind: "invalid_structured_output",
    });
  });

  it("moderateText reports safe content", async () => {
    const { provider } = makeFactory(() =>
      chatCompletion(JSON.stringify({ safe: true, reason: null }))
    );

    await expect(provider.moderateText("O passarinho voou.")).resolves.toEqual({ safe: true });
  });

  it("moderateImage flags an unsafe illustration and keeps the reason", async () => {
    const { provider, calls } = makeFactory(() =>
      chatCompletion(JSON.stringify({ safe: false, reason: "violence" }))
    );

    await expect(provider.moderateImage("a fight scene with weapons")).resolves.toEqual({
      safe: false,
      reason: "violence",
    });

    const chat = calls.find((c) => c.url.endsWith("/chat/completions"));
    expect(chat!.body).toMatchObject({ model: moderationModel });
  });

  it("moderateText maps an invalid classifier answer to unavailable", async () => {
    const { provider } = makeFactory(() => chatCompletion("oops"));

    await expect(provider.moderateText("conteúdo")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("moderateText maps an out-of-schema classifier answer to unavailable", async () => {
    const { provider } = makeFactory(() => chatCompletion(JSON.stringify({ safe: "yes" })));

    await expect(provider.moderateText("conteúdo")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("invokes the getClient getter lazily (only on first operation)", async () => {
    const { fetchImpl } = createFakeFetch(() => chatCompletion(validCandidateJson()));
    const client = new OpenAI({
      apiKey: "sk-test",
      baseURL: "https://provider.test/v1",
      fetch: fetchImpl,
      maxRetries: 0,
    });
    const getClient = vi.fn(() => client);
    const provider = createChatCompletionsProvider({
      getClient,
      textModel,
      moderationModel,
    });

    // No operation yet → getter not invoked.
    expect(getClient).not.toHaveBeenCalled();

    await provider.generateStory(storyInput);
    expect(getClient).toHaveBeenCalledTimes(1);
  });
});
