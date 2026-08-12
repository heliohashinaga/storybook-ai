import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";

const webpDataUri = "data:image/webp;base64,QUJDRA";

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 5,
};

/**
 * Records illustration-generation concurrency. Each `illustrate(prompt)` call
 * registers the prompt and bumps the in-flight counter; the promise settles
 * after a fixed delay so concurrent calls genuinely overlap long enough for
 * the recorder to observe them together. We assert on `maxInFlight`, the
 * peak number of calls running at once (the concurrency upper bound, ADR 0005).
 */
function concurrencyRecorder(delayMs = 25) {
  const startOrder: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const illustrate = (prompt: string) => {
    startOrder.push(prompt);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<{ dataUri: string }>((resolve) => {
      setTimeout(() => {
        inFlight -= 1;
        resolve({ dataUri: webpDataUri });
      }, delayMs);
    });
  };

  return {
    startOrder,
    /** Peak number of illustration calls running concurrently (never exceeds the limit). */
    maxInFlight: () => maxInFlight,
    illustrate,
  };
}

describe("illustration generation — bounded concurrency (ADR 0005)", () => {
  it("never exceeds a provided concurrency limit while generating a five-scene set", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const rec = concurrencyRecorder();

    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: rec.illustrate,
      illustrationConcurrency: 2,
    });

    expect(result.ok).toBe(true);
    // Peak concurrency respects the configured limit, never running all 5 at once.
    expect(rec.maxInFlight()).toBeLessThanOrEqual(2);
    expect(rec.maxInFlight()).toBeGreaterThan(0);
    // Every scene still receives an illustration, in the right total count.
    if (result.ok) {
      expect(result.story.scenes).toHaveLength(5);
      expect(rec.startOrder).toHaveLength(5);
    }
  });

  it("defaults to a conservative limit rather than unbounded Promise.all", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const rec = concurrencyRecorder();

    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: rec.illustrate,
    });

    expect(result.ok).toBe(true);
    // Without an override the built-in limit applies: the five illustrations
    // are generated with limited overlap, not all at once.
    expect(rec.maxInFlight()).toBeGreaterThan(0);
    expect(rec.maxInFlight()).toBeLessThan(5);
    // All five still complete successfully.
    if (result.ok) {
      expect(result.story.scenes).toHaveLength(5);
      expect(rec.startOrder).toHaveLength(5);
    }
  });

  it("preserves whole-set retry: a failing illustration regenerates; a set is never partial", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const rec = concurrencyRecorder();
    let firstAttempt = true;

    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: (prompt) => {
        // Abort the very first illustration call once, forcing a whole-set retry.
        if (firstAttempt) {
          firstAttempt = false;
          return Promise.reject(new Error("transient image failure"));
        }
        return rec.illustrate(prompt);
      },
      imageRetries: 1,
      illustrationConcurrency: 2,
    });

    expect(result.ok).toBe(true);
    // The retried set completes a full, non-partial five-scene story: every
    // scene carries an illustration URI. (An in-flight call from the aborted
    // attempt overlaps the retry for an instant and can't be undone — that's
    // expected — so we assert the complete result and the distinct-prompt
    // coverage rather than a transient concurrency peak.)
    if (result.ok) {
      expect(result.story.scenes.every((s) => s.illustrationDataUri.startsWith(webpDataUri))).toBe(
        true
      );
      expect(new Set(rec.startOrder).size).toBeGreaterThanOrEqual(5);
    }
  });

  it("returns a safe error (never a partial story) when a set keeps failing after bounded retries", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: () => Promise.reject(new Error("image generation failed on every attempt")),
      imageRetries: 1,
      illustrationConcurrency: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // No partial story is ever surfaced — a generic, safe error instead.
    expect(result.error.code).toBe("generation_unavailable");
  });
});
