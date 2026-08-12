import {
  ProviderError,
  type GeneratedStoryCandidate,
  type ModerationDecision,
  type ProviderStoryInput,
  type StoryGenerationProvider,
} from "../../../src/features/story-generation/server/story-generation-provider";
import type { AgeBand } from "../../../src/features/story-generation/server/schemas";

/**
 * Deterministic fake provider for tests. Never calls a live AI service and
 * records only the anonymous input (ageBand/locale/theme) — never an exact
 * age or any direct identifier.
 */

/** Marker content that the fake's moderation rejects by default. */
const UNSAFE = "unsafecontent";

/**
 * Fixed style descriptor shared by every scene's illustration prompt (FR-004).
 * Prompts reuse this plus a stable, anonymous character description derived
 * from the age band so the illustration set is visually consistent.
 */
export const STYLE_DESCRIPTOR = "watercolor style";

/** Stable, anonymous character description derived from the age band (FR-004). */
export function characterDescriptor(ageBand: AgeBand): string {
  if (ageBand === "2-4") return "toddler character";
  if (ageBand === "5-7") return "young child character";
  return "older child character";
}

function scene(
  ordinal: number,
  ageBand: AgeBand
): {
  ordinal: number;
  title: string;
  body: string;
  illustrationPrompt: string;
} {
  return {
    ordinal,
    title: `Título ${ordinal}`,
    body: `Corpo da cena ${ordinal}.`,
    illustrationPrompt: `${STYLE_DESCRIPTOR}, ${characterDescriptor(ageBand)}, cena ${ordinal}`,
  };
}

export function buildSafeCandidate(input: ProviderStoryInput): GeneratedStoryCandidate {
  const count = input.sceneCount ?? 3;
  return {
    title: `Uma história de ${input.theme}`,
    scenes: Array.from({ length: count }, (_, i) => scene(i + 1, input.ageBand)),
  };
}

export type FakeScenario =
  | "safe"
  | "unsafe-then-safe"
  | "double-unsafe"
  | "unavailable"
  | "timeout"
  | "invalid"
  | "unsafe-text-scene-0-then-safe"
  | "unsafe-text-scene-2-then-safe"
  | "unsafe-illustration-scene-1-then-safe"
  | "inconsistent-illustrations"
  | "template-marker-leak";

export interface FakeProvider {
  provider: StoryGenerationProvider;
  /** Anonymous requests received (ageBand/locale/theme only). */
  requests: ProviderStoryInput[];
  /** Number of generateStory calls (for auto-regeneration assertions). */
  generateCalls: number;
  reset: () => void;
}

interface Options {
  scenario?: FakeScenario;
  /** When scenario is "invalid", return this many scenes (default 2). */
  invalidSceneCount?: number;
}

/** Returns a candidate with UNSAFE injected into the given scene's field. */
function unsafeOn(
  index: number
): (
  candidate: GeneratedStoryCandidate,
  field: "body" | "illustrationPrompt"
) => GeneratedStoryCandidate {
  return (candidate, field) => {
    const scenes = candidate.scenes.map((s, i) =>
      i === index ? { ...s, [field]: `${s[field]} ${UNSAFE}` } : s
    );
    return { ...candidate, scenes };
  };
}

/** Removes the shared style descriptor from one scene's prompt (FR-004 violation). */
function inconsistentSet(input: ProviderStoryInput): GeneratedStoryCandidate {
  const base = buildSafeCandidate(input);
  const scenes = base.scenes.map((s, i) =>
    i === 2
      ? { ...s, illustrationPrompt: s.illustrationPrompt.replace(`${STYLE_DESCRIPTOR}, `, "") }
      : s
  );
  return { ...base, scenes };
}

/** Returns a candidate whose text contains a template marker / direct identifier. */
function leakingCandidate(input: ProviderStoryInput): GeneratedStoryCandidate {
  const base = buildSafeCandidate(input);
  const scenes = base.scenes.map((s, i) =>
    i === 0 ? { ...s, body: `Olá, {name}! ${s.body}` } : s
  );
  return { ...base, scenes };
}

export function createFakeProvider(options: Options = {}): FakeProvider {
  const scenario = options.scenario ?? "safe";
  const requests: ProviderStoryInput[] = [];
  let generateCalls = 0;

  const decide = (value: string): ModerationDecision =>
    value.includes(UNSAFE) ? { safe: false, reason: "unsafe-content" } : { safe: true };

  const generateStory: StoryGenerationProvider["generateStory"] = async (input) => {
    generateCalls += 1;
    requests.push(input);

    if (scenario === "unavailable") throw new ProviderError("unavailable", "provider down");
    if (scenario === "timeout") throw new ProviderError("timeout", "provider timed out");

    if (scenario === "double-unsafe") {
      const bad = buildSafeCandidate(input);
      return {
        title: bad.title,
        scenes: bad.scenes.map((s) => ({ ...s, body: `${s.body} ${UNSAFE}` })),
      };
    }

    if (scenario === "unsafe-then-safe" || scenario === "unsafe-text-scene-0-then-safe") {
      if (generateCalls === 1) return unsafeOn(0)(buildSafeCandidate(input), "body");
    }
    if (scenario === "unsafe-text-scene-2-then-safe") {
      if (generateCalls === 1) return unsafeOn(2)(buildSafeCandidate(input), "body");
    }
    if (scenario === "unsafe-illustration-scene-1-then-safe") {
      if (generateCalls === 1) return unsafeOn(1)(buildSafeCandidate(input), "illustrationPrompt");
    }
    if (scenario === "inconsistent-illustrations") {
      if (generateCalls === 1) return inconsistentSet(input);
    }
    if (scenario === "template-marker-leak") {
      return leakingCandidate(input);
    }
    if (scenario === "invalid") {
      return {
        title: "incompleto",
        scenes: buildSafeCandidate(input).scenes.slice(0, options.invalidSceneCount ?? 2),
      };
    }
    return buildSafeCandidate(input);
  };

  const moderateText: StoryGenerationProvider["moderateText"] = async (text) => decide(text);

  const moderateImage: StoryGenerationProvider["moderateImage"] = async (prompt) => {
    if (prompt.includes(UNSAFE)) return { safe: false, reason: "unsafe-content" };
    // FR-004: reject a prompt that lacks the shared style marker — an
    // inconsistent illustration set is not a valid candidate.
    if (!prompt.includes(STYLE_DESCRIPTOR)) {
      return { safe: false, reason: "inconsistent-illustration-set" };
    }
    return { safe: true };
  };

  const fake: FakeProvider = {
    provider: { generateStory, moderateText, moderateImage },
    requests,
    get generateCalls() {
      return generateCalls;
    },
    reset: () => {
      generateCalls = 0;
      requests.length = 0;
    },
  };
  return fake;
}
