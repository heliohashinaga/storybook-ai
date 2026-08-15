import "server-only";
import type { ProviderStoryInput } from "../story-generation-provider";

export const NARRATIVE_SYSTEM_PROMPT = [
  "You are an author of safe, age-appropriate children's books.",
  "You write only short fictional stories. You never use real names or any",
  "personal or identifying information.",
  "Respond with a single JSON object only — no prose, no markdown.",
].join(" ");

export function narrativeUserPrompt(input: ProviderStoryInput): string {
  const language = input.locale === "en" ? "English" : "Brazilian Portuguese";
  return JSON.stringify({
    task: "Write a short children's story.",
    locale: input.locale,
    ai: `Write the story in ${language}.`,
    ageBand: input.ageBand,
    theme: input.theme,
    scenes: {
      count: input.sceneCount,
      requirement:
        `Exactly ${input.sceneCount} scenes. Each scene has a positive, child-safe arc. ` +
        "The last scene must end with a definite closing or resolution sentence, " +
        "never cutting off mid-story.",
    },
    style:
      "Warm, playful, gentle. Every illustration prompt must describe the same " +
      "characters in a soft watercolor style so the set stays visually consistent.",
    rules: [
      "Never include names or any personal identifying details.",
      "Keep it age-appropriate and non-scary for the given age band.",
      "Make each scene body a few short sentences.",
      "Each illustrationPrompt must be a detailed visual prompt (soft watercolor).",
    ],
    output_schema: {
      title: "string — story title",
      scenes: [
        {
          ordinal: "int, 1-based",
          title: "string — scene title",
          body: "string — scene body",
          illustrationPrompt: "string — watercolor illustration prompt",
        },
      ],
    },
  });
}

export const MODERATION_SYSTEM_PROMPT = [
  "You are a strict safety classifier for children's content.",
  "Given content, reply with a single JSON object only:",
  '{"safe": true|false, "reason": string|null}.',
  "Mark unsafe if it contains violence, fear, horror, inappropriate or sexual",
  "content, drugs, self-harm, hateful themes, or any direct personal identifier",
  "(for example a child's name).",
  '"reason" is a short category string, or null when safe.',
].join(" ");
