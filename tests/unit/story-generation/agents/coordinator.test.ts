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

function seams(overrides: Partial<PipelineSeams> = {}): PipelineSeams {
  const fake = createFakeProvider({ scenario: "safe" });
  return {
    provider: fake.provider,
    illustrate: vi.fn(async () => ({ dataUri: WEBP })),
    imageRetries: 1,
    illustrationConcurrency: 2,
    maxIllustrationDataUriLength: 4 * 1024 * 1024,
    ...overrides,
  };
}

describe("coordinator pipeline", () => {
  it("assembles a validated GeneratedStory for a safe request", async () => {
    const result = await generateStoryPipeline({ ctx: ctx(), seams: seams() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sceneCount).toBe(3);
      expect(result.value.scenes).toHaveLength(3);
      expect(result.value.safetyDecision).toBe("approved");
      for (const scene of result.value.scenes) {
        expect(scene.illustrationDataUri.startsWith("data:image/webp;base64,")).toBe(true);
        expect(scene.altText.length).toBeGreaterThan(0);
      }
    }
  });

  it("reflects a regeneration when the first narrative was unsafe", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: { provider: fake.provider, illustrate: vi.fn(async () => ({ dataUri: WEBP })) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.safetyDecision).toBe("regenerated");
  });

  it("returns a transient generation_unavailable error for an unavailable provider", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: { provider: fake.provider, illustrate: vi.fn(async () => ({ dataUri: WEBP })) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("generation_unavailable");
      expect(result.transient).toBe(true);
    }
  });

  it("returns an unsafe_unrecoverable error when the narrative is never safe", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: { provider: fake.provider, illustrate: vi.fn(async () => ({ dataUri: WEBP })) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("unsafe_unrecoverable");
      expect(result.transient).toBe(false);
    }
  });

  it("returns an error when the illustration set stays incomplete", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStoryPipeline({
      ctx: ctx(),
      seams: {
        provider: fake.provider,
        illustrate: vi.fn(async () => {
          throw new Error("image down");
        }),
        imageRetries: 1,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe("illustrate");
  });

  it("createGenerationToken is opaque and non-empty", () => {
    const token = createGenerationToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    // No identifier content can be present (hex token).
    expect(token).toMatch(/^[0-9a-f]+$/);
  });
});
