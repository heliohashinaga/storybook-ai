import type { Meta, StoryObj } from "@storybook/react";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { ThemeSelector } from "./theme-selector";

const meta: Meta<typeof ThemeSelector> = {
  title: "StoryRequest/ThemeSelector",
  component: ThemeSelector,
  tags: ["autodocs"],
  decorators: [
    (StoryComponent) => (
      <LocaleProvider defaultLocale="pt-BR">
        <div className="flex max-w-md flex-col gap-md p-lg">
          <StoryComponent />
        </div>
      </LocaleProvider>
    ),
  ],
  args: {
    value: "courage",
    onSelect: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ThemeSelector>;

/** Default: the six positive-value themes as emoji cards (pt-BR). */
export const Default: Story = {};

/**
 * Edge (spec 016 US1): long localized theme descriptions must wrap cleanly at
 * word boundaries inside their card instead of overflowing the grid column or
 * clipping mid-word. Rendered at a narrow mobile viewport.
 */
export const LongDescriptionMobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
