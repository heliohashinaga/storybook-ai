import type { Meta, StoryObj } from "@storybook/react";
import { ChoiceCard } from "./choice-card";

const meta: Meta<typeof ChoiceCard> = {
  title: "UI/ChoiceCard",
  component: ChoiceCard,
  tags: ["autodocs"],
  args: {
    label: "Coragem",
    description: "Enfrentar o medo e fazer a coisa certa.",
  },
};

export default meta;

type Story = StoryObj<typeof ChoiceCard>;

export const Default: Story = {};

export const Selected: Story = {
  args: { selected: true },
};

export const WithIcon: Story = {
  args: { icon: "🛡️" },
};

export const Disabled: Story = {
  args: { disabled: true, selected: false },
};

/**
 * Edge (spec 016 US1): a very long localized description must wrap cleanly at
 * word boundaries instead of overflowing or clipping mid-word. The card keeps
 * its column width and the description breaks on spaces.
 */
export const LongDescription: Story = {
  args: {
    icon: "🌟",
    label: "Curiosidade",
    description:
      "Fazer perguntas, explorar o mundo e descobrir como as coisas funcionam com coragem e alegria.",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
