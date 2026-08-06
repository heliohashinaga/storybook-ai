import {
  ProviderError,
  type GeneratedStoryCandidate,
  type ModerationDecision,
  type ProviderStoryInput,
  type StoryGenerationProvider,
} from "../../../src/features/story-generation/server/story-generation-provider";

/**
 * Deterministic fake provider for tests. Never calls a live AI service and
 * records only the anonymous input (ageBand/locale/theme) — never an exact
 * age or any direct identifier.
 */

/** Marker content that the fake's moderation rejects by default. */
const UNSAFE = "unsafecontent";

function scene(ordinal: number): {
  ordinal: number;
  title: string;
  body: string;
  illustrationPrompt: string;
} {
  return {
    ordinal,
    title: `Título ${ordinal}`,
    body: `Corpo da cena ${ordinal}.`,
    illustrationPrompt: `ilustração da cena ${ordinal}`,
  };
}

export function buildSafeCandidate(input: ProviderStoryInput): GeneratedStoryCandidate {
  return {
    title: `Uma história de ${input.theme}`,
    scenes: [scene(1), scene(2), scene(3)],
  };
}

export type FakeScenario =
  "safe" | "unsafe-then-safe" | "double-unsafe" | "unavailable" | "timeout" | "invalid";

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

    const unsafeFirst = scenario === "unsafe-then-safe" || scenario === "double-unsafe";
    if (unsafeFirst && generateCalls === 1) {
      const bad = buildSafeCandidate(input);
      return {
        title: bad.title,
        scenes: bad.scenes.map((s, i) => (i === 0 ? { ...s, body: `${s.body} ${UNSAFE}` } : s)),
      };
    }
    if (scenario === "double-unsafe" && generateCalls === 2) {
      const bad = buildSafeCandidate(input);
      return {
        title: bad.title,
        scenes: bad.scenes.map((s) => ({ ...s, body: `${s.body} ${UNSAFE}` })),
      };
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

  const moderateImage: StoryGenerationProvider["moderateImage"] = async (prompt) => decide(prompt);

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
