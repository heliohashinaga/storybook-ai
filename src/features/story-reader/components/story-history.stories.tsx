import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, expect } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import type { GeneratedStory } from "../../../features/story-generation/server/schemas";
import { StoryHistory } from "./story-history";

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
const storyB: GeneratedStory = { ...storyA, title: "O segredo da floresta" };

const meta: Meta<typeof StoryHistory> = {
  title: "StoryReader/StoryHistory",
  component: StoryHistory,
  decorators: [
    (StoryComponent) => (
      <LocaleProvider defaultLocale="pt-BR">
        <div className="flex max-w-md flex-col gap-md p-lg">
          <StoryComponent />
        </div>
      </LocaleProvider>
    ),
  ],
  args: {
    storyEntries: [
      { id: "story-1", story: storyB },
      { id: "story-2", story: storyA },
    ],
    activeId: "story-2",
    onSelect: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof StoryHistory>;

export const Default: Story = {};

export const Single: Story = {
  args: {
    storyEntries: [{ id: "story-1", story: storyA }],
    activeId: "story-1",
  },
};

export const KeyboardSelect: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole("button");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttons[0]);
  },
};
