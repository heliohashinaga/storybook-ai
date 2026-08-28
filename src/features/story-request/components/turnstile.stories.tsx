import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, waitFor } from "storybook/test";
import { Turnstile } from "./turnstile";

type RenderOpts = {
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
};

let lastOpts: RenderOpts | null = null;

/** Simulate the Cloudflare challenge window API (non-interactive widget). */
function mountableWindow(onRender?: (opts: RenderOpts) => void) {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  window.turnstile = {
    render: (_el: HTMLElement, opts: RenderOpts) => {
      lastOpts = opts;
      onRender?.(opts);
      return "w-mock";
    },
    reset: () => {},
    remove: () => {},
  };
}

/** Reset the simulated challenge env so it never leaks across stories. */
function clearTurnstileEnv() {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete window.turnstile;
}

const withMountable = (StoryComponent: () => React.JSX.Element) => {
  mountableWindow();
  lastOpts = null;
  return <StoryComponent />;
};

const meta: Meta<typeof Turnstile> = {
  title: "StoryRequest/Turnstile",
  component: Turnstile,
  tags: ["autodocs"],
  decorators: [withMountable],
  args: {
    onTokenChange: fn(),
    onError: fn(),
    enabled: true,
  },
  afterEach: clearTurnstileEnv,
};
export default meta;
type Story = StoryObj<typeof Turnstile>;

/** Default/loading: the widget is mounted and awaiting the challenge result. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-testid="turnstile-widget"]')).toBeTruthy()
    );
    // Idle: no token has been produced yet.
    await expect(args.onTokenChange).not.toHaveBeenCalled();
  },
};

/** Resolved: the challenge hands back a token, which the widget forwards up. */
export const Resolved: Story = {
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-testid="turnstile-widget"]')).toBeTruthy()
    );
    lastOpts?.callback?.("mock-turnstile-token");
    await waitFor(() => expect(args.onTokenChange).toHaveBeenCalledWith("mock-turnstile-token"));
  },
};

/** Error: the challenge reports a failure; the region flags itself busy. */
export const Error: Story = {
  play: async ({ canvasElement, args }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-testid="turnstile-widget"]')).toBeTruthy()
    );
    lastOpts?.["error-callback"]?.();
    await waitFor(() => expect(args.onError).toHaveBeenCalledWith(true));
    // The widget stays mounted (non-interactive region) after a failure.
    await expect(canvasElement.querySelector('[data-testid="turnstile-widget"]')).toBeTruthy();
  },
};
