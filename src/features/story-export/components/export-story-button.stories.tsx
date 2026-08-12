import type { Meta, StoryObj } from "@storybook/react";
import { within, expect } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import type { GeneratedStory } from "../../story-generation/server/schemas";
import { ExportStoryButton } from "./export-story-button";

const story: GeneratedStory = {
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

const meta: Meta<typeof ExportStoryButton> = {
  title: "StoryExport/ExportStoryButton",
  component: ExportStoryButton,
  decorators: [
    (StoryComponent) => (
      <LocaleProvider defaultLocale="pt-BR">
        <div className="flex max-w-md flex-col gap-md p-lg">
          <StoryComponent />
        </div>
      </LocaleProvider>
    ),
  ],
  args: { story },
};

export default meta;

type Story = StoryObj<typeof ExportStoryButton>;

/** Default state — a labelled download button with an aria-live region. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /baixar como pdf/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /baixar como pdf/i })).toBeEnabled();
  },
};
