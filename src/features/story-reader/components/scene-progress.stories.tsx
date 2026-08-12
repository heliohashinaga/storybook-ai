import type { Meta, StoryObj } from "@storybook/react";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { SceneProgress } from "./scene-progress";

const meta: Meta<typeof SceneProgress> = {
  title: "StoryReader/SceneProgress",
  component: SceneProgress,
  decorators: [
    (StoryComponent) => (
      <LocaleProvider defaultLocale="pt-BR">
        <div className="flex max-w-md flex-col gap-md p-lg">
          <StoryComponent />
        </div>
      </LocaleProvider>
    ),
  ],
  args: { current: 1, total: 3, label: "Posição na história" },
};

export default meta;

type Story = StoryObj<typeof SceneProgress>;

/** Three-scene story, first scene. */
export const ThreeStart: Story = {};

/** Three-scene story, middle scene. */
export const ThreeMiddle: Story = {
  args: { current: 2, total: 3 },
};

/** Three-scene story, last scene. */
export const ThreeEnd: Story = {
  args: { current: 3, total: 3 },
};

/** Five-scene story (MAX_SCENES), current position in the middle. */
export const FiveMiddle: Story = {
  args: { current: 3, total: 5 },
};

/** Edge: last of five — the indicator shows full progress without animation. */
export const FiveEnd: Story = {
  args: { current: 5, total: 5 },
};
