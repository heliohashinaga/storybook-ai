import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    children: "Mensagem do alerta.",
  },
};

export default meta;

type Story = StoryObj<typeof Alert>;

export const Info: Story = { args: { variant: "info" } };
export const Success: Story = { args: { variant: "success" } };
export const Warning: Story = { args: { variant: "warning" } };
export const Danger: Story = { args: { variant: "danger" } };
