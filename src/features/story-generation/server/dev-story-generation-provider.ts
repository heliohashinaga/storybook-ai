import "server-only";
import type {
  GeneratedStoryCandidate,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * Deterministic development provider (pre-T024 interim). Produces a safe,
 * valid three-scene candidate and passes all moderation, so the generation
 * route and the E2E journey run without any live AI service. Swapped for the
 * OpenAI adapter in `generation-runtime` once T024 lands.
 */

function buildDevCandidate(input: ProviderStoryInput): GeneratedStoryCandidate {
  const isPt = input.locale === "pt-BR";
  return {
    title: isPt ? "A pequena aventura na ponte" : "A Little Adventure on the Bridge",
    scenes: [1, 2, 3].map((ordinal) => ({
      ordinal,
      title: isPt ? `Cena ${ordinal}` : `Scene ${ordinal}`,
      body: isPt
        ? `O personagem atravessa a ponte com coragem e ajuda os amigos na cena ${ordinal}.`
        : `The character crosses the bridge with courage and helps friends in scene ${ordinal}.`,
      illustrationPrompt: isPt
        ? `ilustração da cena ${ordinal} da história`
        : `illustration of scene ${ordinal} of the story`,
    })),
  };
}

export function createDevelopmentStoryProvider(): StoryGenerationProvider {
  return {
    async generateStory(input) {
      return buildDevCandidate(input);
    },
    async moderateText() {
      return { safe: true };
    },
    async moderateImage() {
      return { safe: true };
    },
  };
}

/** Deterministic, distinct WebP data-URI per call (session-only, safe). */
export function createDevelopmentIllustration() {
  let counter = 0;
  return async function illustrate(): Promise<{ dataUri: string }> {
    counter += 1;
    return { dataUri: `data:image/webp;base64,QUJDRA${counter}` };
  };
}
