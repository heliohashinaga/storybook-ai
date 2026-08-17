import { describe, expect, it } from "vitest";
import {
  MODERATION_SYSTEM_PROMPT,
  NARRATIVE_SYSTEM_PROMPT,
  narrativeUserPrompt,
} from "../../../src/features/story-generation/server/provider-core/prompts";
import type { ProviderStoryInput } from "../../../src/features/story-generation/server/story-generation-provider";

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

describe("provider-core prompts", () => {
  it("narrative system prompt is the canonical safe-author instruction", () => {
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("children's books");
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("single JSON object");
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("no prose, no markdown");
  });

  it("moderation system prompt is the strict classifier", () => {
    expect(MODERATION_SYSTEM_PROMPT).toContain("strict safety classifier");
    expect(MODERATION_SYSTEM_PROMPT).toContain('{"safe": true|false');
    expect(MODERATION_SYSTEM_PROMPT).toContain("child's name");
  });

  it("builds a narrative user prompt as JSON with exact scene count", () => {
    const prompt = narrativeUserPrompt(input);
    const parsed = JSON.parse(prompt);
    expect(parsed.scenes.count).toBe(3);
    expect(parsed.scenes.requirement).toContain("Exactly 3 scenes");
    expect(parsed.locale).toBe("pt-BR");
    expect(parsed.ageBand).toBe("5-7");
    expect(parsed.theme).toBe("courage");
  });

  it("uses English for en locale", () => {
    const prompt = narrativeUserPrompt({ ...input, locale: "en" });
    const parsed = JSON.parse(prompt);
    expect(parsed.ai).toContain("English");
  });

  it("never includes names or identifying details in rules", () => {
    const prompt = narrativeUserPrompt(input);
    const parsed = JSON.parse(prompt);
    expect(parsed.rules.join(" ")).toContain("Never include names");
    expect(parsed.output_schema.scenes).toHaveLength(1);
  });
});
