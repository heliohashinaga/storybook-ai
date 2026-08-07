import { describe, expect, it, vi } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";
import { storyResponseSchema } from "../../src/features/story-generation/server/schemas";

const webpDataUri = "data:image/webp;base64,QUJDRA";

const illustrate = () => Promise.resolve({ dataUri: webpDataUri });

const input: ProviderStoryInput = { ageBand: "5-7", locale: "pt-BR", theme: "courage" };

function capturingIllustrator() {
  const prompts: string[] = [];
  return {
    prompts,
    illustrate: async (prompt: string) => {
      prompts.push(prompt);
      return { dataUri: webpDataUri };
    },
  };
}

function flakyIllustrator(failFirstTimes = 1) {
  let calls = 0;
  const prompts: string[] = [];
  return {
    prompts,
    count: () => calls,
    illustrate: async (prompt: string) => {
      calls += 1;
      prompts.push(prompt);
      if (calls <= failFirstTimes) throw new Error("image generation failed");
      return { dataUri: webpDataUri };
    },
  };
}

describe("provider pipeline — structured narrative", () => {
  it("returns a validated three-scene story with title and scene body text", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(storyResponseSchema.safeParse(result.story).success).toBe(true);
    expect(result.story.scenes).toHaveLength(3);
    expect(result.story.title.length).toBeGreaterThan(0);
    for (const scene of result.story.scenes) {
      expect(scene.body.length).toBeGreaterThan(0);
      expect(scene.title.length).toBeGreaterThan(0);
    }
    // Only the anonymous request fields reach the provider.
    expect(JSON.stringify(fake.requests[0])).not.toMatch(/"name"/i);
  });

  it("requests exactly three illustration prompts (one per scene)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    expect(illustrator.prompts).toHaveLength(3);
    // Prompts come from each moderated scene in order and are distinct.
    expect(new Set(illustrator.prompts).size).toBe(3);
  });

  it("produces a consistent illustration set (every scene has a WebP data URI)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const scene of result.story.scenes) {
      expect(scene.illustrationDataUri.startsWith("data:image/webp;base64,")).toBe(true);
    }
  });

  it("adds localized alt text to every scene", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const scene of result.story.scenes) {
      expect(scene.altText.length).toBeGreaterThan(0);
    }
    expect(result.story.scenes[0]?.altText.toLowerCase()).toContain("coragem");
  });
});

describe("provider pipeline — moderation calls (text and image)", () => {
  it("calls moderateText exactly once per scene body on a safe candidate", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const textSpy = vi.spyOn(fake.provider, "moderateText");
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    expect(textSpy).toHaveBeenCalledTimes(3);
    // Each scene body reaches moderation verbatim.
    expect(textSpy).toHaveBeenCalledWith("Corpo da cena 1.");
    expect(textSpy).toHaveBeenCalledWith("Corpo da cena 2.");
    expect(textSpy).toHaveBeenCalledWith("Corpo da cena 3.");
  });

  it("calls moderateImage exactly once per illustration prompt on a safe candidate", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const imageSpy = vi.spyOn(fake.provider, "moderateImage");
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    expect(imageSpy).toHaveBeenCalledTimes(3);
    // Each scene's illustration prompt reaches moderation verbatim.
    expect(imageSpy).toHaveBeenCalledWith(expect.stringContaining("cena 1"));
    expect(imageSpy).toHaveBeenCalledWith(expect.stringContaining("cena 2"));
    expect(imageSpy).toHaveBeenCalledWith(expect.stringContaining("cena 3"));
  });

  it("regenerates when a specific scene body is unsafe (scene 0) and never leaks it", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-text-scene-0-then-safe" });
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.story.safetyDecision).toBe("regenerated");
    expect(JSON.stringify(result.story)).not.toContain("unsafecontent");
  });

  it("regenerates when scene 2's body is unsafe", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-text-scene-2-then-safe" });
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.story.safetyDecision).toBe("regenerated");
    expect(JSON.stringify(result.story)).not.toContain("unsafecontent");
  });

  it("regenerates when a scene's illustration prompt is unsafe", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-illustration-scene-1-then-safe" });
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.story.safetyDecision).toBe("regenerated");
    expect(JSON.stringify(result.story)).not.toContain("unsafecontent");
  });
});

describe("provider pipeline — illustration-set consistency", () => {
  it("generates three distinct prompts sharing style and character markers", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const imageSpy = vi.spyOn(fake.provider, "moderateImage");
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);

    const prompts = imageSpy.mock.calls.map(([prompt]) => prompt);
    expect(prompts).toHaveLength(3);
    // scene-specific portions are distinct (not three identical prompts).
    expect(new Set(prompts).size).toBe(3);
    for (const prompt of prompts) {
      expect(prompt).toContain("watercolor style"); // shared fixed style descriptor
      expect(prompt).toContain("young child character"); // stable trait derived from ageBand 5-7
    }
    // The moderated prompts are exactly what the illustrator generated from.
    expect(illustrator.prompts).toEqual(prompts);
  });

  it("rejects an inconsistent illustration set (missing shared style marker) and regenerates", async () => {
    const fake = createFakeProvider({ scenario: "inconsistent-illustrations" });
    const imageSpy = vi.spyOn(fake.provider, "moderateImage");
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // First attempt had an inconsistent prompt (rejected by image moderation);
    // the regeneration produced a consistent set.
    expect(result.story.safetyDecision).toBe("regenerated");
    expect(imageSpy.mock.calls.length).toBeGreaterThan(3);
  });
});

describe("provider pipeline — direct identifier / template marker rejection", () => {
  it("never surfaces template markers or direct identifiers at the orchestration level", async () => {
    const fake = createFakeProvider({ scenario: "template-marker-leak" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsafe_unrecoverable");
    // The unsafe candidate never reaches illustration generation or the caller.
    expect(illustrator.prompts).toHaveLength(0);
    expect(JSON.stringify(result.error)).not.toMatch(
      /\{\s*name\s*\}|\[NAME\]|nome\s+da\s+criança/i
    );
  });

  it("never sends a direct identifier to the provider or returns it in a story", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(true);
    // Only anonymous request fields ever reach the provider payload.
    expect(JSON.stringify(fake.requests)).not.toMatch(/"(name|nome)"/i);
    if (!result.ok) return;
    expect(JSON.stringify(result.story)).not.toMatch(/\(name\)|nome\s+da\s+criança/i);
  });
});

describe("provider pipeline — safety integration (text and image)", () => {
  it("never leaks an unsafe first attempt into the returned story", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.story.safetyDecision).toBe("regenerated");
    expect(JSON.stringify(result.story)).not.toContain("unsafecontent");
  });

  it("returns a safe generic failure when no safe candidate exists", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const illustrator = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsafe_unrecoverable");
    // Illustration generation is never attempted for an unsafe story.
    expect(illustrator.prompts).toHaveLength(0);
  });
});

describe("provider pipeline — bounded illustration retry", () => {
  it("retries a missing/incomplete illustration set and succeeds", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = flakyIllustrator(1);
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(illustrator.count()).toBeGreaterThan(3);
    expect(result.story.scenes.every((s) => s.illustrationDataUri.length > 0)).toBe(true);
  });

  it("returns a safe error when the illustration set stays incomplete after bounded retries", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const illustrator = flakyIllustrator(Number.POSITIVE_INFINITY);
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: illustrator.illustrate,
      imageRetries: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("generation_unavailable");
  });
});

describe("provider pipeline — response-size guard", () => {
  it("rejects an oversized illustration and retries; recovers when a safe size is produced", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    let calls = 0;
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => {
        calls += 1;
        if (calls === 1) {
          return { dataUri: `data:image/webp;base64,${"A".repeat(4096)}` };
        }
        return { dataUri: webpDataUri };
      },
      imageRetries: 1,
      maxIllustrationDataUriLength: 128,
    });
    expect(result.ok).toBe(true);
    // A retry happened: the first attempt failed (oversize) and the set was generated again.
    expect(calls).toBeGreaterThan(3);
  });

  it("reports generation_unavailable when every attempt is oversized", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => ({ dataUri: `data:image/webp;base64,${"A".repeat(4096)}` }),
      imageRetries: 1,
      maxIllustrationDataUriLength: 128,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("generation_unavailable");
  });
});

describe("provider pipeline — provider error mapping", () => {
  it("maps an unavailable provider to generation_unavailable (502)", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const artist = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: artist.illustrate,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("generation_unavailable");
  });

  it("maps a timeout to generation_timeout (504)", async () => {
    const fake = createFakeProvider({ scenario: "timeout" });
    const artist = capturingIllustrator();
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: artist.illustrate,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("generation_timeout");
  });
});
