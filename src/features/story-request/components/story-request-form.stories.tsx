import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { fireEvent } from "@testing-library/react";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { StoryRequestForm, type SubmitResult } from "./story-request-form";

const withI18n = (StoryComponent: () => React.JSX.Element) => (
  <LocaleProvider defaultLocale="pt-BR">
    <div className="flex max-w-md flex-col gap-md p-lg">
      <StoryComponent />
    </div>
  </LocaleProvider>
);

/** i18n decorator parameterized by locale (US4: pt-BR + en story cases). */
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

const meta: Meta<typeof StoryRequestForm> = {
  title: "StoryRequest/Form",
  component: StoryRequestForm,
  tags: ["autodocs"],
  decorators: [withI18n],
  args: {
    defaultTheme: "courage",
    onSubmit: async () => ({ ok: true }),
  },
};

export default meta;

type Story = StoryObj<typeof StoryRequestForm>;

async function fillAgeAndSubmit(canvasElement: HTMLElement, locale: "pt-BR" | "en" = "pt-BR") {
  const canvas = within(canvasElement);
  // The exact age lives in a range slider; query by role so we don't hit other
  // labels that contain the loose /idade|age/ substring (e.g. "Quantidade de
  // cenas"/"Language").
  fireEvent.change(canvas.getByRole("slider"), { target: { value: "6" } });
  await userEvent.click(
    canvas.getByRole("button", { name: locale === "en" ? /create story/i : /criar história/i })
  );
}

export const Default: Story = {};

export const Loading: Story = {
  args: {
    // The request stays in flight while the story is generated.
    onSubmit: () => new Promise<SubmitResult>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAgeAndSubmit(canvasElement);

    const button = canvas.getByRole("button", { name: /criando sua história/i });
    await expect(button).toBeDisabled();
    await expect(button.closest("form")).toHaveAttribute("aria-busy", "true");
  },
};

export const SafeRetry: Story = {
  args: {
    onSubmit: async (): Promise<SubmitResult> => ({
      ok: false,
      messageKey: "safeAlternativeUnavailable",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAgeAndSubmit(canvasElement);

    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent(/não foi possível gerar uma história segura/i);
    // G194: focus moves to the error region so assistive tech lands on it.
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
  },
};

export const RateLimit: Story = {
  args: {
    onSubmit: async (): Promise<SubmitResult> => ({
      ok: false,
      messageKey: "tryAgainLater",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAgeAndSubmit(canvasElement);

    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent(/muitas solicitações/i);
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
  },
};

export const Success: Story = {
  args: {
    onSuccess: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fillAgeAndSubmit(canvasElement);

    await waitFor(() => expect(args.onSuccess).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByRole("alert")).toBeNull();
    await expect(canvas.getByRole("button", { name: /criar história/i })).toBeEnabled();
  },
};

// ---------------------------------------------------------------------------
// Localized English cases (US4, T054) — English UI strings + a11y.
// ---------------------------------------------------------------------------

const withEn = withLocalizedI18n("en");

/** Fill the age and pick the friendship theme in the English form. */
async function fillEn(page: HTMLElement) {
  const canvas = within(page);
  // See fillAgeAndSubmit: the age is a range slider, unique via role.
  fireEvent.change(canvas.getByRole("slider"), { target: { value: "9" } });
  // Theme is a ChoiceCard button (visual selection); pick the Friendship card.
  await userEvent.click(canvas.getByRole("button", { name: /friendship/i }));
  await userEvent.click(canvas.getByRole("button", { name: /create story/i }));
}

/** English default — labels/submit render in English. */
export const EnDefault: Story = {
  decorators: [withEn],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("slider", { name: /age/i })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /create story/i })).toBeVisible();
    await expect(canvas.queryByLabelText(/idade/i)).toBeNull();
  },
};

/** English loading state — aria-busy + disabled submit. */
export const EnLoading: Story = {
  decorators: [withEn],
  args: {
    onSubmit: () => new Promise<SubmitResult>(() => {}),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillEn(canvasElement);
    const button = canvas.getByRole("button", { name: /creating your story/i });
    await expect(button).toBeDisabled();
    await expect(button.closest("form")).toHaveAttribute("aria-busy", "true");
  },
};

/** English safety retry error — localized message + focus moves to region. */
export const EnSafeRetry: Story = {
  decorators: [withEn],
  args: {
    onSubmit: async (): Promise<SubmitResult> => ({
      ok: false,
      messageKey: "safeAlternativeUnavailable",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await fillEn(canvasElement);
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent(/safe story/i);
    await waitFor(() => expect(alert.parentElement).toHaveFocus());
  },
};

// ---------------------------------------------------------------------------
// spec 016 US1/US2 — mobile density + wrapping edge cases (Storybook = app).
// ---------------------------------------------------------------------------

/**
 * Edge (spec 016): at a narrow mobile viewport, localized text (theme
 * descriptions, the "Português (Brasil)" language button, and the "cenas"
 * scene unit) must wrap cleanly without overflow, and the controls keep their
 * proportional mobile density. Mirrors the real app at 320px.
 */
export const MobileDensity: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Language button label is long in pt-BR and must not overflow its column.
    const langButton = canvas.getByRole("button", { name: /português/i });
    await expect(langButton).toBeVisible();
    // Scene-count unit stays attached to the number (whitespace-nowrap); scope
    // the query to the unit span so it does not also match the legend/label.
    const unit = canvasElement.querySelector(
      "#story-request-scenes-label + div span"
    ) as HTMLElement;
    await expect(unit).toHaveTextContent(/cenas/i);
    // The form itself introduces no horizontal overflow at this width.
    const form = canvasElement.querySelector("form") as HTMLElement;
    expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth + 1);
  },
};
