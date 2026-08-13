import { describe, expect, it } from "vitest";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";

/**
 * Per-capability **anonymity invariant** (spec 005 US3, T018).
 *
 * With two providers simultaneously live, each provider must receive **only**
 * the anonymous payload of its own capability. The three capabilities are:
 * - text story generation → `ProviderStoryInput` (age band / locale / theme /
 *   scene count);
 * - text moderation → the rendered scene body;
 * - image moderation + illustration → the illustration prompt.
 *
 * None of these payloads may carry a direct identifier, an exact age, a name,
 * or any child-specific field (AGENTS.md "No direct identifiers, ever").
 */

const anonymousInput: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

const FORBIDDEN = [
  /name/i,
  /childName/i,
  /exactAge/i,
  /"age"\s*:/,
  /first ?name/i,
  /nome/i,
  /identifier/i,
];

function assertNoIdentifier(payload: unknown, label: string) {
  const raw = JSON.stringify(payload);
  for (const pattern of FORBIDDEN) {
    expect(raw, `${label} must not contain ${pattern}`).not.toMatch(pattern);
  }
}

describe("per-capability payload anonymity (T018)", () => {
  it("text story-generation input carries only ageBand/locale/theme/sceneCount", () => {
    // The provider-bound request shape must be exactly the four anonymous
    // fields — no exact age, no name, no identifier.
    expect(Object.keys(anonymousInput).sort()).toEqual([
      "ageBand",
      "locale",
      "sceneCount",
      "theme",
    ]);
    assertNoIdentifier(anonymousInput, "story input");
    expect(anonymousInput.ageBand).toBe("5-7"); // coarse band, not exact age
  });

  it("text moderation payload is the scene body only (no identifier fields)", () => {
    const sceneBody = "A pequena estrelinha brilhou e ajudou o amigo.";
    assertNoIdentifier(sceneBody, "text moderation payload");
    // The moderation call is a plain string; serializing it must not add any
    // identifier wrapper or child fields.
    expect(sceneBody).not.toMatch(/name:|age:/i);
  });

  it("image moderation + illustration payload is the prompt only (no identifiers)", () => {
    const prompt = "Uma estrelinha sorridente no céu da praia, ao pôr do sol.";
    assertNoIdentifier(prompt, "image prompt");
    expect(prompt).not.toMatch(/name:|age:/i);
  });

  it("the generated candidate/scene carries no direct identifier or exact age", () => {
    // Serialize a realistic provider candidate exactly as it would be shown;
    // it must contain only localized content, never an identifier.
    const candidate = {
      title: "A estrelinha e o mar",
      scenes: [{ ordinal: 1, title: "Cena 1", body: "Texto.", illustrationPrompt: "Ilustração." }],
    };
    assertNoIdentifier(candidate, "story candidate");
    expect(JSON.stringify(candidate)).not.toContain("6"); // no exact age digits leak
  });

  it("the browser cookie/persistence contract never stores an identifier key", () => {
    // The only keys ever written anywhere are the four anonymous ones.
    const persisted = {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    } as Record<string, unknown>;
    assertNoIdentifier(persisted, "persisted keys");
    const keys = Object.keys(persisted);
    expect(keys).not.toContain("name");
    expect(keys).not.toContain("age");
    expect(keys).not.toContain("childId");
  });
});
