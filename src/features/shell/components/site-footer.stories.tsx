import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { GITHUB_REPO_URL, SiteFooter } from "./site-footer";

/** i18n decorator parameterized by locale (pt-BR + en footer cases). */
const withLocalizedI18n = (locale: "pt-BR" | "en") => {
  const Decorator = (StoryComponent: () => React.JSX.Element) => (
    <LocaleProvider defaultLocale={locale}>
      <StoryComponent />
    </LocaleProvider>
  );
  Decorator.displayName = `withLocalizedI18n(${locale})`;
  return Decorator;
};

const meta = {
  title: "Shell/SiteFooter",
  component: SiteFooter,
  tags: ["autodocs"],
  decorators: [withLocalizedI18n("pt-BR")],
  parameters: {
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", { name: /ver código no github/i });
    await expect(link).toHaveAttribute("href", GITHUB_REPO_URL);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  },
};

export const English: Story = {
  decorators: [withLocalizedI18n("en")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /view source on github/i })).toBeInTheDocument();
  },
};
