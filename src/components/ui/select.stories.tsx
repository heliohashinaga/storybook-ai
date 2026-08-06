import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    label: "Tema da história",
    children: (
      <>
        <option value="courage">Coragem</option>
        <option value="friendship">Amizade</option>
        <option value="kindness">Bondade</option>
      </>
    ),
  },
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {},
};

export const Hint: Story = {
  args: { hint: "Escolha o tema do protagonista." },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Error: Story = {
  args: { error: "Selecione um tema válido." },
};
