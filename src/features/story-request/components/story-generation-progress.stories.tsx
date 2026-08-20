import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import {
  MAX_STAGE,
  STEP_DURATION_SECONDS,
  TIMEOUT_CUE_AT_SECONDS,
  StoryGenerationProgress,
} from "./story-generation-progress";

/** Start of the last pipeline step (a uniform STEP_DURATION_SECONDS per step). */
const LAST_STAGE_AT_SECONDS = MAX_STAGE * STEP_DURATION_SECONDS;

const withI18n = (StoryComponent: () => React.JSX.Element) => (
  <LocaleProvider defaultLocale="pt-BR">
    <StoryComponent />
  </LocaleProvider>
);

const meta: Meta<typeof StoryGenerationProgress> = {
  title: "StoryRequest/GenerationProgress",
  component: StoryGenerationProgress,
  tags: ["autodocs"],
  decorators: [withI18n],
};

export default meta;

type Story = StoryObj<typeof StoryGenerationProgress>;

/** Stage 0 — planning the scene structure (bar at 0%). */
export const Planning: Story = {
  args: { phase: "generating", elapsedSeconds: 0 },
};

/** Stage 1 — writing the narrative (bar at 25%, badge 1 done). */
export const Writing: Story = {
  args: { phase: "generating", elapsedSeconds: STEP_DURATION_SECONDS },
};

/** Stage 2 — safety review gate (bar at 50%, badges 1–2 done). */
export const Reviewing: Story = {
  args: { phase: "generating", elapsedSeconds: 2 * STEP_DURATION_SECONDS },
};

/** Stage 3 — illustrating, the pipeline's final step (bar at 75%; fills on completion). */
export const Illustrating: Story = {
  args: { phase: "generating", elapsedSeconds: LAST_STAGE_AT_SECONDS },
};

/** Patient timeout cue — no duplicated waiting hint, lock notice stays. */
export const Timeout: Story = {
  args: { phase: "timeout", elapsedSeconds: TIMEOUT_CUE_AT_SECONDS },
};

/** Safety re-review after a blocked generation. */
export const SafetyRetry: Story = {
  args: { phase: "safety-retry", elapsedSeconds: LAST_STAGE_AT_SECONDS },
};

/** Provider failure — error alert with a retry action. */
export const ProviderFailure: Story = {
  args: {
    phase: "provider-failure",
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(/não deu para criar/i);
    await userEvent.click(canvas.getByRole("button", { name: /tentar novamente/i }));
  },
};
