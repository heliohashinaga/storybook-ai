import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, expect } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import type { GeneratedStory } from "../../../features/story-generation/server/schemas";
import { StoryReader } from "./story-reader";

const scene = (ordinal: number, body: string) => ({
  ordinal,
  title: `Cena ${ordinal}`,
  body,
  illustrationDataUri: "data:image/webp;base64,AA",
  altText: `Ilustração da cena ${ordinal} em aquarela.`,
});

const base: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  sceneCount: 5,
  safetyDecision: "approved" as const,
  title: "A missão da estrelinha",
  scenes: [
    scene(1, "Era uma vez uma estrelinha que sonhava em conhecer o mar."),
    scene(2, "Ela brilhou forte e desceu até a areia da praia."),
    scene(3, "Na praia, conheceu uma conchinha curiosa."),
    scene(4, "Juntas, enfrentaram a tempestade da noite."),
    scene(5, "No fim, a estrelinha voltou ao céu feliz."),
  ],
};

const fourScenes: GeneratedStory = {
  ...base,
  sceneCount: 4,
  title: "O rio e a lua",
  scenes: base.scenes.slice(0, 4),
};

const meta: Meta<typeof StoryReader> = {
  title: "StoryReader/StoryReader",
  component: StoryReader,
  decorators: [
    (StoryComponent) => (
      <LocaleProvider defaultLocale="pt-BR">
        <div className="flex max-w-md flex-col gap-md p-lg">
          <StoryComponent />
        </div>
      </LocaleProvider>
    ),
  ],
  args: { story: base },
  parameters: {
    // The reader relies on a11y focus/aria-live; keep the viewport tall enough
    // for the full scene nav without clipping the controls.
    viewport: { defaultViewport: "mobile1" },
  },
};

export default meta;
type Story = StoryObj<typeof StoryReader>;

/** A five-scene story (MAX_SCENES), demonstrating the full reading journey. */
export const FiveScenes: Story = {
  args: { story: base },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cena 1 de 5")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /próxima cena/i }));
    await expect(canvas.getByText("Cena 2 de 5")).toBeVisible();
  },
};

/** A four-scene story (between MIN and MAX), confirming the progress count. */
export const FourScenes: Story = {
  args: { story: fourScenes },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cena 1 de 4")).toBeVisible();
  },
};

/** Edge: the reader clamps at bounds and never navigates past the last scene. */
export const LastSceneBound: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (let i = 0; i < 4; i += 1) {
      await userEvent.click(canvas.getByRole("button", { name: /próxima cena/i }));
    }
    await expect(canvas.getByText("Cena 5 de 5")).toBeVisible();
    // The final scene disables forward navigation (self-locking bound).
    await expect(canvas.getByRole("button", { name: /próxima cena/i })).toBeDisabled();
  },
};

/** Keyboard: arrow keys navigate while the scene content is focused. */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Cena 1 de 5")).toBeVisible();
    canvas.getByRole("heading", { name: /cena 1/i }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByText("Cena 2 de 5")).toBeVisible();
  },
};
