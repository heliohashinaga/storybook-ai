"use client";

import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui/button";
import type { Locale } from "../client/story-preferences-schema";
import { parseStoryResponse } from "../../story-reader/client/story-response";
import { StorySessionProvider, useStorySession } from "../client/story-session-context";
import {
  StoryRequestForm,
  type GenerateStoryRequest,
  type SubmitResult,
} from "./story-request-form";

/**
 * Request → story container (T033). Hosts the anonymous request form and the
 * first approved-story state. Submits only `ageBand`/`locale`/`theme`, parses
 * the response through `story-response` (typed, sanitized), and shows the
 * approved three-scene story locally in memory (never persisted).
 */
export function StoryRequestApp({ defaultLocale = "pt-BR" }: { defaultLocale?: Locale }) {
  return (
    <StorySessionProvider>
      <StoryRequestFlow defaultLocale={defaultLocale} />
    </StorySessionProvider>
  );
}

function StoryRequestFlow({ defaultLocale }: { defaultLocale: Locale }) {
  const t = useTranslations("story");
  const { story, begin, succeed, fail, reset } = useStorySession();

  async function handleSubmit(request: GenerateStoryRequest): Promise<SubmitResult> {
    begin();
    const response = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await parseStoryResponse(response);
    if (result.status === "success") {
      succeed(result.story);
      return { ok: true };
    }
    fail(result.error);
    return { ok: false, messageKey: result.error.messageKey.replace(/^story\.error\./, "") };
  }

  if (story) {
    return (
      <section className="flex flex-col gap-md" aria-labelledby="story-reader-title">
        <h1 id="story-reader-title" className="font-title text-title">
          {t("reader.title")}
        </h1>
        <p className="text-title">{story.title}</p>
        <ol className="flex flex-col gap-lg">
          {story.scenes.map((scene) => (
            <li key={scene.ordinal} className="flex flex-col gap-sm">
              <h2 className="font-title text-body">
                {t("reader.sceneLabel", { ordinal: scene.ordinal })} — {scene.title}
              </h2>
              {/* eslint-disable-next-line @next/next/no-img-element -- session-only WebP data-URI; not cachable or optimizable by next/image */}
              <img
                src={scene.illustrationDataUri}
                alt={scene.altText}
                className="aspect-square w-full rounded-md object-cover"
              />
              <p className="text-body">{scene.body}</p>
            </li>
          ))}
        </ol>
        <Button variant="secondary" onClick={reset}>
          {t("reader.newStory")}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-md">
      <h1 className="font-title text-title">{t("form.title")}</h1>
      <StoryRequestForm defaultLocale={defaultLocale} onSubmit={handleSubmit} />
    </section>
  );
}
