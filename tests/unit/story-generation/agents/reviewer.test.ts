import { describe, expect, it } from "vitest";
import { reviewStory } from "../../../../src/features/story-generation/server/agents/reviewer";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

function ctx(): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "token",
  };
}

describe("reviewer agent", () => {
  it("approves a safe narrative in one generate call", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await reviewStory(ctx(), { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.safetyDecision).toBe("approved");
      expect(result.value.scenes).toHaveLength(3);
    }
    expect(fake.generateCalls).toBe(1);
  });

  it("regenerates once when the first narrative is unsafe, then approves", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const result = await reviewStory(ctx(), { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.safetyDecision).toBe("regenerated");
    }
    expect(fake.generateCalls).toBe(2);
  });

  it("returns an Err for an unavailable provider (transient, generation_unavailable)", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const result = await reviewStory(ctx(), { provider: fake.provider });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("review");
      expect(result.transient).toBe(true);
      expect(result.errorCode).toBe("generation_unavailable");
    }
  });

  it("returns a transient timeout error code for a timeout provider", async () => {
    const fake = createFakeProvider({ scenario: "timeout" });
    const result = await reviewStory(ctx(), { provider: fake.provider });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("generation_timeout");
      expect(result.transient).toBe(true);
    }
  });

  it("returns a permanent unsafe_unrecoverable error when never safe", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await reviewStory(ctx(), { provider: fake.provider });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("unsafe_unrecoverable");
    }
  });
});
