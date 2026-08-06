import { describe, expect, it } from "vitest";
import { createFakeProvider, buildSafeCandidate } from "../fixtures/story-generation/provider-fixtures";
import { ProviderError } from "../../src/features/story-generation/server/story-generation-provider";

const input = { ageBand: "5-7", locale: "pt-BR", theme: "courage" } as const;

describe("fake provider fixtures", () => {
  it("safe scenario returns a three-scene candidate and passes moderation", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const story = await fake.provider.generateStory(input);
    expect(story.scenes).toHaveLength(3);
    expect(await fake.provider.moderateText(story.scenes[0]!.body)).toEqual({ safe: true });
    expect(await fake.provider.moderateImage(story.scenes[0]!.illustrationPrompt)).toEqual({ safe: true });
  });

  it("unsafe-then-safe: first candidate is rejected, second is safe, counted for regeneration", async () => {
    const fake = createFakeProvider({ scenario: "unsafe-then-safe" });
    const first = await fake.provider.generateStory(input);
    expect((await fake.provider.moderateText(first.scenes[0]!.body)).safe).toBe(false);
    const second = await fake.provider.generateStory(input);
    expect(await fake.provider.moderateText(second.scenes[0]!.body)).toEqual({ safe: true });
    expect(fake.generateCalls).toBe(2);
  });

  it("unavailable scenario throws a typed ProviderError", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    await expect(fake.provider.generateStory(input)).rejects.toBeInstanceOf(ProviderError);
  });

  it("invalid scenario returns fewer than three scenes for pipeline rejection", async () => {
    const fake = createFakeProvider({ scenario: "invalid" });
    const story = await fake.provider.generateStory(input);
    expect(story.scenes.length).toBeLessThan(3);
  });

  it("records only the anonymous ageBand/locale/theme — never a direct identifier", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    await fake.provider.generateStory(input);
    expect(fake.requests).toEqual([input]);
    const serialized = JSON.stringify(fake.requests);
    expect(serialized).not.toMatch(/name|Luna|"age"/i);
  });

  it("buildSafeCandidate shapes a deterministic three-scene candidate", () => {
    const candidate = buildSafeCandidate(input);
    expect(candidate.scenes.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    expect(candidate.title).toContain("courage");
  });
});
