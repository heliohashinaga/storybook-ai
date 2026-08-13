import { describe, expect, it } from "vitest";
import {
  createIllustratorFake,
  createPlannerFake,
  createReaderFake,
  createReviewerFake,
  createWriterFake,
} from "../../../fixtures/story-generation/agents";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import { buildSafeCandidate } from "../../../fixtures/story-generation/provider-fixtures";
import type { ModeratedStoryCandidate } from "../../../../src/features/story-generation/server/safety-pipeline";

const ctx: JobContext = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCountRequested: 3,
  generationToken: "0123456789abcdef",
};

function approved(): ModeratedStoryCandidate {
  const base = buildSafeCandidate({
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCount: 3,
  });
  return { ...base, safetyDecision: "approved" as const };
}

describe("agent pipeline fakes (T004)", () => {
  it("planner fake plans the requested scene count and records calls", async () => {
    const fake = createPlannerFake();
    const result = await fake.plan(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.scenes).toHaveLength(3);
    expect(fake.calls).toBe(1);
  });

  it("planner fake can be configured to fail", async () => {
    const fake = createPlannerFake({ fail: true });
    const result = await fake.plan(ctx);
    expect(result.ok).toBe(false);
    expect(fake.calls).toBe(1);
  });

  it("writer fake mirrors the approved candidate", async () => {
    const fake = createWriterFake();
    const result = await fake.write(ctx, approved());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title.length).toBeGreaterThan(0);
      expect(result.value.scenes).toHaveLength(3);
    }
  });

  it("reviewer fake approves safe input", async () => {
    const fake = createReviewerFake(ctx);
    const result = await fake.review();
    expect(result.ok).toBe(true);
    expect(fake.calls).toBe(1);
  });

  it("reviewer fake surfaces unsafe and unavailable modes", async () => {
    expect((await createReviewerFake(ctx, { mode: "unsafe" }).review()).ok).toBe(false);
    expect((await createReviewerFake(ctx, { mode: "unavailable" }).review()).ok).toBe(false);
  });

  it("illustrator fake emits one WebP per scene", async () => {
    const fake = createIllustratorFake();
    const result = await fake.illustrate(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.scenes).toHaveLength(3);
  });

  it("reader fake accepts text and rejects empty", async () => {
    const fake = createReaderFake();
    expect((await fake.read("Uma história.")).ok).toBe(true);
    expect((await fake.read("  ")).ok).toBe(false);
    expect(fake.calls).toBe(2);
  });
});
