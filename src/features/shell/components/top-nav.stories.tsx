import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { TopNav } from "./top-nav";

function withLocalizedI18n(locale: "pt-BR" | "en") {
  const Decorator = (StoryComponent: () => React.JSX.Element) => (
    <LocaleProvider defaultLocale={locale}>
      <StoryComponent />
    </LocaleProvider>
  );
  Decorator.displayName = `withLocalizedI18n(${locale})`;
  return Decorator;
}

const meta = {
  title: "Shell/TopNav",
  component: TopNav,
  tags: ["autodocs"],
  decorators: [withLocalizedI18n("pt-BR")],
  parameters: {
    layout: "fullscreen",
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof TopNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/storybook ai/i)).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: /idioma|language/i })).toBeInTheDocument();
  },
};

export const English: Story = {
  decorators: [withLocalizedI18n("en")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/storybook ai/i)).toBeInTheDocument();
  },
};
