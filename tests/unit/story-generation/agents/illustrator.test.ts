import { describe, expect, it, vi } from "vitest";
import {
  altTextFor,
  illustrateStory,
} from "../../../../src/features/story-generation/server/agents/illustrator";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import type { ModeratedStoryCandidate } from "../../../../src/features/story-generation/server/safety-pipeline";
import { buildSafeCandidate } from "../../../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

function ctx(overrides: Partial<JobContext> = {}): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "kindness",
    sceneCountRequested: 3,
    generationToken: "token",
    ...overrides,
  };
}

function approved(sceneCount: number): ModeratedStoryCandidate {
  const base = buildSafeCandidate({
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "kindness",
    sceneCount,
  });
  return { ...base, safetyDecision: "approved" };
}

describe("illustrator agent", () => {
  it("illustrates every approved scene with the correct data-URI", async () => {
    const illustrate = vi.fn(async () => ({ dataUri: WEBP }));
    const result = await illustrateStory(ctx(), approved(3), { illustrate });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(3);
      for (const scene of result.value.scenes) {
        expect(scene.illustrationDataUri).toEqual(WEBP);
        expect(scene.ordinal).toBeGreaterThan(0);
        expect(scene.body.length).toBeGreaterThan(0);
      }
    }
    expect(illustrate).toHaveBeenCalledTimes(3);
  });

  it("respects limited concurrency for the illustration set", async () => {
    let inFlight = 0;
    let peak = 0;
    const illustrate = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { dataUri: WEBP };
    };
    const result = await illustrateStory(ctx(), approved(3), {
      illustrate,
      illustrationConcurrency: 1,
    });
    expect(result.ok).toBe(true);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("returns an Err (transient) when the whole set stays incomplete", async () => {
    const illustrate = vi.fn(async () => {
      throw new Error("image provider down");
    });
    const result = await illustrateStory(ctx(), approved(3), {
      illustrate,
      imageRetries: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("illustrate");
      expect(result.transient).toBe(true);
    }
  });

  it("rejects an oversized/invalid data-URI for the whole set", async () => {
    const illustrate = vi.fn(async () => ({ dataUri: "not-a-data-uri" }));
    const result = await illustrateStory(ctx(), approved(3), { illustrate, imageRetries: 1 });
    expect(result.ok).toBe(false);
  });

  it("altTextFor is localized and identifier-free", () => {
    expect(altTextFor("pt-BR", "courage", 1)).toEqual(
      "Ilustração da cena 1 de uma história sobre coragem."
    );
    expect(altTextFor("en", "friendship", 2)).toEqual("Scene 2 of a story about friendship.");
    expect(altTextFor("pt-BR", "kindness", 1)).toContain("bondade");
  });
});
