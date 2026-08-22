import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
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
  // The top-nav intentionally returns null on the login gate `/` (standalone
  // screen) — render it on a demo route so the nav (brand + widgets) is visible.
  parameters: {
    nextjs: {
      navigation: { pathname: "/demo" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/storybook ai/i)).toBeInTheDocument();
    await expect(canvas.getByRole("group", { name: /idioma|language/i })).toBeInTheDocument();
  },
};

export const English: Story = {
  decorators: [withLocalizedI18n("en")],
  parameters: {
    nextjs: {
      navigation: { pathname: "/demo" },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/storybook ai/i)).toBeInTheDocument();
  },
};

export const MobileMenu: Story = {
  // The kebab menu is mobile-only (`sm:hidden`). Render in a 360px (Galaxy
  // S8) viewport so the trigger is visible and can be interacted with.
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    nextjs: {
      navigation: { pathname: "/demo" },
    },
    chromatic: { viewport: ["mobile"] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The kebab trigger carries the brand menu label ("/").
    const trigger = await canvas.findByRole("button", { name: /menu/i });
    await userEvent.click(trigger);
    // Language + theme toggles appear in the panel.
    await expect(canvas.getByRole("group", { name: /idioma|language/i })).toBeInTheDocument();
    await expect(canvas.getByRole("dialog")).toBeInTheDocument();
    // Escape closes it.
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
  },
};
