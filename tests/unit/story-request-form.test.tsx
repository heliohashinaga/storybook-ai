import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
      <StoryRequestForm
        onSubmit={props.onSubmit ?? (async () => ({ ok: true }))}
        onSuccess={props.onSuccess}
      />
    </NextIntlClientProvider>
  );
}

async function fillValidAgeAndSubmit(age = "6") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/idade da criança/i), age);
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

  it("collects only age, language, and theme", () => {
    renderForm();
    expect(screen.getByLabelText(/idade da criança/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/idioma/i)).toBeInTheDocument();
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
    // The locale field remains a select with both locale options.
    expect(screen.getAllByRole("option").length).toBe(2); // pt-BR + en
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
    expect(payload).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 });
    // Never an exact age or a child name.
    expect(Object.keys(payload).sort()).toEqual(["ageBand", "locale", "sceneCount", "theme"]);
    expect(JSON.stringify(payload)).not.toMatch(/name|"age":/i);
  });

  it("sends the user-selected language and theme", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/idade da criança/i), "9");
    await user.selectOptions(screen.getByLabelText(/idioma/i), "en");
    // The form's test provider is fixed to pt-BR, so theme labels stay in pt-BR;
    // pick the "Amizade" card (friendship).
    await user.click(screen.getByRole("button", { name: /amizade/i }));
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ageBand: "8-9",
      locale: "en",
      theme: "friendship",
      sceneCount: 3,
    });
  });

  it("blocks out-of-range age locally without submitting", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/idade da criança/i), "1");
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText(/entre 2 e 9 anos/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks an above-maximum age (10) locally without submitting", async () => {
    const onSubmit = vi.fn(async (_request: GenerateStoryRequest): Promise<SubmitResult> => {
      void _request;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    await user.type(screen.getByLabelText(/idade da criança/i), "10");
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText(/entre 2 e 9 anos/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks an empty age locally without submitting", async () => {
    const onSubmit = vi.fn(async (_r: GenerateStoryRequest): Promise<SubmitResult> => {
      void _r;
      return { ok: true };
    });
    const user = userEvent.setup();
    renderForm({ onSubmit });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText(/entre 2 e 9 anos/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
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
    await user.type(screen.getByLabelText(/idade da criança/i), "6");
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

    await user.type(screen.getByLabelText(/idade da criança/i), "6");
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

    await user.type(screen.getByLabelText(/idade da criança/i), "6");
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("moves focus back to the age input when the submitted age is out of range", async () => {
    const onSubmit = vi.fn();
    renderForm({ onSubmit });
    const user = userEvent.setup();

    // No age typed — submit must fail locally without calling the parent.
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    const input = screen.getByLabelText(/idade da criança/i);
    await waitFor(() => expect(input).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a localized retry on provider failure and can resubmit", async () => {
    const onSubmit = vi
      .fn<(_request: GenerateStoryRequest) => Promise<SubmitResult>>()
      .mockResolvedValueOnce({ ok: false, messageKey: "generationUnavailable" })
      .mockResolvedValueOnce({ ok: true });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderForm({ onSubmit, onSuccess });

    await user.type(screen.getByLabelText(/idade da criança/i), "7");
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText(/gerador de histórias está indisponível/i)).toHaveRole("alert");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /criar história/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
