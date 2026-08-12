import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import { StoryHistory } from "../../src/features/story-reader/components/story-history";
import type { StoryEntry } from "../../src/features/story-request/client/story-session-context";

const storyA: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  sceneCount: 3,
  safetyDecision: "approved" as const,
  title: "A missão da estrelinha",
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: "Era uma vez uma estrelinha.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Uma estrelinha.",
    },
    {
      ordinal: 2,
      title: "Cena 2",
      body: "Ela decidiu brilhar.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Brilhando.",
    },
    {
      ordinal: 3,
      title: "Cena 3",
      body: "E o mar a abraçou.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "O mar.",
    },
  ],
};
const storyB: GeneratedStory = {
  ...storyA,
  title: "O segredo da floresta",
};

function renderSwitcher(entries: StoryEntry[], activeId: string | null, onSelect = () => {}) {
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <StoryHistory storyEntries={entries} activeId={activeId} onSelect={onSelect} />
    </LocaleProvider>
  );
}

describe("StoryHistory (T049)", () => {
  it("renders nothing when there are no stories", () => {
    renderSwitcher([], null);
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("renders the stories newest-first with the active one marked", () => {
    renderSwitcher(
      [
        { id: "story-1", story: storyB },
        { id: "story-2", story: storyA },
      ],
      "story-2"
    );

    const group = screen.getByRole("group", { name: /suas histórias/i });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    // Newest-first: storyA (story-2, active) is listed before storyB.
    expect(buttons[0]).toHaveAccessibleName(new RegExp(`História — ${storyA.title}`));
    expect(buttons[1]).toHaveAccessibleName(new RegExp(`História — ${storyB.title}`));
    // Active carries aria-pressed + aria-current.
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-current", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked story id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSwitcher([{ id: "story-1", story: storyB }], "story-1", onSelect);
    await user.click(screen.getByRole("button", { name: /segredo da floresta/i }));
    expect(onSelect).toHaveBeenCalledWith("story-1");
  });
});
