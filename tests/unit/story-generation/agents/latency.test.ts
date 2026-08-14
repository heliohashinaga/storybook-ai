import { describe, expect, it } from "vitest";
import { generateStoryPipeline } from "../../../../src/features/story-generation/server/agents/coordinator";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

describe("pipeline latency & budget (T036)", () => {
  const ctx: JobContext = {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "0123456789abcdef",
  };

  it("completes well within the default 120s budget", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const startedAt = Date.now();
    const result = await generateStoryPipeline({
      ctx,
      seams: {
        plannerProvider: fake.provider,
        writerProvider: fake.provider,
        moderatorProvider: fake.provider,
        illustrate: async () => ({ dataUri: WEBP }),
      },
    });
    const elapsedMs = Date.now() - startedAt;
    expect(result.ok).toBe(true);
    expect(elapsedMs).toBeLessThan(120_000);
  });

  it("surfaces a generation_timeout when the illustration stage overshoots the budget", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStoryPipeline({
      ctx,
      seams: {
        plannerProvider: fake.provider,
        writerProvider: fake.provider,
        moderatorProvider: fake.provider,
        illustrate: async () => {
          await new Promise((r) => setTimeout(r, 30));
          return { dataUri: WEBP };
        },
      },
      pipelineBudgetMs: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("generation_timeout");
      expect(result.transient).toBe(true);
    }
  });
});
