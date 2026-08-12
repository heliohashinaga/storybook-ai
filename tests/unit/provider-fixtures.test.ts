import { describe, expect, it } from "vitest";
import {
  STYLE_DESCRIPTOR,
  buildSafeCandidate,
  characterDescriptor,
} from "../fixtures/story-generation/provider-fixtures";
import type { AgeBand } from "../../src/features/story-generation/server/schemas";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";

function input(overrides: Partial<ProviderStoryInput> = {}): ProviderStoryInput {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCount: 3,
    ...overrides,
  };
}

describe("provider fixtures — buildSafeCandidate (T011)", () => {
  it.each([3, 4, 5])("builds exactly %i safe scenes (sceneCount honored)", (sceneCount) => {
    const candidate = buildSafeCandidate(input({ sceneCount }));
    expect(candidate.scenes).toHaveLength(sceneCount);
    // Ordinals are strictly sequential starting at 1.
    candidate.scenes.forEach((s, i) => expect(s.ordinal).toBe(i + 1));
    // Every illustration prompt reuses the same style descriptor (FR-006/T030).
    for (const s of candidate.scenes) {
      expect(s.illustrationPrompt).toContain(STYLE_DESCRIPTOR);
      expect(s.illustrationPrompt).toContain(characterDescriptor(input().ageBand));
    }
  });

  it("returns a non-empty localized title", () => {
    expect(buildSafeCandidate(input()).title.trim().length).toBeGreaterThan(0);
  });

  it("uses the age-band character descriptor in every prompt", () => {
    const band: AgeBand = "8-9";
    const candidate = buildSafeCandidate(input({ ageBand: band, sceneCount: 4 }));
    const descriptor = characterDescriptor(band);
    for (const s of candidate.scenes) {
      expect(s.illustrationPrompt).toContain(descriptor);
    }
  });

  it("keeps the input anonymous (only band/locale/theme/ count, never exact age)", () => {
    const candidate = buildSafeCandidate(input());
    expect(JSON.stringify(candidate)).not.toMatch(/"age"\s*:/i);
    expect(JSON.stringify(candidate)).not.toMatch(/"exactAge"/i);
    expect(JSON.stringify(candidate)).not.toMatch(/"name"\s*:/i);
  });
});
