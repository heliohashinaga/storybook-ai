import { describe, expect, it } from "vitest";
import { parseStoryResponse } from "../../src/features/story-reader/client/story-response";
import {
  N_SCENES,
  sceneSchema,
  storyResponseSchema,
} from "../../src/features/story-generation/server/schemas";

const webpDataUri = "data:image/webp;base64,QUJDRA";

function scene(ordinal: number) {
  return {
    ordinal,
    title: `Título ${ordinal}`,
    body: `Texto da cena ${ordinal}.`,
    illustrationDataUri: webpDataUri,
    altText: `Ilustração da cena ${ordinal}.`,
  };
}

function validStory() {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme: "courage",
    safetyDecision: "approved",
    title: "A missão da estrelinha",
    scenes: [scene(1), scene(2), scene(3)],
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("story-response — approved story parsing", () => {
  it("parses a 200 approved story into a validated GeneratedStory", async () => {
    const result = await parseStoryResponse(jsonResponse(validStory(), 200));
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.story.title).toBe("A missão da estrelinha");
    expect(result.story.scenes).toHaveLength(3);
    expect(result.story.safetyDecision).toBe("approved");
  });

  it("surfaces a typed error when a 200 body is not a valid story", async () => {
    const bad = validStory();
    bad.scenes = [scene(1), scene(2)];
    const result = await parseStoryResponse(jsonResponse(bad, 200));
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("generation_unavailable");
    expect(JSON.stringify(result.error)).not.toMatch(/openai|provider/);
  });

  it("surfaces a typed error when the 200 body is not JSON", async () => {
    const result = await parseStoryResponse(new Response("<html>oops</html>", { status: 200 }));
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.retryable).toBe(true);
  });
});

describe("story-response — scene-count extension point", () => {
  it("validates the scene count against a single exported N_SCENES constant", () => {
    expect(N_SCENES).toBe(3);
  });

  it("rejects a story with more than N_SCENES scenes at the schema boundary", () => {
    const tooLong = validStory();
    tooLong.scenes = [scene(1), scene(2), scene(3), scene(4)];
    expect(storyResponseSchema.safeParse(tooLong).success).toBe(false);
  });

  it("rejects a scene whose ordinal is beyond N_SCENES", () => {
    expect(sceneSchema.safeParse(scene(4)).success).toBe(false);
  });
});

describe("story-response — typed error mapping", () => {
  it("passes through a valid server error body", async () => {
    const result = await parseStoryResponse(
      jsonResponse(
        { code: "rate_limited", messageKey: "story.error.tryAgainLater", retryable: true },
        429
      )
    );
    expect(result).toEqual({
      status: "error",
      error: { code: "rate_limited", messageKey: "story.error.tryAgainLater", retryable: true },
    });
  });

  it("never surfaces raw provider content from an error body", async () => {
    const body = {
      code: "invalid_input",
      messageKey: "story.error.invalidInput",
      retryable: false,
    };
    const result = await parseStoryResponse(jsonResponse(body, 400));
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(Object.keys(result.error).sort()).toEqual(["code", "messageKey", "retryable"]);
    expect(JSON.stringify(result.error)).not.toMatch(/openai|status|stack/);
  });

  it("falls back to a status-derived error when the body is invalid or missing", async () => {
    const result = await parseStoryResponse(jsonResponse({ "not-an-error": true }, 504));
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.error.code).toBe("generation_timeout");
    expect(result.error.messageKey).toBe("story.error.generationTimeout");
    expect(result.error.retryable).toBe(true);
  });

  it("falls back per status for 400/422/429 and defaults for unknown statuses", async () => {
    const codes = await Promise.all(
      [400, 422, 429, 599].map((status) => parseStoryResponse(jsonResponse("nope", status)))
    );
    expect(codes.map((r) => (r.status === "error" ? r.error.code : null))).toEqual([
      "invalid_input",
      "unsafe_unrecoverable",
      "rate_limited",
      "generation_unavailable",
    ]);
  });
});
