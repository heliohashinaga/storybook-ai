import { describe, expect, it, vi } from "vitest";
import { readScene } from "../../../../src/features/story-generation/server/agents/reader";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";

function ctx(): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "token",
  };
}

describe("reader agent", () => {
  it("accepts a non-empty anonymous scene text", async () => {
    const result = await readScene(ctx(), { ordinal: 2, text: "Ela encontrou a passagem." });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ordinal).toBe(2);
  });

  it("returns an Err for an empty scene", async () => {
    const result = await readScene(ctx(), { ordinal: 1, text: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("read");
      expect(result.transient).toBe(false);
    }
  });

  it("invokes the on-demand narration hook when provided", async () => {
    const readOnDemand = vi.fn(async () => {});
    const result = await readScene(ctx(), { ordinal: 1, text: "Texto." }, { readOnDemand });
    expect(result.ok).toBe(true);
    expect(readOnDemand).toHaveBeenCalledWith("Texto.");
  });

  it("returns a transient Err if the narration hook rejects", async () => {
    const readOnDemand = vi.fn(async () => {
      throw new Error("tts down");
    });
    const result = await readScene(ctx(), { ordinal: 1, text: "Texto." }, { readOnDemand });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(true);
      expect(result.errorCode ?? "generation_unavailable").toBe("generation_unavailable");
    }
  });
});
