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
