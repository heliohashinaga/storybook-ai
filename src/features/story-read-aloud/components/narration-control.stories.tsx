import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, expect } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { NarrationControl } from "./narration-control";

/**
 * NarrationControl (spec 004, T029).
 *
 * Accessible single-toggle narration control covering the new AI narration
 * states: default/idle, busy (loading), speaking, stopping, error (accessible
 * alert, no Web Speech fallback) and system mode (AI narration disabled,
 * Web Speech fallback). All labels come from the `story.narration.*` catalog
 * via next-intl, so stories render inside LocaleProvider (pt-BR default).
 */
const meta: Meta<typeof NarrationControl> = {
  title: "StoryReadAloud/NarrationControl",
  component: NarrationControl,
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
    status: "idle",
    mode: "ai",
    errorMessage: "",
    onToggle: () => {},
  },
  argTypes: {
    status: {
      control: "select",
      options: ["idle", "busy", "speaking", "stopping", "error"],
    },
    mode: {
      control: "select",
      options: ["ai", "system"],
    },
  },
  parameters: {
    // The control uses aria-live announcements; keep the viewport tall enough
    // for the alert/sr-only output to be visible to test queries.
    viewport: { defaultViewport: "mobile1" },
  },
};

export default meta;
type Story = StoryObj<typeof NarrationControl>;

// Tracks onToggle dispatches across play assertions (deterministic, no spy lib).
let onToggleCalls = 0;

/** Default state: AI narration available, nothing playing yet. */
export const Idle: Story = {
  args: {
    status: "idle",
    mode: "ai",
    onToggle: () => {
      onToggleCalls += 1;
    },
  },
  play: async ({ canvasElement }) => {
    onToggleCalls = 0;
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /ouvir esta cena/i });
    await expect(button).toBeVisible();
    // Single start/stop toggle: the button is a native button, keyboard
    // focusable, and not pressed while idle.
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeEnabled();
    // Keyboard accessibility: the native button receives programmatic focus.
    button.focus();
    await expect(document.activeElement).toBe(button);

    // The control is interactive: clicking dispatches onToggle.
    await userEvent.click(button);
    await expect(onToggleCalls).toBe(1);
  },
};

/** Busy (loading): server audio is being fetched; announced via aria-live. */
export const Busy: Story = {
  args: { status: "busy", mode: "ai" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /obtendo o áudio da narração/i })
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: /obtendo/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // While the audio is being fetched, the control region advertises
    // aria-busy (T034) so assistive tech knows work is in progress.
    const group = canvasElement.querySelector("[role=group]");
    await expect(group).toHaveAttribute("aria-busy", "true");
    await expect(group).toHaveAttribute("aria-label", "Controle de narração");
    // The busy label is announced via the sr-only aria-live region in
    // addition to the visible button label.
    await expect(canvas.getAllByText(/obtendo o áudio da narração/i).length).toBeGreaterThanOrEqual(
      1
    );
  },
};

/** Speaking: AI audio is playing; the control reads "stop". */
export const Speaking: Story = {
  args: { status: "speaking", mode: "ai" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /lendo a cena com voz de ia/i });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  },
};

/** Stopping: narration is being interrupted (e.g. on scene change). */
export const Stopping: Story = {
  args: { status: "stopping", mode: "ai" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /parando a leitura/i })).toBeVisible();
  },
};

/**
 * Error (US2): with AI narration active, a provider failure surfaces an
 * accessible role=alert error; there is no fallback to Web Speech.
 */
export const Error: Story = {
  args: {
    status: "error",
    mode: "ai",
    errorMessage: "Não foi possível reproduzir o áudio. Tente novamente.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The alert is announced assertively and the scene stays readable.
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Não foi possível reproduzir o áudio. Tente novamente.");
    await expect(alert).toBeVisible();
  },
};

/** System (disabled): AI narration off — the control uses Web Speech. */
export const System: Story = {
  args: { status: "idle", mode: "system" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /ouvir esta cena/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /ouvir esta cena/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  },
};
