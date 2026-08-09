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
