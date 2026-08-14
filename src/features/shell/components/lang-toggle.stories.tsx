import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { LangToggle } from "./lang-toggle";

const withLocalizedI18n = (locale: "pt-BR" | "en") => {
  const Decorator = (StoryComponent: () => React.JSX.Element) => (
    <LocaleProvider defaultLocale={locale}>
      <div className="flex max-w-md flex-col gap-md p-lg">
        <StoryComponent />
      </div>
    </LocaleProvider>
  );
  Decorator.displayName = `withLocalizedI18n(${locale})`;
  return Decorator;
};

const meta = {
  title: "Shell/LangToggle",
  component: LangToggle,
  tags: ["autodocs"],
  decorators: [withLocalizedI18n("pt-BR")],
  parameters: {
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
} satisfies Meta<typeof LangToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /português/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(canvas.getByRole("button", { name: /english/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  },
};

export const EnglishActive: Story = {
  decorators: [withLocalizedI18n("en")],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /português/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(canvas.getByRole("button", { name: /english/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  },
};

export const SwitchesLanguage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const en = canvas.getByRole("button", { name: /english/i });
    await userEvent.click(en);
    await expect(en).toHaveAttribute("aria-pressed", "true");
  },
};
