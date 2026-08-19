import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { OAuthProviderButton } from "./oauth-provider-button";

const meta = {
  title: "Auth/OAuthProviderButton",
  component: OAuthProviderButton,
  tags: ["autodocs"],
  args: {
    onClick: fn(),
  },
  parameters: {
    layout: "centered",
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof OAuthProviderButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Google: Story = {
  args: {
    provider: "google",
    label: "Continuar com o Google",
  },
};

export const GitHub: Story = {
  args: {
    provider: "github",
    label: "Continuar com o GitHub",
  },
};

/** Edge: provider credentials are absent → the button is disabled. */
export const Disabled: Story = {
  args: {
    provider: "github",
    label: "Continuar com o GitHub",
    disabled: true,
  },
};

/** Busy: a sign-in attempt is in flight (aria-busy swaps the label hint). */
export const Busy: Story = {
  args: {
    provider: "google",
    label: "Continuar com o Google",
    busy: true,
  },
};
