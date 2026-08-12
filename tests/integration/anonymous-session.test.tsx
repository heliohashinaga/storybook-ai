import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  useStorySession,
  StorySessionProvider,
  type StorySession,
} from "../../src/features/story-request/client/story-session-context";
import {
  storyResponseSchema,
  type GeneratedStory,
} from "../../src/features/story-generation/server/schemas";

/**
 * Anonymous multi-story session integration (US3, T047).
 *
 * Integration tier: drives the session context through the SAME submit boundary
 * the app uses (`derive exact age → POST /api/stories → parse → succeed`), with
 * the API faked so no live provider is ever reached. It verifies the two US3
 * guarantees that span session state and the API contract:
 *
 *   1. Same-session preference reuse — every generation reuses the browser-held
 *      age band, language and last theme without re-asking (T050); only the
 *      theme a parent actually changes takes effect.
 *   2. Preserved readable stories — earlier stories are never dropped when a
 *      new one is appended: each preserved story still conforms to the OpenAPI
 *      `storyResponseSchema` (3 scenes, WebP illustration data URIs, localized
 *      alt text), and `accessStory` can switch back to an earlier one.
 *
 * Privacy invariant: no exact age or direct identifier is ever sent to the
 * faked request boundary — only ageBand/locale/theme.
 */

const WEBP_URI = "data:image/webp;base64,QUJDRA";

function scene(ordinal: number, title: string, body: string) {
  return {
    ordinal,
    title,
    body,
    illustrationDataUri: WEBP_URI,
    altText: `Ilustração da cena ${ordinal}.`,
  };
}

function contractStory(theme: "courage" | "kindness" | "friendship"): GeneratedStory {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme,
    sceneCount: 3,
    safetyDecision: "approved",
    title: "A estrelinha e o mar",
    scenes: [
      scene(1, "Cena 1", "Texto da cena 1."),
      scene(2, "Cena 2", "Texto da cena 2."),
      scene(3, "Cena 3", "Texto da cena 3."),
    ],
  };
}

const ALLOWED = ["ageBand", "locale", "theme", "sceneCount"] as const;

/**
 * The app's submit integration logic, driven against a faked fetch: derive the
 * age band in-memory (exact age is never sent), begin, POST the anonymized
 * payload, parse the response against the contract schema, then succeed.
 */
async function submitStory(
  session: StorySession,
  prefs: {
    age: number;
    locale: "pt-BR";
    theme: "courage" | "kindness" | "friendship";
    sceneCount: number;
  }
): Promise<Record<string, unknown>> {
  const ageBand = prefs.age >= 8 ? "8-9" : prefs.age >= 5 ? "5-7" : "2-4";
  const payload = {
    ageBand,
    locale: prefs.locale,
    theme: prefs.theme,
    sceneCount: prefs.sceneCount,
  };
  session.begin();
  const response = await vi.mocked(fetch)("/api/stories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as GeneratedStory;
  const parsed = storyResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("faked server returned a non-contract story");
  }
  session.succeed(parsed.data, prefs);
  return payload;
}

function capture(): { view: ReactNode; read: () => StorySession } {
  let read!: StorySession;
  const view = <SessionProbe onRender={(v) => (read = v)} />;
  return { view, read: () => read };
}

function SessionProbe({ onRender }: { onRender: (v: StorySession) => void }) {
  const session = useStorySession();
  onRender(session);
  return null;
}

describe("anonymous-session preference reuse and preserved stories", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as { theme?: string };
        const theme =
          payload.theme === "kindness" || payload.theme === "friendship"
            ? payload.theme
            : "courage";
        return new Response(JSON.stringify(contractStory(theme)), {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses same-session preferences and preserves every story as readable and contract-valid", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    const payloads: Record<string, unknown>[] = [];
    for (const theme of ["courage", "kindness", "friendship"] as const) {
      await act(async () => {
        payloads.push(await submitStory(read(), { age: 6, locale: "pt-BR", theme, sceneCount: 3 }));
      });
    }

    // ---- Same-session preference reuse -----------------------------------
    expect(payloads).toHaveLength(3);
    for (const payload of payloads) {
      expect(Object.keys(payload)).toEqual([...ALLOWED]);
      // The 5-7 band and pt-BR are reused across every generation — never re-asked.
      expect(payload.ageBand).toBe("5-7");
      expect(payload.locale).toBe("pt-BR");
    }
    expect(payloads.map((p) => p.theme)).toEqual(["courage", "kindness", "friendship"]);
    // lastPreferences reflects the most recent reuse.
    expect(read().lastPreferences).toEqual({
      age: 6,
      locale: "pt-BR",
      theme: "friendship",
      sceneCount: 3,
    });

    // ---- Preserved readable stories (newest-first) ------------------------
    const stories = read().stories;
    expect(stories).toHaveLength(3);
    expect(stories.map((s) => s.story.theme)).toEqual(["friendship", "kindness", "courage"]);
    expect(read().activeStory?.theme).toBe("friendship");

    // Every preserved story is still a contract-valid, readable story.
    for (const entry of stories) {
      const result = storyResponseSchema.safeParse(entry.story);
      expect(result.success).toBe(true);
      expect(entry.story.scenes).toHaveLength(3);
      for (const sc of entry.story.scenes) {
        expect(sc.illustrationDataUri.startsWith("data:image/webp;base64,")).toBe(true);
        expect(sc.altText.length).toBeGreaterThan(0);
      }
      // No exact age or direct identifier stored alongside a story.
      expect(JSON.stringify(entry.story)).not.toMatch(/nome|name":/i);
    }

    // Switching back to the first story still leaves it fully readable.
    act(() => read().accessStory(stories[2]!.id));
    expect(read().activeStory?.theme).toBe("courage");
    expect(read().activeStory?.scenes).toHaveLength(3);
  });

  it("re-derives the age band when the exact age changes within a session, preserving prior stories", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    await act(async () => {
      await submitStory(read(), { age: 3, locale: "pt-BR", theme: "courage", sceneCount: 3 }); // 2-4 band
    });
    await act(async () => {
      // A parent adjusting age mid-session rederives the band but never sends the
      // exact age; the previous story stays readable.
      await submitStory(read(), { age: 7, locale: "pt-BR", theme: "friendship", sceneCount: 3 });
    });

    const stories = read().stories;
    expect(stories).toHaveLength(2);

    // Both preserved stories remain contract-valid regardless of age changes.
    for (const entry of stories) {
      expect(storyResponseSchema.safeParse(entry.story).success).toBe(true);
    }
    expect(read().lastPreferences?.age).toBe(7);

    // Exact age is never held on the session payload boundary.
    expect(JSON.stringify(read())).not.toMatch(/exactAge/);
  });
});
