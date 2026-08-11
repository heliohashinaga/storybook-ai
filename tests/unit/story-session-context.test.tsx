import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { act, render } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import {
  StorySessionProvider,
  useStorySession,
} from "../../src/features/story-request/client/story-session-context";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";

const approvedStory: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  safetyDecision: "approved",
  title: "A missão da estrelinha",
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: "Texto da cena 1.",
      illustrationDataUri: "data:image/webp;base64,QUJDRA",
      altText: "Ilustração da cena 1.",
    },
    {
      ordinal: 2,
      title: "Cena 2",
      body: "Texto da cena 2.",
      illustrationDataUri: "data:image/webp;base64,QUJDRA",
      altText: "Ilustração da cena 2.",
    },
    {
      ordinal: 3,
      title: "Cena 3",
      body: "Texto da cena 3.",
      illustrationDataUri: "data:image/webp;base64,QUJDRA",
      altText: "Ilustração da cena 3.",
    },
  ],
};

const tryLater = {
  code: "rate_limited" as const,
  messageKey: "story.error.tryAgainLater",
  retryable: true,
};

function capture(): { view: ReactNode; read: () => ReturnType<typeof useStorySession> } {
  let read!: ReturnType<typeof useStorySession>;
  const view = <SessionProbe onRender={(v) => (read = v)} />;
  return { view, read: () => read };
}

function SessionProbe({ onRender }: { onRender: (v: ReturnType<typeof useStorySession>) => void }) {
  const session = useStorySession();
  onRender(session);
  return null;
}

function run(
  action: (session: ReturnType<typeof useStorySession>) => void,
  read: () => ReturnType<typeof useStorySession>
) {
  act(() => action(read()));
}

describe("story session context — in-memory state machine", () => {
  it("starts idle with no active story and no failure", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);
    const session = read();
    expect(session.status).toBe("idle");
    expect(session.story).toBeNull();
    expect(session.failure).toBeNull();
  });

  it("begin() moves to submitting and clears a previous failure", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);
    run((s) => s.fail(tryLater), read);
    expect(read().status).toBe("failed");

    run((s) => s.begin(), read);
    const after = read();
    expect(after.status).toBe("submitting");
    expect(after.failure).toBeNull();
    expect(after.story).toBeNull();
  });

  it("succeed(story) moves to success and exposes the approved story", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.begin(), read);
    run((s) => s.succeed(approvedStory), read);

    const after = read();
    expect(after.status).toBe("success");
    expect(after.story).toEqual(approvedStory);
    expect(after.failure).toBeNull();
  });

  it("fail(error) moves to failed and keeps the typed sanitized failure", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.begin(), read);
    run((s) => s.fail(tryLater), read);

    const after = read();
    expect(after.status).toBe("failed");
    expect(after.failure).toEqual(tryLater);
    expect(after.story).toBeNull();
  });

  it("reset() discards the active story and returns to idle", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.begin(), read);
    run((s) => s.succeed(approvedStory), read);
    expect(read().status).toBe("success");

    run((s) => s.reset(), read);

    const after = read();
    expect(after.status).toBe("idle");
    expect(after.story).toBeNull();
    expect(after.failure).toBeNull();
  });

  it("keeps state across re-renders and across StrictMode", async () => {
    const { view, read } = capture();
    render(
      <StrictMode>
        <StorySessionProvider>{view}</StorySessionProvider>
      </StrictMode>
    );
    run((s) => s.begin(), read);
    run((s) => s.succeed(approvedStory), read);
    expect(read().status).toBe("success");
    expect(read().story?.title).toBe("A missão da estrelinha");
  });

  it("throws when the hook is used outside the provider", async () => {
    function ThrowingProbe() {
      useStorySession();
      return null;
    }
    expect(() => render(<ThrowingProbe />)).toThrow(/StorySessionProvider/);
  });
});

describe("story session context — privacy (no state serialization)", () => {
  it("never references localStorage, sessionStorage, or cookies (static scan)", () => {
    const source = readFileSync(
      `${process.cwd()}/src/features/story-request/client/story-session-context.tsx`,
      "utf8"
    );

    for (const forbidden of ["localStorage", "sessionStorage", "document.cookie", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("story session context — multi-story (T045/T048)", () => {
  const secondStory: GeneratedStory = {
    ...approvedStory,
    title: "O segredo da floresta",
    scenes: approvedStory.scenes.map((s) => ({ ...s })),
  };
  const thirdStory: GeneratedStory = {
    ...approvedStory,
    title: "A viagem ao espaço",
    scenes: approvedStory.scenes.map((s) => ({ ...s })),
  };

  it("appends stories newest-first and active is the newest (generate another)", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory), read);
    run((s) => s.succeed(secondStory), read);

    const after = read();
    expect(after.status).toBe("success");
    // Newest-first ordering; the active (and compat `story`) is the newest.
    expect(after.stories.map((st) => st.story.title)).toEqual([
      "O segredo da floresta",
      "A missão da estrelinha",
    ]);
    expect(after.activeStory?.title).toBe("O segredo da floresta");
    expect(after.story?.title).toBe("O segredo da floresta");
    expect(after.stories).toHaveLength(2);
  });

  it("simply adding more stories has no story-count cap", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    for (const st of [approvedStory, secondStory, thirdStory]) {
      run((s) => s.succeed(st), read);
    }

    expect(read().stories).toHaveLength(3);
    expect(read().activeStory?.title).toBe("A viagem ao espaço");
  });

  it("accessStory(id) selects an earlier story without replacing the list", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory), read);
    run((s) => s.succeed(secondStory), read);
    const stories = read().stories;
    const firstId = stories.find((st) => st.story.title === approvedStory.title)?.id;

    run((s) => s.accessStory(firstId!), read);

    const after = read();
    expect(after.activeStory?.title).toBe("A missão da estrelinha");
    expect(after.activeId).toBe(firstId);
    // The appended list is unchanged and still newest-first.
    expect(after.stories.map((st) => st.story.title)).toEqual([
      "O segredo da floresta",
      "A missão da estrelinha",
    ]);
  });

  it("begin() keeps the in-memory story list (does not clear it)", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory), read);
    run((s) => s.begin(), read);

    const after = read();
    expect(after.status).toBe("submitting");
    expect(after.stories).toHaveLength(1);
    expect(after.activeStory?.title).toBe("A missão da estrelinha");
  });

  it("reset() clears every story (active and history) and returns to idle", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory), read);
    run((s) => s.succeed(secondStory), read);
    run((s) => s.reset(), read);

    const after = read();
    expect(after.status).toBe("idle");
    expect(after.stories).toHaveLength(0);
    expect(after.activeStory).toBeNull();
    expect(after.activeId).toBeNull();
    expect(after.story).toBeNull();
  });

  it("succeed() stores lastPreferences for generate-another reuse (T050)", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory, { age: 7, locale: "en", theme: "friendship" }), read);
    run((s) => s.succeed(secondStory), read);

    const after = read();
    expect(after.lastPreferences).toEqual({ age: 7, locale: "en", theme: "friendship" });
    // succeed without prefs keeps the previously stored prefs (T050 reuse).
    expect(after.stories).toHaveLength(2);
  });

  it("reset() clears lastPreferences too", async () => {
    const { view, read } = capture();
    render(<StorySessionProvider>{view}</StorySessionProvider>);

    run((s) => s.succeed(approvedStory, { age: 5, locale: "pt-BR", theme: "courage" }), read);
    run((s) => s.reset(), read);

    expect(read().lastPreferences).toBeNull();
  });

  it("clears the session on a full reload (in-memory only, never rehydrated)", async () => {
    // Build a populated session across a page-load lifetime: an approved story
    // plus stored preferences and a second story.
    const first = capture();
    const { unmount } = render(<StorySessionProvider>{first.view}</StorySessionProvider>);
    run((s) => s.succeed(approvedStory, { age: 7, locale: "en", theme: "kindness" }), first.read);
    run((s) => s.succeed(secondStory), first.read);
    expect(first.read().status).toBe("success");
    expect(first.read().stories).toHaveLength(2);
    expect(first.read().lastPreferences).toEqual({ age: 7, locale: "en", theme: "kindness" });

    // A full page reload tears the provider tree down and rebuilds it WITHOUT
    // any storage rehydration — the state lives only in React memory, so no
    // exact age, story, or preference survives the reload.
    unmount();

    const reloaded = capture();
    render(<StorySessionProvider>{reloaded.view}</StorySessionProvider>);
    const after = reloaded.read();
    expect(after.status).toBe("idle");
    expect(after.stories).toHaveLength(0);
    expect(after.activeStory).toBeNull();
    expect(after.activeId).toBeNull();
    expect(after.story).toBeNull();
    expect(after.lastPreferences).toBeNull();
    expect(after.failure).toBeNull();
  });
});
