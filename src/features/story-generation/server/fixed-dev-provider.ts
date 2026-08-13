import "server-only";
import type {
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * Deterministic development provider (T036).
 *
 * Used only when the server is explicitly started with `STORIES_TEST_MODE=fake`
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

function ptBRStory(sceneCount: number) {
  const opener = [
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
  ];
  const middle = [
    {
      title: "Cena 3 — A descoberta",
      body: "Na praia, a estrelinha conheceu uma conchinha curiosa e aprenderam a brincar juntas.",
      illustrationPrompt:
        "watercolor illustration, a star and a little shell playing by the waterline",
    },
    {
      title: "Cena 4 — A tempestade",
      body: "Quando o vento levantou, as duas se aconchegaram na areia para esperar a noite passar.",
      illustrationPrompt:
        "watercolor illustration, a star and a shell nestled together on the sand as wind rises",
    },
  ];
  const closing = {
    title: "Cena 5 — O regresso",
    body: "No fim, a estrelinha voltou ao céu feliz, levando a amizade consigo no coração — e o mar guardou a conchinha até o próximo encontro.",
    illustrationPrompt:
      "watercolor illustration, a happy star rising back into the night sky above the sea",
  };
  return buildStory(sceneCount, "A estrelinha e o mar", opener, middle, closing);
}

function enStory(sceneCount: number) {
  const opener = [
    {
      ordinal: 1,
      title: "Scene 1 — The Dream",
      body: "Once there was a little star that lived in the sky and dreamed of meeting the sea.",
      illustrationPrompt:
        "watercolor illustration, a small star beside a crescent moon above the sea at night",
    },
    {
      ordinal: 2,
      title: "Scene 2 — The Journey",
      body: "That night, the little star shone brighter and slowly came down to the sandy beach.",
      illustrationPrompt:
        "watercolor illustration, a star descending over the waves toward a sandy beach",
    },
  ];
  const middle = [
    {
      title: "Scene 3 — The Discovery",
      body: "On the beach, the little star met a curious little shell and they learned to play together.",
      illustrationPrompt:
        "watercolor illustration, a star and a little shell playing by the waterline",
    },
    {
      title: "Scene 4 — The Storm",
      body: "When the wind picked up, the two cuddled together on the sand to wait out the night.",
      illustrationPrompt:
        "watercolor illustration, a star and a shell nestled together on the sand as wind rises",
    },
  ];
  const closing = {
    title: "Scene 5 — The Return",
    body: "In the end, the little star went back up to the sky happy, carrying friendship in its heart — and the sea kept the little shell until their next meeting.",
    illustrationPrompt:
      "watercolor illustration, a happy star rising back into the night sky above the sea",
  };
  return buildStory(sceneCount, "The Little Star and the Sea", opener, middle, closing);
}

/**
 * Deterministically composes `sceneCount` scenes (3–5) from the opener, an
 * optional set of middle scenes, and a fixed closing scene. Ordinals are
 * re-derived sequentially so the story is always valid and the final scene is
 * a definite closing/resolution (SC-002 fecho), never a cut-off.
 */
function buildStory(
  sceneCount: number,
  title: string,
  opener: Array<{ title: string; body: string; illustrationPrompt: string }>,
  middle: Array<{ title: string; body: string; illustrationPrompt: string }>,
  closing: { title: string; body: string; illustrationPrompt: string }
) {
  const body = [...opener];
  const needMiddle = sceneCount - 3;
  if (needMiddle > 0) {
    body.push(...middle.slice(0, Math.min(needMiddle, middle.length)));
  }
  body.push(closing);
  const scenes = body.slice(0, sceneCount).map((s, i) => ({
    ordinal: i + 1,
    title: s.title,
    body: s.body,
    illustrationPrompt: s.illustrationPrompt,
  }));
  return { title, scenes };
}

export function createFixedDevProvider(): StoryGenerationProvider {
  return {
    async generateStory(input: ProviderStoryInput) {
      return input.locale === "en" ? enStory(input.sceneCount) : ptBRStory(input.sceneCount);
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
