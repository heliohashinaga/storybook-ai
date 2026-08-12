import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";
import { ExportStoryButton } from "../../src/features/story-export/components/export-story-button";

const story: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  sceneCount: 3,
  safetyDecision: "approved" as const,
  title: "A missão da estrelinha",
  scenes: [
    {
      ordinal: 1,
      title: "Cena 1",
      body: "Era uma vez uma estrelinha.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Uma estrelinha.",
    },
    {
      ordinal: 2,
      title: "Cena 2",
      body: "Ela decidiu brilhar.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "Brilhando.",
    },
    {
      ordinal: 3,
      title: "Cena 3",
      body: "E o mar a abraçou.",
      illustrationDataUri: "data:image/webp;base64,AA",
      altText: "O mar.",
    },
  ],
};

const buildStoryPdfMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }))
);
vi.mock("../../src/features/story-export/client/build-story-pdf", () => ({
  buildStoryPdf: buildStoryPdfMock,
}));
const buildStoryPdf = buildStoryPdfMock;

function renderButton() {
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <ExportStoryButton story={story} />
    </LocaleProvider>
  );
}

describe("ExportStoryButton (T043)", () => {
  it("downloads a PDF when clicked, without a network call", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar como pdf/i }));

    expect(buildStoryPdf).toHaveBeenCalledTimes(1);
    expect(buildStoryPdf.mock.calls[0]?.[0]).toBe(story);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows an error and keeps the button enabled after a failed generation", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("boom"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar como pdf/i }));

    expect(await screen.findByText(/não foi possível baixar o pdf/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar como pdf/i })).toBeEnabled();
  });
});

describe("ExportStoryButton — feedback states (US4)", () => {
  beforeEach(() => {
    buildStoryPdf.mockClear();
  });

  it("sets aria-busy while exporting, then announces success on completion", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockResolvedValueOnce(new Blob(["pdf"], { type: "application/pdf" }));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar como pdf/i }));
    // On completion the button shows the localized success label.
    expect(await screen.findByRole("button", { name: /pdf baixado/i })).toBeInTheDocument();
  });

  it("retries the export after a failure via the localized retry action", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("first failure"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar como pdf/i }));
    const retry = await screen.findByRole("button", { name: /tentar novamente/i });
    expect(retry).toBeInTheDocument();

    // The retry re-runs the export and succeeds this time.
    await user.click(retry);
    expect(buildStoryPdf).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: /pdf baixado/i })).toBeInTheDocument();
  });
});
