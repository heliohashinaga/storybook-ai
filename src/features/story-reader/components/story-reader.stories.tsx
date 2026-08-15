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

// US4 — long body: overflows ~6 lines on desktop so the show-more toggle
// appears (line-clamp-6 + "Mostrar mais").
const longBody =
  "Era uma vez uma estrelinha muito curiosa que queria conhecer o mar. " +
  "Ela brilhou forte e desceu até a areia, onde conheceu uma conchinha. " +
  "Juntas enfrentaram a tempestade e descobriram que a amizade vence tudo. ".repeat(8);
const longBodyStory: GeneratedStory = {
  ...base,
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: longBody,
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Ilustração da cena 1 em aquarela.",
    },
  ],
};

// US4 — short body: fits within ~6 lines, so no clamp and no toggle button.
const shortBodyStory: GeneratedStory = {
  ...base,
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: "Era uma vez uma estrelinha.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Ilustração da cena 1 em aquarela.",
    },
  ],
};

// US4 — desktop viewport (>= 640px): the clamp applies and the show-more
// toggle appears only when the body really overflows (Q2=B).
const desktopViewport = { viewport: { defaultViewport: "desktop" } };

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
    await userEvent.click(canvas.getByRole("button", { name: /próxima/i }));
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
      await userEvent.click(canvas.getByRole("button", { name: /próxima/i }));
    }
    await expect(canvas.getByText("Cena 5 de 5")).toBeVisible();
    // The final scene disables forward navigation (self-locking bound).
    await expect(canvas.getByRole("button", { name: /próxima/i })).toBeDisabled();
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

/**
 * US2 — leitura em voz alta: a single start/stop control with an announced
 * `aria-pressed` state. The browser speech globals are stubbed so the toggle
 * path is deterministic (real `speechSynthesis` may fire `onerror`/no-audio in
 * headless Chromium, which would revert the state before it can be asserted).
 */
export const ReadAloud: Story = {
  play: async ({ canvasElement }) => {
    // Install a deterministic Web Speech mock so speak()/cancel() are inert.
    const utteranceClass = class SpeechSynthesisUtteranceMock {
      lang = "";
      voice = null;
      volume = 1;
      rate = 1;
      pitch = 1;
      onend = null;
      onerror = null;
      constructor(public text: string) {}
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechSynthesisUtterance = utteranceClass;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      writable: true,
      value: {
        speak: () => {},
        cancel: () => {},
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });

    // AI narration is server-controlled; answer 204 (disabled) so the toggle
    // delegates to the Web Speech fallback and the label flips to "Parar
    // leitura" (US4.2). Without this the Storybook dev server returns 404 and
    // the path lands on the accessible error state instead.
    const originalFetch = window.fetch;
    window.fetch = () =>
      Promise.resolve(
        new Response(null, { status: 204, statusText: "No Content" })
      ) as Promise<Response>;

    const button = within(canvasElement).getByRole("button", { name: /^ouvir$/i });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // Starting narration toggles the control to "stop" and presses the state.
    await userEvent.click(button);
    await expect(
      within(canvasElement).getByRole("button", { name: /parar leitura/i })
    ).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "true");

    // Toggling again stops narration (single control returns to "listen").
    await userEvent.click(within(canvasElement).getByRole("button", { name: /parar leitura/i }));
    await expect(within(canvasElement).getByRole("button", { name: /^ouvir$/i })).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // Restore the real fetch for the a11y pass and other stories.
    window.fetch = originalFetch;
  },
};

/**
 * US4 — long body on desktop: the reader clamps to ~6 lines (Q1=A) and shows
 * an accessible "Mostrar mais" toggle (aria-expanded=false) because the body
 * overflows (Q2=B).
 */
export const ShowMoreDesktop: Story = {
  ...desktopViewport,
  args: { story: longBodyStory },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: /mostrar mais/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The clamped body is still announced as one paragraph.
    await expect(canvas.getByText(/estrelinha muito curiosa/i)).toBeVisible();
  },
};

/** US4 — activating the toggle expands the body and flips the label. */
export const ShowMoreExpanded: Story = {
  ...desktopViewport,
  args: { story: longBodyStory },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: /mostrar mais/i });
    await userEvent.click(toggle);
    const toggleExpanded = await canvas.findByRole("button", { name: /mostrar menos/i });
    await expect(toggleExpanded).toHaveAttribute("aria-expanded", "true");
    // Collapsing again restores the compact label.
    await userEvent.click(toggleExpanded);
    await expect(canvas.findByRole("button", { name: /mostrar mais/i })).toBeVisible();
  },
};

/** US4 — short body on desktop: no overflow, so no clamp and no toggle. */
export const ShortBodyNoToggle: Story = {
  ...desktopViewport,
  args: { story: shortBodyStory },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Era uma vez uma estrelinha.")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /mostrar mais|mostrar menos/i })
    ).not.toBeInTheDocument();
  },
};

/**
 * US4 — long body on desktop: the scene body is clamped (~6 lines) and the
 * accessible "Mostrar mais" button appears (aria-expanded=false).
 */
export const LongBodyDesktop: Story = {
  args: { story: longBodyStory },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: /mostrar mais/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  },
};

/**
 * US4 — activating the toggle expands the full body and switches the label +
 * aria-expanded state.
 */
export const LongBodyExpanded: Story = {
  args: { story: longBodyStory },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: /mostrar mais/i });
    await userEvent.click(toggle);
    await expect(canvas.getByRole("button", { name: /mostrar menos/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  },
};

/**
 * US4 — short body on desktop: fits within ~6 lines, so there is no clamp and
 * no toggle button (no useless control).
 */
export const ShortBodyNoOverflow: Story = {
  args: { story: shortBodyStory },
  parameters: { viewport: { defaultViewport: "desktop" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Era uma vez uma estrelinha.")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /mostrar mais|mostrar menos/i })).toBeNull();
  },
};
