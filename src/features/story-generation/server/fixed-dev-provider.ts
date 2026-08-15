import "server-only";
import type {
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * Optional artificial latency so the story-request loading/progress screen is
 * visible during local fake-mode runs (`STORIES_TEST_MODE=fake` + `pnpm dev`).
 *
 * Controlled by `STORY_FAKE_DELAY_MS` (default 9000ms per fake call). The story
 * fetch is one call plus the scene illustrations; a per-call delay of ~9000ms
 * makes the overall fake generation last ~18s so the loading screen advances
 * through its elapsed-based stages (writing→illustrating→reviewing) and each
 * step is seen completing. Disabled under tests (`NODE_ENV=test`, set by Vitest)
 * so the unit suite stays fast and deterministic.
 */
function fakeModeDelay(): Promise<void> {
  if (process.env.NODE_ENV === "test") return Promise.resolve();
  const ms = Number(process.env.STORY_FAKE_DELAY_MS ?? "9000");
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Per-theme anonymous copy (pt-BR). Each story is a distinct positive direction. */
const THEME_PT: Record<
  string,
  { title: string; opener: string; mid1: string; mid2: string; mid3: string; closing: string }
> = {
  courage: {
    title: "A estrelinha e o mar",
    opener: "Era uma vez uma estrelinha que morava no céu e sonhava em conhecer o mar.",
    mid1: "Naquela noite, a estrelinha brilhou mais forte e desceu devagar até a areia da praia.",
    mid2: "Na praia, a estrelinha conheceu uma conchinha curiosa e aprenderam a brincar juntas.",
    mid3: "Quando o vento levantou, as duas se aconchegaram na areia para esperar a noite passar.",
    closing:
      "No fim, a estrelinha voltou ao céu feliz, levando a amizade consigo no coração — e o mar guardou a conchinha até o próximo encontro.",
  },
  friendship: {
    title: "A estrelinha e o mar",
    opener:
      "Era uma vez uma estrelinha que morava no céu e fazia amizades com todos que encontrava.",
    mid1: "Ao descer para a praia, encontrou uma conchinha solitária e logo criaram um laço.",
    mid2: "Na praia, as duas aprendiam a ouvir e a partilhar segredos doces.",
    mid3: "Quando o vento levantou, a amizade as manteve unidas, aconchegadas na areia.",
    closing:
      "No fim, a estrelinha voltou ao céu feliz, levando a amizade consigo — e o mar guardou a conchinha até o próximo encontro.",
  },
  kindness: {
    title: "A estrelinha bondosa",
    opener: "Era uma vez uma estrelinha do céu que gostava de cuidar de quem precisava.",
    mid1: "Ao ver uma conchinha triste na areia, ofereceu seu brilho para acalentá-la.",
    mid2: "Pequenos gestos de cuidado se espalharam: um carinho aqui, uma ajuda ali.",
    mid3: "Mesmo cansada, a estrelinha dedicada um tempinho a cada amigo da praia.",
    closing:
      "No fim, a estrelinha voltou ao céu com o coração leve, sabendo que a bondade torna o mundo mais acolhedor.",
  },
  curiosity: {
    title: "A estrelinha curiosa",
    opener:
      "Era uma vez uma estrelinha no céu que fazia muitas perguntas e queria descobrir o mundo.",
    mid1: "Curiosa, desceu até o mar para entender o que havia além do brilho.",
    mid2: "Com a conchinha, exploraram conchas, criaturas e estranhos sons da praia.",
    mid3: "Cada pergunta abria uma porta nova de aprendizado e encanto.",
    closing:
      "No fim, a estrelinha voltou ao céu cheia de novas perguntas, certa de que curiosidade é o começo de toda descoberta.",
  },
  perseverance: {
    title: "A estrelinha persistente",
    opener: "Era uma vez uma estrelinha que decidiu, apesar de tudo, atravessar o céu até o mar.",
    mid1: "Quando o vento a empurrava de volta, ela tentava de novo, uma e outra vez.",
    mid2: "Cada tentativa a deixava mais forte e mais perto do seu sonho.",
    mid3: "Mesmo quando parecia impossível, ela se levantava e continuava.",
    closing:
      "No fim, a estrelinha alcançou o mar com lágrimas de alegria, provando que quem insiste nunca desiste do sonho.",
  },
  empathy: {
    title: "A estrelinha empática",
    opener: "Era uma vez uma estrelinha que sabia sentir o que os outros carregavam no coração.",
    mid1: "Ao ver a conchinha preocupada, parou para escutar e entender seus medos.",
    mid2: "Colocou-se no lugar da amiga e descobriu o que ela precisava para se sentir bem.",
    mid3: "Suas palavras gentis fizeram a conchinha se sentir compreendida e segura.",
    closing:
      "No fim, a estrelinha voltou ao céu sabendo que empatia é o poder de acolher quem ama, sentindo com o outro.",
  },
};

/** Per-theme anonymous copy (en). */
const THEME_EN: Record<
  string,
  { title: string; opener: string; mid1: string; mid2: string; mid3: string; closing: string }
> = {
  courage: {
    title: "The Little Star and the Sea",
    opener: "Once there was a little star that lived in the sky and dreamed of meeting the sea.",
    mid1: "That night, the little star shone brighter and slowly came down to the sandy beach.",
    mid2: "On the beach, the little star met a curious little shell and they learned to play together.",
    mid3: "When the wind picked up, the two cuddled together on the sand to wait out the night.",
    closing:
      "In the end, the little star went back up to the sky happy, carrying friendship in its heart — and the sea kept the little shell until their next meeting.",
  },
  friendship: {
    title: "The Little Star and the Sea",
    opener: "Once there was a little star in the sky who made friends with everyone it met.",
    mid1: "Coming down to the beach, it found a lonely little shell and they formed a warm bond.",
    mid2: "On the beach the two learned to listen and share sweet secrets.",
    mid3: "When the wind picked up, friendship kept them together, cuddled on the sand.",
    closing:
      "In the end, the little star returned to the sky happy, carrying friendship in its heart — and the sea kept the little shell until their next meeting.",
  },
  kindness: {
    title: "The Kind Little Star",
    opener: "Once there was a little star in the sky who loved to care for those in need.",
    mid1: "Seeing a sad little shell on the sand, it offered its glow to comfort it.",
    mid2: "Small caring gestures spread: a kind touch here, a helpful hand there.",
    mid3: "Even when tired, the little star spent time with each beach friend.",
    closing:
      "In the end, the little star returned to the sky with a light heart, knowing kindness makes the world more welcoming.",
  },
  curiosity: {
    title: "The Curious Little Star",
    opener:
      "Once there was a little star in the sky who asked many questions and wanted to discover the world.",
    mid1: "Curious, it came down to the sea to understand what lay beyond its glow.",
    mid2: "With the little shell, they explored shells, creatures, and strange beach sounds.",
    mid3: "Every question opened a new door of learning and wonder.",
    closing:
      "In the end, the little star returned to the sky full of new questions, sure that curiosity is where every discovery begins.",
  },
  perseverance: {
    title: "The Persistent Little Star",
    opener:
      "Once there was a little star who decided, despite everything, to cross the sky to the sea.",
    mid1: "When the wind pushed it back, it tried again, over and over.",
    mid2: "Each attempt made it stronger and closer to its dream.",
    mid3: "Even when it seemed impossible, it stood up and kept going.",
    closing:
      "In the end, the little star reached the sea with tears of joy, proving that whoever keeps trying never gives up on a dream.",
  },
  empathy: {
    title: "The Empathetic Little Star",
    opener: "Once there was a little star who could feel what others carried in their hearts.",
    mid1: "Seeing the little shell worried, it stopped to listen and understand its fears.",
    mid2: "It put itself in its friend's place and found out what made it feel at ease.",
    mid3: "Its kind words made the little shell feel understood and safe.",
    closing:
      "In the end, the little star returned to the sky knowing empathy is the power to welcome those you love by feeling with them.",
  },
};

function safeOrUnsafe(text: string): ModerationDecision {
  return text.includes(UNSAFE_MARKER)
    ? { safe: false, reason: "classifier" }
    : { safe: true, reason: undefined };
}

function ptBRStory(sceneCount: number, theme: string) {
  const idiom = THEME_PT[theme] ?? THEME_PT["courage"]!;
  const opener = [
    {
      ordinal: 1,
      title: "Cena 1 — O sonho",
      body: idiom.opener,
      illustrationPrompt:
        "watercolor illustration, a small star beside a crescent moon above the sea at night",
    },
    {
      ordinal: 2,
      title: "Cena 2 — A viagem",
      body: idiom.mid1,
      illustrationPrompt:
        "watercolor illustration, a star descending over the waves toward a sandy beach",
    },
  ];
  const middle = [
    {
      title: "Cena 3 — A descoberta",
      body: idiom.mid2,
      illustrationPrompt:
        "watercolor illustration, a star and a little shell playing by the waterline",
    },
    {
      title: "Cena 4 — A tempestade",
      body: idiom.mid3,
      illustrationPrompt:
        "watercolor illustration, a star and a shell nestled together on the sand as wind rises",
    },
  ];
  const closing = {
    title: "Cena 5 — O regresso",
    body: idiom.closing,
    illustrationPrompt:
      "watercolor illustration, a happy star rising back into the night sky above the sea",
  };
  return buildStory(sceneCount, idiom.title, opener, middle, closing);
}

function enStory(sceneCount: number, theme: string) {
  const idiom = THEME_EN[theme] ?? THEME_EN["courage"]!;
  const opener = [
    {
      ordinal: 1,
      title: "Scene 1 — The Dream",
      body: idiom.opener,
      illustrationPrompt:
        "watercolor illustration, a small star beside a crescent moon above the sea at night",
    },
    {
      ordinal: 2,
      title: "Scene 2 — The Journey",
      body: idiom.mid1,
      illustrationPrompt:
        "watercolor illustration, a star descending over the waves toward a sandy beach",
    },
  ];
  const middle = [
    {
      title: "Scene 3 — The Discovery",
      body: idiom.mid2,
      illustrationPrompt:
        "watercolor illustration, a star and a little shell playing by the waterline",
    },
    {
      title: "Scene 4 — The Storm",
      body: idiom.mid3,
      illustrationPrompt:
        "watercolor illustration, a star and a shell nestled together on the sand as wind rises",
    },
  ];
  const closing = {
    title: "Scene 5 — The Return",
    body: idiom.closing,
    illustrationPrompt:
      "watercolor illustration, a happy star rising back into the night sky above the sea",
  };
  return buildStory(sceneCount, idiom.title, opener, middle, closing);
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
      await fakeModeDelay();
      return input.locale === "en"
        ? enStory(input.sceneCount, input.theme)
        : ptBRStory(input.sceneCount, input.theme);
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
  return async () => {
    await fakeModeDelay();
    return { dataUri: FIXED_ILLUSTRATION_DATA_URI };
  };
}
