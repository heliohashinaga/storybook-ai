import type { Meta, StoryObj } from "@storybook/react";
import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    label: "Gerando história",
  },
};

export default meta;

type Story = StoryObj<typeof Progress>;

export const Indeterminate: Story = {
  args: { busy: true },
};

export const Halfway: Story = {
  args: { value: 50, max: 100, children: "Cena 2 de 3" },
};

export const Complete: Story = {
  args: { value: 100, max: 100, busy: false, children: "Concluído" },
};
