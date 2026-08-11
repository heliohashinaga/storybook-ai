import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import type { GeneratedStory } from "../../src/features/story-generation/server/schemas";
import { ExportStoryButton } from "../../src/features/story-export/components/export-story-button";

const story: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
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
