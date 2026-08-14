import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

/**
 * T031 — no embedded audio in the GeneratedStory payload. Synthesized voice is
 * delivered on demand via the dedicated `/api/narrate` endpoint; the story
 * response carries no audio or narrations, keeping the contract lean and
 * avoiding any reader-pipeline coupling in the synchronous path.
 */
describe("no embedded audio in GeneratedStory (T031)", () => {
  it("the successful story payload has no audio/narration fields", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input: { ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 },
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a story");

    const story = result.story as unknown as Record<string, unknown>;
    const blob = JSON.stringify(story).toLowerCase();
    expect(story).not.toHaveProperty("audio");
    expect(story).not.toHaveProperty("narrations");
    expect(story).not.toHaveProperty("speech");
    expect(blob).not.toContain('"voiceselected"');
    for (const scene of story.scenes as Array<Record<string, unknown>>) {
      expect(scene).not.toHaveProperty("audioDataUri");
      expect(scene).not.toHaveProperty("narationAudio");
    }
  });
});
