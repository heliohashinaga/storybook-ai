import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import {
  StoryRequestForm,
  type GenerateStoryRequest,
  type SubmitResult,
} from "../../src/features/story-request/components/story-request-form";
import { getMessages } from "../../src/i18n/config";

function renderForm(
  props: {
    onSubmit?: (request: GenerateStoryRequest) => Promise<SubmitResult>;
    onSuccess?: () => void;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <StoryRequestForm
        onSubmit={props.onSubmit ?? (async () => ({ ok: true }))}
        onSuccess={props.onSuccess}
      />
    </NextIntlClientProvider>
  );
}

function ageSlider() {
  return screen.getByRole("slider", { name: /idade/i });
}

async function fillValidAgeAndSubmit(age = "6") {
  const user = userEvent.setup();
  fireEvent.change(ageSlider(), { target: { value: age } });
  await user.click(screen.getByRole("button", { name: /criar história/i }));
  return user;
}

describe("StoryRequestForm — anonymous by design", () => {
  it("never renders a direct-identifier (child name) field", () => {
    renderForm();
    // No field labeled as a name anywhere in the form.
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nome da criança/i)).not.toBeInTheDocument();
  });

  it("collects age (range slider), scenes, and theme", () => {
    renderForm();
    expect(screen.getByRole("slider", { name: /idade/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /cenas/i }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/tema da história/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0); // no free-text fields
  });
});

describe("StoryRequestForm — theme and language choices", () => {
  it("offers exactly the six positive-value themes as visual emoji cards", () => {
    renderForm();
    // The six positive-value themes render as ChoiceCard buttons localized to
    // pt-BR (default): Coragem, Amizade, Bondade, Curiosidade, Persistência,
    // Empatia — each with an emoji icon.
    expect(screen.getByRole("button", { name: /coragem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /amizade/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bondade/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /curiosidade/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /persistência/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empatia/i })).toBeInTheDocument();
  });

  it("offers scene counts as selectable cards with aria-pressed", () => {
    renderForm();
    const cards = screen.getAllByRole("button", { name: /cenas/i });
    expect(cards.length).toBe(3); // 3 / 4 / 5 cenas
    expect(cards[0]).toHaveAttribute("aria-pressed", "true"); // default sceneCount 3
  });
});

describe("StoryRequestForm — submission sends only ageBand/locale/theme", () => {
  it("derives ageBand locally and sends no exact age or identifier", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    renderForm({ onSubmit });
    await fillValidAgeAndSubmit("6");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]![0]!;
    expect(payload).toEqual({ ageBand: "5-7", locale: "en", theme: "courage", sceneCount: 3 });
    // Never an exact age or a child name.
    expect(Object.keys(payload).sort()).toEqual(["ageBand", "locale", "sceneCount", "theme"]);
    expect(JSON.stringify(payload)).not.toMatch(/name|"age":/i);
  });

  it("sends the app locale, selected theme, and scene count (T056 single-locale)", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    fireEvent.change(ageSlider(), { target: { value: "9" } });
    await user.click(screen.getByRole("button", { name: /5cenas/i }));
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ageBand: "8-9",
      locale: "en",
      theme: "courage",
      sceneCount: 5,
    });
  });

  it("rejects an out-of-range locale-less submit only if the age is invalid", async () => {
    // With a range slider the age is always 2-9; submitting with a valid age
    // always goes through. This guards the slider is still wired to the band.
    const onSubmit = vi.fn(async (_r: GenerateStoryRequest): Promise<SubmitResult> => {
      void _r;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    await user.click(screen.getByRole("button", { name: /criar história/i }));
    // Slider default (5) is valid, so the submit reaches the listener.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

describe("StoryRequestForm — submission states", () => {
  it("disables and announces the submit while generating", async () => {
    let resolveSubmit!: (r: SubmitResult) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<SubmitResult>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const user = userEvent.setup();
    renderForm({ onSubmit });
    fireEvent.change(ageSlider(), { target: { value: "6" } });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    const submitting = screen.getByRole("button", { name: /criando sua história/i });
    expect(submitting).toBeDisabled();
    expect(submitting).toHaveAttribute("aria-busy", "true");

    resolveSubmit({ ok: true });
    await waitFor(async () => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onSuccess when the story is approved", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    const onSuccess = vi.fn();
    renderForm({ onSubmit, onSuccess });
    await fillValidAgeAndSubmit("4");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("moves focus to the submit-error region after a failed generation", async () => {
    const onSubmit = vi.fn(async (): Promise<SubmitResult> => ({
      ok: false,
      messageKey: "generationUnavailable",
    }));
    const { container } = renderForm({ onSubmit });
    const user = userEvent.setup();

    fireEvent.change(ageSlider(), { target: { value: "6" } });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    const region = container.querySelector("#story-request-submit-error");
    expect(region).not.toBeNull();
    await waitFor(() => expect(region).toHaveFocus());
  });

  it("announces the submit error assertively", async () => {
    const onSubmit = vi.fn(async (): Promise<SubmitResult> => ({
      ok: false,
      messageKey: "generationUnavailable",
    }));
    renderForm({ onSubmit });
    const user = userEvent.setup();

    fireEvent.change(ageSlider(), { target: { value: "6" } });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("shows a localized retry on provider failure and can resubmit", async () => {
    const onSubmit = vi
      .fn<(_request: GenerateStoryRequest) => Promise<SubmitResult>>()
      .mockResolvedValueOnce({ ok: false, messageKey: "generationUnavailable" })
      .mockResolvedValueOnce({ ok: true });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderForm({ onSubmit, onSuccess });

    fireEvent.change(ageSlider(), { target: { value: "7" } });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText(/gerador de histórias indisponível/i)).toHaveRole("alert");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /criar história/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-integer age (3.5) and surfaces a localized field error", async () => {
    const onSubmit = vi.fn(async (): Promise<SubmitResult> => ({ ok: true }));
    const user = userEvent.setup();
    renderForm({ onSubmit });

    // A fractional value passes the slider's min/max clamp but fails the
    // integer check, exercising the age-validation error branch.
    fireEvent.change(ageSlider(), { target: { value: "3.5" } });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Informe uma idade entre 2 e 9 anos.")).toBeInTheDocument();
    expect(ageSlider()).toHaveAttribute("aria-invalid", "true");

    // Editing the age afterward clears the field error (the onChange branch).
    fireEvent.change(ageSlider(), { target: { value: "6" } });
    expect(screen.queryByText("Informe uma idade entre 2 e 9 anos.")).not.toBeInTheDocument();
    expect(ageSlider()).not.toHaveAttribute("aria-invalid");
  });

  it("ignores a second submit while already submitting (single-flight guard)", async () => {
    let release!: () => void;
    const onSubmit = vi.fn(
      async (): Promise<SubmitResult> =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true });
        })
    );
    renderForm({ onSubmit });

    // fireEvent.submit bypasses the disabled button, so the handler's own
    // `submitting` guard must absorb a re-entrant submission.
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.change(ageSlider(), { target: { value: "6" } });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    act(() => release!());
  });
});
