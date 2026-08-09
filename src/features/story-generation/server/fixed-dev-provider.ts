import "server-only";
import type {
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * Deterministic development provider (T036).
 *
 * Used only when the server is explicitly started with `STORIES_PROVIDER=fake`
 * (e2e/visual/dev runs) — never the production default. It never calls a live
 * AI service: it returns the same approved pt-BR three-scene story and the
 * same safe moderation verdicts every time, so Playwright journeys are
 * reproducible. Copy is anonymous: no character names, identifiers, or
 * template markers; diacritics deliberately present to prove the response is
 * fully localized, never interpolated.
 */

/** 64×64 valid WebP (star + moon), generated once with sharp — deterministic. */
export const FIXED_ILLUSTRATION_DATA_URI =
  "data:image/webp;base64,UklGRlYBAABXRUJQVlA4IEoBAAAwCgCdASpAAEAAPm0ukkYkIqGhMBgJAIANiWQAeHP2D8ZvxVpx/yAbwBuAN0A/1X8A4ADypf1y+Dz9VfSGJno2Bq03C/00ZYMIBTrtM3ITRkFw0vtxIuGzcAAA/txR///dk4krC/lMWqaisTwpjXu/iRvmUHuRiNULqZEa7C6sYx07z//yK2NZhOziV+fkiSzSChI+SVXkGjtf/zXb+UeWeI+pm4U5kmzQY8pTDLJ5wFDPuveE4cb0++Ddp1tZjO36a/L5O9M0wa8KY27CqriY3EmOQ2TUxBPJnlaK4+OEDF9uGJYgyi/FE3+g5HSGjFji6wg5kScZ45s2oY2DfCfiuwxZix/jYKmKPprDy5/fySufeWw0F/U4Ed/8W9xI8hNJYyMin7sAZj7QdJT6X9j28Ffvs/2/5gzTTDcDshJ2Gz0MXdQAxgAAAAA=";

/** Marker that makes moderation reject the candidate (mirrors test fixtures). */
export const UNSAFE_MARKER = "unsafecontent";

function safeOrUnsafe(text: string): ModerationDecision {
  return text.includes(UNSAFE_MARKER)
    ? { safe: false, reason: "classifier" }
    : { safe: true, reason: undefined };
}

export function createFixedDevProvider(): StoryGenerationProvider {
  return {
    async generateStory(_input: ProviderStoryInput) {
      return {
        title: "A estrelinha e o mar",
        scenes: [
          {
            ordinal: 1,
            title: "Cena 1 — O sonho",
            body: "Era uma vez uma estrelinha que morava no céu e sonhava em conhecer o mar.",
            illustrationPrompt:
              "watercolor illustration, a small star beside a crescent moon above the sea at night",
          },
          {
            ordinal: 2,
            title: "Cena 2 — A viagem",
            body: "Naquela noite, a estrelinha brilhou mais forte e desceu devagar até a areia da praia.",
            illustrationPrompt:
              "watercolor illustration, a star descending over the waves toward a sandy beach",
          },
          {
            ordinal: 3,
            title: "Cena 3 — O regresso",
            body: "No fim, a estrelinha voltou ao céu feliz, levando a amizade consigo no coração.",
            illustrationPrompt:
              "watercolor illustration, a happy star rising back into the night sky above the sea",
          },
        ],
      };
    },
    async moderateText(text: string) {
      return safeOrUnsafe(text);
    },
    async moderateImage(prompt: string) {
      return safeOrUnsafe(prompt);
    },
  };
}

export function createFixedDevIllustration() {
  return async () => ({ dataUri: FIXED_ILLUSTRATION_DATA_URI });
}
