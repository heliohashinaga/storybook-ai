import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import { reviewStory } from "../../src/features/story-generation/server/agents/reviewer";
import type { JobContext } from "../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

const IDENTIFIER_PATTERNS = [
  "nome",
  "criança",
  "child name",
  "first name",
  "{name}",
  "{{child}}",
  "[NAME]",
];

/**
 * T023 / T039 — privacy invariants: the multi-agent pipeline is anonymous by
 * design. No direct identifier is ever accepted, sent to the provider, present
 * in the resulting story, or logged. The provider seam only ever receives the
 * three derived fields (ageBand, locale, theme) plus the requested scene count.
 */
describe("pipeline privacy invariants (T023/T039)", () => {
  it("only hands the provider the derived anonymous fields (no identifier)", async () => {
    const seen: unknown[] = [];
    const fake = createFakeProvider({ scenario: "safe" });
    // Wrap generateStory to capture the exact payload sent to the provider.
    const provider = {
      ...fake.provider,
      generateStory: async (payload: unknown) => {
        seen.push(payload);
        return fake.provider.generateStory(payload as never);
      },
    };

    const ctx: JobContext = {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCountRequested: 3,
      generationToken: "token",
    };
    const result = await reviewStory(ctx, { provider });
    expect(result.ok).toBe(true);

    expect(seen).toHaveLength(1);
    const payload = seen[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["ageBand", "locale", "sceneCount", "theme"]);
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("age");
    expect(payload).not.toHaveProperty("exactAge");
  });

  it("never leaks an identifier into the generated story", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input: { ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 },
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected a story");

    const { story } = result;
    const blob = JSON.stringify(story).toLowerCase();
    for (const pattern of IDENTIFIER_PATTERNS) {
      expect(blob).not.toContain(pattern.toLowerCase());
    }
  });
});
