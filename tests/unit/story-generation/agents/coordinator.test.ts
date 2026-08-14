import { describe, expect, it, vi } from "vitest";
import {
  generateStoryPipeline,
  createGenerationToken,
  type PipelineSeams,
} from "../../../../src/features/story-generation/server/agents/coordinator";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

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
});
