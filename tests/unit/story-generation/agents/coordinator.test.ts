import { describe, expect, it, vi } from "vitest";
import {
  generateStoryPipeline,
  createGenerationToken,
  defaultPipelineTimeoutMs,
  type PipelineSeams,
} from "../../../../src/features/story-generation/server/agents/coordinator";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import type { StoryGenerationProvider } from "../../../../src/features/story-generation/server/story-generation-provider";
import {
  createFakeProvider,
  STYLE_DESCRIPTOR,
} from "../../../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

function ctx(overrides: Partial<JobContext> = {}): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "friendship",
    sceneCountRequested: 3,
    generationToken: "token",
    ...overrides,
  };
}

function mkSeams(overrides: Partial<PipelineSeams> = {}): PipelineSeams {
  const p = createFakeProvider({ scenario: "safe" });
  return {
    plannerProvider: p.provider,
    writerProvider: p.provider,
    moderatorProvider: p.provider,
    illustrate: vi.fn(async () => ({ dataUri: WEBP })),
    imageRetries: 1,
    illustrationConcurrency: 2,
    maxIllustrationDataUriLength: 4 * 1024 * 1024,
    ...overrides,
  };
}

describe("coordinator pipeline", () => {
  it("assembles a validated GeneratedStory for a safe request", async () => {
    const result = await generateStoryPipeline({ ctx: ctx(), seams: mkSeams() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sceneCount).toBe(3);
      expect(result.value.scenes).toHaveLength(3);
      expect(["approved", "regenerated"]).toContain(result.value.safetyDecision);
    }
  });

  it("reflects a regeneration when the writer produces unsafe content", async () => {
    const safeFake = createFakeProvider({ scenario: "safe" });
    const unsafeFake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({
        plannerProvider: safeFake.provider,
        writerProvider: unsafeFake.provider,
        moderatorProvider: safeFake.provider,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.safetyDecision).toBe("regenerated");
  });

  it("returns transient error when the planner provider fails", async () => {
    const failing = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({ plannerProvider: failing.provider }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(true);
      expect(result.stage).toBe("plan");
    }
  });

  it("returns error when the illustration set stays incomplete", async () => {
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({
        illustrate: vi.fn(async () => {
          throw new Error("image down");
        }),
        imageRetries: 1,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe("illustrate");
  });

  it("createGenerationToken is opaque and non-empty", () => {
    const token = createGenerationToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("defaultPipelineTimeoutMs falls back to 120s when unset or invalid", () => {
    delete process.env.PIPELINE_TIMEOUT_MS;
    expect(defaultPipelineTimeoutMs()).toBe(120_000);
    process.env.PIPELINE_TIMEOUT_MS = "not-a-number";
    expect(defaultPipelineTimeoutMs()).toBe(120_000);
    process.env.PIPELINE_TIMEOUT_MS = "500"; // below the 1000ms floor
    expect(defaultPipelineTimeoutMs()).toBe(120_000);
  });

  it("defaultPipelineTimeoutMs reads a valid env override", () => {
    process.env.PIPELINE_TIMEOUT_MS = "90000";
    expect(defaultPipelineTimeoutMs()).toBe(90_000);
    delete process.env.PIPELINE_TIMEOUT_MS;
  });

  it("propagates the writer stage failure with its transient flag", async () => {
    const writer = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({ writerProvider: writer.provider }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("write");
      expect(result.transient).toBe(true);
    }
  });

  it("propagates the moderator stage failure with its transient flag", async () => {
    // Written leaks a template marker → attempt 0 rejected → regeneration calls
    // moderatorProvider.generateStory, which throws (unavailable).
    const leakyWriter = createFakeProvider({ scenario: "template-marker-leak" });
    const moderator = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({
        plannerProvider: createFakeProvider({ scenario: "safe" }).provider,
        writerProvider: leakyWriter.provider,
        moderatorProvider: moderator.provider,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("moderate");
      expect(result.transient).toBe(true);
    }
  });

  it("rejects a regenerated story whose scene count drifted from the request", async () => {
    // Writer leaks a template marker ({name}) → moderator regenerates via its
    // own provider, which returns a 4-scene candidate (request was 3). The ≥3
    // guard passes but the assemble-time count check rejects it.
    const leakyWriter = createFakeProvider({ scenario: "template-marker-leak" });
    const wide: StoryGenerationProvider = {
      generateStory: async () => ({
        title: "Quatro cenas",
        scenes: [1, 2, 3, 4].map((ordinal) => ({
          ordinal,
          title: `Título ${ordinal}`,
          body: `Corpo da cena ${ordinal}.`,
          illustrationPrompt: `${STYLE_DESCRIPTOR}, cena ${ordinal}`,
        })),
      }),
      moderateText: async () => ({ safe: true }),
      moderateImage: async () => ({ safe: true }),
    };
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({ writerProvider: leakyWriter.provider, moderatorProvider: wide }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("assemble");
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("unsafe_unrecoverable");
    }
  });

  it("rejects assembly when a scene body violates the response schema bound", async () => {
    // A 2000-char body clears the moderator (non-empty) but fails the 1600-char
    // schema cap during assembly.
    const longBody: StoryGenerationProvider = {
      generateStory: async () => ({
        title: "História longa",
        scenes: [1, 2, 3].map((ordinal) => ({
          ordinal,
          title: `Título ${ordinal}`,
          body: "x".repeat(2000),
          illustrationPrompt: `${STYLE_DESCRIPTOR}, cena ${ordinal}`,
        })),
      }),
      moderateText: async () => ({ safe: true }),
      moderateImage: async () => ({ safe: true }),
    };
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: mkSeams({ plannerProvider: longBody, writerProvider: longBody }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("assemble");
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("generation_unavailable");
    }
  });
});
