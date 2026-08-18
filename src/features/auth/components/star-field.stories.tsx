import type { Meta, StoryObj } from "@storybook/react";
import { StarField } from "./star-field";

const meta = {
  title: "Auth/StarField",
  component: StarField,
  parameters: {
    // Decorative background — render it as a container-safe element.
    layout: "fullscreen",
    // The component is aria-hidden and add nothing to the a11y tree.
    a11y: { disable: false },
  },
} satisfies Meta<typeof StarField>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Default blossom-style scattered star field. */
export const Default: Story = {
  render: () => (
    <div className="relative h-dvh">
      <StarField />
      <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground">
        A few sparkles twinkle in the background.
      </div>
    </div>
  ),
};

/** Reduced-motion: the global CSS override freezes the twinkle (static field). */
export const ReducedMotion: Story = {
  parameters: {
    pseudo: { prefersReducedMotion: "reduce" },
  },
  render: Default.render,
};
