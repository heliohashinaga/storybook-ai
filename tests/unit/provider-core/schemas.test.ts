import { describe, expect, it } from "vitest";
import {
  moderationSchema,
  sceneCandidateSchema,
  storyCandidateSchema,
} from "../../../src/features/story-generation/server/provider-core/schemas";

const validScene = {
  ordinal: 1,
  title: "The Fox",
  body: "A fox wakes up.",
  illustrationPrompt: "a soft watercolor fox",
};

describe("provider-core schemas", () => {
  it("accepts a valid scene candidate", () => {
    expect(sceneCandidateSchema.parse(validScene)).toEqual(validScene);
  });

  it("rejects a scene with non-positive ordinal", () => {
    expect(() => sceneCandidateSchema.parse({ ...validScene, ordinal: 0 })).toThrow();
  });

  it("rejects a scene with empty body", () => {
    expect(() => sceneCandidateSchema.parse({ ...validScene, body: "" })).toThrow();
  });

  it("accepts a valid story candidate with at least one scene", () => {
    const story = { title: "A Fox Tale", scenes: [validScene] };
    expect(storyCandidateSchema.parse(story)).toEqual(story);
  });

  it("rejects a story with zero scenes", () => {
    expect(() => storyCandidateSchema.parse({ title: "Empty", scenes: [] })).toThrow();
  });

  it("accepts a safe moderation decision", () => {
    expect(moderationSchema.parse({ safe: true })).toEqual({ safe: true });
  });

  it("accepts an unsafe moderation decision with reason", () => {
    expect(moderationSchema.parse({ safe: false, reason: "violence" })).toEqual({
      safe: false,
      reason: "violence",
    });
  });

  it("accepts a null reason", () => {
    expect(moderationSchema.parse({ safe: true, reason: null })).toEqual({
      safe: true,
      reason: null,
    });
  });
});
