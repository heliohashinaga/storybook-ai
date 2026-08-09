import { describe, expect, it } from "vitest";
import { runSafetyPipeline } from "../../src/features/story-generation/server/safety-pipeline";
import type {
  ProviderStoryInput,
  StoryGenerationProvider,
} from "../../src/features/story-generation/server/story-generation-provider";
import {
  buildSafeCandidate,
  createFakeProvider,
} from "../fixtures/story-generation/provider-fixtures";
import { safeErrorSchema } from "../../src/features/story-generation/server/schemas";

/** Matches the deterministic marker the fake provider's moderation rejects. */
const UNSAFE = "unsafecontent";

const input: ProviderStoryInput = { ageBand: "5-7", locale: "pt-BR", theme: "courage" };

/** Sequential fake: each generateStory call uses the next builder (last repeats). */
function sequentialFake(
  builders: Array<(i: ProviderStoryInput) => ReturnType<typeof buildSafeCandidate>>
) {
  let calls = 0;
  const requests: ProviderStoryInput[] = [];
  const provider: StoryGenerationProvider = {
    async generateStory(i) {
      const builder = builders[Math.min(calls, builders.length - 1)] ?? buildSafeCandidate;
      calls += 1;
      requests.push({ ageBand: i.ageBand, locale: i.locale, theme: i.theme });
      return builder(i);
    },
    async moderateText(text) {
      return { safe: !text.includes(UNSAFE) };
    },
    async moderateImage(prompt) {
      return { safe: !prompt.includes(UNSAFE) };
    },
  };
  return { provider, count: () => calls, requests };
}

function mutateScene(
  candidate: ReturnType<typeof buildSafeCandidate>,
  index: number,
  patch: (text: {
    ordinal: number;
    title: string;
    body: string;
    illustrationPrompt: string;
  }) => void
): ReturnType<typeof buildSafeCandidate> {
  const scene = candidate.scenes[index];
  if (!scene) throw new Error("expected scene");
  patch(scene);
  return { ...candidate, scenes: [...candidate.scenes] };
}

describe("safety pipeline — safe first attempt", () => {
  it("returns an approved candidate when text and every illustration pass", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await runSafetyPipeline({ provider: fake.provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("approved");
    expect(result.candidate.scenes).toHaveLength(3);
    expect(fake.generateCalls).toBe(1);
  });

  it("records only ageBand/locale/theme (no direct identifier) on the provider", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    await runSafetyPipeline({ provider: fake.provider, input });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(JSON.stringify(fake.requests[0])).not.toMatch(/"name"/i);
  });
});

describe("safety pipeline — unsafe candidate discard and bounded regeneration", () => {
  it("discards an unsafe first text attempt and returns the regenerated safe candidate", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const result = await runSafetyPipeline({ provider: fake.provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("regenerated");
    expect(fake.generateCalls).toBe(2);
    // The unsafe first attempt is never surfaced.
    const body = JSON.stringify(result.candidate);
    expect(body).not.toContain(UNSAFE);
  });

  it("regenerates when a scene illustration prompt is unsafe (text alone is not enough)", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.illustrationPrompt = `${s.illustrationPrompt} ${UNSAFE}`;
        }),
      (i) => buildSafeCandidate(i),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("regenerated");
    expect(count()).toBe(2);
    expect(JSON.stringify(result.candidate)).not.toContain(UNSAFE);
  });

  it("treats a scene as complete only when both its text and its illustration pass", async () => {
    // Scene 0 text unsafe on first attempt but image safe; only a full-safe second
    // attempt (text and image) is accepted.
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.body = `${s.body} ${UNSAFE}`;
        }),
      (i) => buildSafeCandidate(i),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(count()).toBe(2);
    // The accepted candidate contains no unsafe text anywhere.
    expect(JSON.stringify(result.candidate)).not.toContain(UNSAFE);
  });

  it("regenerates exactly once and reports unsafe_unrecoverable when the retry is also unsafe", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await runSafetyPipeline({ provider: fake.provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(fake.generateCalls).toBe(2);
    expect(result.error.code).toBe("unsafe_unrecoverable");
    expect(result.error.retryable).toBe(true);
  });

  it("exposes only the wire-safe generic error body (no provider/unsafe detail)", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await runSafetyPipeline({ provider: fake.provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(safeErrorSchema.safeParse(result.error).success).toBe(true);
    expect(JSON.stringify(result.error)).not.toMatch(/unsafecontent|provider|openai/i);
  });

  it("rejects a structurally incomplete scene set after bounded regeneration", async () => {
    const fake = createFakeProvider({ scenario: "invalid", invalidSceneCount: 2 });
    const result = await runSafetyPipeline({ provider: fake.provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(fake.generateCalls).toBe(2);
    expect(result.error.code).toBe("unsafe_unrecoverable");
  });
});

describe("safety pipeline — template-marker and identifier rejection", () => {
  it("rejects a {name} template marker even when provider moderation passes", async () => {
    // Provider moderation flags only UNSAFE, so the marker must be caught locally.
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.body = `Olá {name}! ${s.body}`;
        }),
      (i) => buildSafeCandidate(i),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("regenerated");
    expect(count()).toBe(2);
    expect(JSON.stringify(result.candidate)).not.toContain("{name}");
  });

  it.each([["{{child}}"], ["[NAME]"], ["nome da criança"]])(
    "rejects an unpersonalized marker or identifier %s and falls back to a safe error when it persists",
    async (marker) => {
      const { provider, count } = sequentialFake([
        (i) =>
          mutateScene(buildSafeCandidate(i), 1, (s) => {
            s.body = `${s.body} ${marker}`;
          }),
      ]);
      const result = await runSafetyPipeline({ provider, input });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("unsafe_unrecoverable");
      expect(count()).toBe(2);
      // The offending marker/identifier never leaks into the error body either.
      expect(JSON.stringify(result.error)).not.toContain(marker);
    }
  );

  it("rejects a template marker in an illustration prompt and regenerates", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.illustrationPrompt = `${s.illustrationPrompt} {{child}}`;
        }),
      (i) => buildSafeCandidate(i),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("regenerated");
    expect(count()).toBe(2);
    expect(JSON.stringify(result.candidate)).not.toContain("{{child}}");
  });
});

describe("safety pipeline — candidate schema validation", () => {
  it("rejects an empty scene body even when its text moderation passes", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.body = "";
        }),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsafe_unrecoverable");
    expect(count()).toBe(2);
  });

  it("rejects an empty illustration prompt even when image moderation passes", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 1, (s) => {
          s.illustrationPrompt = "";
        }),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsafe_unrecoverable");
    expect(count()).toBe(2);
  });

  it("rejects an out-of-range scene ordinal", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 2, (s) => {
          s.ordinal = 0;
        }),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsafe_unrecoverable");
    expect(count()).toBe(2);
  });

  it("regenerates to a structurally valid candidate on a later attempt", async () => {
    const { provider, count } = sequentialFake([
      (i) =>
        mutateScene(buildSafeCandidate(i), 0, (s) => {
          s.body = "";
        }),
      (i) => buildSafeCandidate(i),
    ]);
    const result = await runSafetyPipeline({ provider, input });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.safetyDecision).toBe("regenerated");
    expect(count()).toBe(2);
  });
});
