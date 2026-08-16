import { describe, expect, it } from "vitest";
import { moderateStory } from "../../../../src/features/story-generation/server/agents/moderator";
import type {
  JobContext,
  WrittenScene,
  WrittenStory,
} from "../../../../src/features/story-generation/server/agents/types";
import {
  createFakeProvider,
  STYLE_DESCRIPTOR,
} from "../../../fixtures/story-generation/provider-fixtures";

/** Returns a story copy with scene `index` patched, preserving WrittenScene. */
function replaceScene(
  story: WrittenStory,
  index: number,
  patch: Partial<WrittenScene>
): WrittenStory {
  return {
    ...story,
    scenes: story.scenes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  };
}

function ctx(): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "token",
  };
}

function mkWritten(overrides: Partial<WrittenScene> = {}): WrittenStory {
  const bodyTexts: (string | undefined)[] = [
    overrides.body ?? "A brave little fox explored the forest.",
    "She found a hidden path.",
    "At the end she smiled, knowing she was safe.",
  ];
  return {
    title: "A Brave Journey",
    scenes: [1, 2, 3].map((i) => ({
      ordinal: i,
      title: `Scene ${i}`,
      body: bodyTexts[i - 1] ?? `Scene ${i} body`,
      illustrationPrompt: `${STYLE_DESCRIPTOR}, watercolor scene ${i}`,
    })),
  };
}

describe("moderator agent", () => {
  it("approves a safe narrative", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await moderateStory(ctx(), mkWritten(), { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(3);
    }
  });

  it("returns unsafe_unrecoverable when content stays unsafe after regeneration", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await moderateStory(ctx(), mkWritten({ body: "unsafecontent text" }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("unsafe_unrecoverable");
    }
  });

  it("fails fast when the writer output does not match the requested scene count", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    // Written has only 2 scenes while the job requests 3 (inconsistent writer).
    const short = { ...mkWritten(), scenes: mkWritten().scenes.slice(0, 2) };
    const result = await moderateStory(ctx(), short, { provider: fake.provider });
    expect(result).toEqual({
      ok: false,
      stage: "moderate",
      message: "story.error.generationUnavailable",
      transient: false,
    });
  });

  it("maps a ProviderError timeout during regeneration to a localized timeout error", async () => {
    const fake = createFakeProvider({ scenario: "timeout" });
    // Unsafe content forces the regeneration path, where the provider throws.
    const result = await moderateStory(ctx(), mkWritten({ body: "unsafecontent text" }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(true);
      expect(result.message).toBe("story.error.generationTimeout");
      expect(result.errorCode).toBe("generation_timeout");
    }
  });

  it("rejects a regenerated candidate with fewer than three scenes", async () => {
    const fake = createFakeProvider({ scenario: "invalid", invalidSceneCount: 2 });
    // Written is unsafe → regeneration returns a 2-scene candidate → after
    // the guard rejects it, the moderator gives up with unsafe_unrecoverable.
    const result = await moderateStory(ctx(), mkWritten({ body: "unsafecontent text" }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("unsafe_unrecoverable");
    }
  });

  it("rejects a written candidate with an empty title (guard)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    // Written has 3 scenes but no title → attempt 0 is rejected by the guard;
    // the safe regeneration is then approved.
    const untitled: WrittenStory = { ...mkWritten(), title: "   " };
    const result = await moderateStory(ctx(), untitled, { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.safetyDecision).toBe("regenerated");
    }
  });

  it("rejects a written candidate with an empty scene body (structural guard)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const hollow: WrittenStory = replaceScene(mkWritten(), 2, { body: "" });
    const result = await moderateStory(ctx(), hollow, { provider: fake.provider });
    // Guard rejects attempt 0; the writer-regenerated candidate is approved.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.safetyDecision).toBe("regenerated");
    }
  });

  it("rejects a written candidate whose scene title leaks a template marker (forbidden content)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const leakyTitle: WrittenStory = replaceScene(mkWritten(), 2, {
      title: "Oi, {name}!",
    });
    const result = await moderateStory(ctx(), leakyTitle, { provider: fake.provider });
    // Forbidden content is caught statically; the regenerated safe text is approved.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.safetyDecision).toBe("regenerated");
  });

  it("rejects a written candidate when image moderation flags an illustration prompt", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const unsafeIllustration: WrittenStory = replaceScene(mkWritten(), 2, {
      illustrationPrompt: `${STYLE_DESCRIPTOR}, unsafecontent scene`,
    });
    const result = await moderateStory(ctx(), unsafeIllustration, {
      provider: fake.provider,
    });
    // Image moderation rejects the prompt; regeneration yields a clean candidate.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.safetyDecision).toBe("regenerated");
  });
});
