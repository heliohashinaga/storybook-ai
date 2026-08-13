// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createOpenCodeStoryProvider } from "../../src/features/story-generation/server/opencode-story-generation-provider";
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

/** A minimal OpenAI-style chat completion payload. */
function chatCompletion(content: string): unknown {
  return {
    choices: [{ message: { content }, finish_reason: "stop", index: 0 }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const jsonContent = (value: unknown) => () => jsonResponse(chatCompletion(JSON.stringify(value)));

describe("OpenCode story-generation provider (spec 005, T008/T010)", () => {
  it("generates a story candidate via chat completions", async () => {
    const { fetchImpl, calls } = createFakeFetch(
      jsonContent({
        title: "The Little Cloud",
        scenes: [
          {
            ordinal: 1,
            title: "A Big Sky",
            body: "A cloud drifts above.",
            illustrationPrompt: "soft watercolor sky",
          },
        ],
      })
    );
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    const candidate = await provider.generateStory({
      ageBand: "2-4",
      locale: "pt-BR",
      theme: "friendship",
      sceneCount: 1,
    });
    expect(candidate.title).toBe("The Little Cloud");
    expect(candidate.scenes[0]!.ordinal).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/chat/completions");
    // The provider sends the effective (prefix-free) model + the OpenCode key.
    expect(calls[0]!.body).toMatchObject({ model: "qwen/qwen3.7-flash" });
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe(
      "Bearer sk-opencode-test"
    );
  });

  it("mixes the OpenCode base URL into every request", async () => {
    const { fetchImpl, calls } = createFakeFetch(jsonContent({ safe: true, reason: null }));
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    await provider.moderateText("a benign sentence");
    expect(calls[0]!.url).toContain("https://opencode.ai/zen/go/v1");
  });

  it("moderates text to a safe decision", async () => {
    const { fetchImpl, calls } = createFakeFetch(jsonContent({ safe: true, reason: null }));
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    const decision = await provider.moderateText("a very kind story");
    expect(decision.safe).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("moderates flagged content to an unsafe decision with a reason", async () => {
    const { fetchImpl } = createFakeFetch(jsonContent({ safe: false, reason: "violence" }));
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    const decision = await provider.moderateImage("illustration prompt");
    expect(decision.safe).toBe(false);
    expect(decision.reason).toBe("violence");
  });

  it("throws a typed ProviderError on a malformed story response", async () => {
    const { fetchImpl } = createFakeFetch(jsonContent({ not: "a story" }));
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    await expect(
      provider.generateStory({ ageBand: "5-7", locale: "en", theme: "courage", sceneCount: 1 })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws a typed ProviderError on a non-2xx provider response", async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ error: { message: "quota exceeded" } }, 429)
    );
    const provider = createOpenCodeStoryProvider({
      apiKey: "sk-opencode-test",
      textModel: "qwen/qwen3.7-flash",
      moderationModel: "qwen/qwen3.7-flash",
      fetchImpl,
    });
    await expect(
      provider.generateStory({ ageBand: "8-9", locale: "pt-BR", theme: "kindness", sceneCount: 2 })
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
