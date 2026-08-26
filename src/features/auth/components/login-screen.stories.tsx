import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { LoginScreenView } from "./login-screen-view";

/** i18n decorator parameterized by locale (pt-BR + en story cases). */
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
  title: "Auth/LoginScreen",
  component: LoginScreenView,
  tags: ["autodocs"],
  decorators: [withLocalizedI18n("pt-BR")],
  parameters: {
    layout: "fullscreen",
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof LoginScreenView>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders the app login frame. The Clerk `<SignIn>` (Google + e-mail/senha) is
 * mounted by the component only when Clerk is configured; in a storybook build
 * without Clerk keys it falls back to the demo-only panel. We assert the app
 * wrapper that exists in both modes (heading + "explore the demo" entry).
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  },
};

export const English: Story = {
  decorators: [withLocalizedI18n("en")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /explore the demo/i })).toBeInTheDocument();
  },
};
