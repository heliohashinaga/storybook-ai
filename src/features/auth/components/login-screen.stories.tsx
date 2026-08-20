import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { LoginScreenView, type LoginCredentials } from "./login-screen-view";

/** i18n decorator parameterized by locale (US1: pt-BR + en story cases). */
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
  args: {
    credentials: { google: true, github: true } satisfies LoginCredentials,
  },
  parameters: {
    layout: "centered",
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof LoginScreenView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /continuar com o google/i })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /continuar com o github/i })
    ).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  },
};

export const English: Story = {
  decorators: [withLocalizedI18n("en")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: /explore the demo/i })).toBeInTheDocument();
  },
};

/** Edge: no provider credentials configured → buttons hidden, demo-only note. */
export const NoCredentials: Story = {
  args: {
    credentials: { google: false, github: false } satisfies LoginCredentials,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.queryByRole("button", { name: /continuar com o google/i })
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /continuar com o github/i })
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("note")).toHaveTextContent(/não configurado/i);
    await expect(canvas.getByRole("link", { name: /explorar a demo/i })).toBeInTheDocument();
  },
};

/** Error: OAuth provider redirects back with ?error=AccessDenied (allowlist). */
export const OAuthDenied: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/", query: { error: "AccessDenied" } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(/não pode entrar/i);
  },
};

/**
 * Error: generic OAuth failure (?error=different) surfaces the localized retry
 * message. `prefers-reduced-motion` is honoured app-wide by globals.css, so it
 * needs no story-only fork here.
 */
export const OAuthGenericError: Story = {
  parameters: {
    nextjs: {
      navigation: { pathname: "/", query: { error: "OAuthSignin" } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent(/não deu para entrar/i);
  },
};
