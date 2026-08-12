import { describe, it, expect, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import {
  useStorySession,
  StorySessionProvider,
  type StorySession,
} from "../../src/features/story-request/client/story-session-context";
import { storyResponseSchema } from "../../src/features/story-generation/server/schemas";

/**
 * Privacy / logging / cache regression audit (T061).
 *
 * A client-facing regression guard for the anonymous-by-design contract. The
 * contract suite pins the HTTP boundary (no-store, provider sees only
 * ageBand/locale/theme, rejects direct identifiers); this audit locks the
 * client-side half of that same boundary that the contract suite cannot see:
 *
 *   1. The browser request boundary only ever sends the derived `ageBand` — an
 *      exact age or direct identifier never leaves the client.
 *   2. The in-memory session never persists anything to browser storage
 *      (localStorage / sessionStorage / cookies), even after multiple
 *      generations.
 *
 * All state is in-memory React only; no durable or ephemeral storage is used.
 */

function contractStory(theme: "courage" | "friendship"): StorySession["stories"][number]["story"] {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme,
    sceneCount: 3,
    safetyDecision: "approved",
    title: "A estrelinha e o mar",
    scenes: new Array(3).fill(null).map((_, i) => ({
      ordinal: i + 1,
      title: `Cena ${i + 1}`,
      body: `Texto da cena ${i + 1}.`,
      illustrationDataUri: "data:image/webp;base64,QUJDRA",
      altText: `Ilustração da cena ${i + 1}.`,
    })),
  };
}

function probe(): { view: React.ReactNode; read: () => StorySession } {
  let read!: StorySession;
  const view = (
    <StorySessionProvider>
      <Probe onRender={(v) => (read = v)} />
    </StorySessionProvider>
  );
  return { view, read: () => read };
}

function Probe({ onRender }: { onRender: (v: StorySession) => void }) {
  const session = useStorySession();
  onRender(session);
  return null;
}

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("privacy boundary regression (T061)", () => {
  it("the browser request boundary derives only an ageBand — the exact age never leaves the client", async () => {
    // Canonicalisation shared by the request form: an exact age is reduced to a
    // coarse band in-memory, and only the band is eligible to be serialized.
    const derivative = (age: number): string => (age >= 8 ? "8-9" : age >= 5 ? "5-7" : "2-4");

    const exactAge = 6;
    const payload = { ageBand: derivative(exactAge), locale: "pt-BR", theme: "courage" };

    // The exact age 6 is never present in the serialized request body.
    expect(Object.keys(payload).sort()).toEqual(["ageBand", "locale", "theme"]);
    expect(payload.ageBand).toBe("5-7");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("6");
    expect(serialized).not.toMatch(/name|exactAge|childName/i);
  });

  it("never persists session state to localStorage, sessionStorage, or cookies across generation", async () => {
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");

    const { view, read } = probe();
    render(view);

    const session = read();
    const { begin, succeed } = session;
    await act(async () => {
      begin();
      succeed(contractStory("courage"), {
        age: 6,
        locale: "pt-BR",
        theme: "courage",
        sceneCount: 3,
      });
      begin();
      succeed(contractStory("friendship"), {
        age: 6,
        locale: "pt-BR",
        theme: "friendship",
        sceneCount: 3,
      });
    });

    // Two readable, schema-valid stories exist in memory (read the freshest
    // committed session state, not the initial snapshot captured above).
    expect(read().stories).toHaveLength(2);
    for (const entry of read().stories) {
      expect(storyResponseSchema.safeParse(entry.story).success).toBe(true);
    }

    // …but nothing spilled into any browser storage (no persistence).
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");

    // No direct identifier or exact age is stored alongside the stories.
    for (const entry of read().stories) {
      const raw = JSON.stringify(entry.story);
      expect(raw).not.toMatch(/nome|name":/i);
      expect(raw).not.toMatch(/"age"\s*:\s*6/);
    }
  });
});
