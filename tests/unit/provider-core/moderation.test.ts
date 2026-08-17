import { describe, expect, it } from "vitest";
import { moderate } from "../../../src/features/story-generation/server/provider-core/moderation";
import type { ModerationDecision } from "../../../src/features/story-generation/server/story-generation-provider";
import { ProviderError } from "../../../src/features/story-generation/server/story-generation-provider";

function fakeClient(content: string) {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  } as never;
}

describe("provider-core moderate", () => {
  it("returns { safe: true } for a safe decision", async () => {
    const decision: ModerationDecision = await moderate(
      fakeClient(JSON.stringify({ safe: true })),
      "model",
      "a happy fox"
    );
    expect(decision).toEqual({ safe: true });
  });

  it("includes the reason when unsafe", async () => {
    const decision: ModerationDecision = await moderate(
      fakeClient(JSON.stringify({ safe: false, reason: "violence" })),
      "model",
      "scary text"
    );
    expect(decision).toEqual({ safe: false, reason: "violence" });
  });

  it("omits the reason when null", async () => {
    const decision: ModerationDecision = await moderate(
      fakeClient(JSON.stringify({ safe: false, reason: null })),
      "model",
      "text"
    );
    expect(decision).toEqual({ safe: false });
  });

  it("throws unavailable ProviderError when the result is invalid", async () => {
    await expect(
      moderate(fakeClient(JSON.stringify({ unexpected: true })), "model", "text")
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws unavailable ProviderError when the client throws", async () => {
    const broken = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("network down");
          },
        },
      },
    } as never;
    await expect(moderate(broken, "model", "text")).rejects.toBeInstanceOf(ProviderError);
  });
});
