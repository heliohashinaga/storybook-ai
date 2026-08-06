import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Começar",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Excluir" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Voltar" },
};

export const Small: Story = {
  args: { size: "sm", children: "Pequeno" },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Desabilitado" },
};

export const Loading: Story = {
  args: { loading: true, children: "Processando" },
};
