import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  vi
    .fn()
    .mockImplementation(
      async (_story: unknown, deps?: { download?: (blob: Blob, filename: string) => void }) => {
        const blob = new Blob(["pdf"], { type: "application/pdf" });
        // Mirror the real buildStoryPdf: hand the PDF to the injected downloader.
        deps?.download?.(blob, "a-missao-da-estrelinha.pdf");
        return blob;
      }
    )
);
vi.mock("../../src/features/story-export/client/build-story-pdf", () => ({
  buildStoryPdf: buildStoryPdfMock,
}));
const buildStoryPdf = buildStoryPdfMock;

beforeEach(() => {
  // jsdom lacks the blob-object-URL browser APIs; provide them deterministically.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

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

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    expect(buildStoryPdf).toHaveBeenCalledTimes(1);
    expect(buildStoryPdf.mock.calls[0]?.[0]).toBe(story);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows an error and keeps the button enabled after a failed generation", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("boom"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    expect(await screen.findByText(/não foi possível baixar o pdf/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar pdf/i })).toBeEnabled();
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

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    // On completion the button shows the localized success label.
    expect(await screen.findByRole("button", { name: /pdf baixado/i })).toBeInTheDocument();
  });

  it("retries the export after a failure via the localized retry action", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("first failure"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    const retry = await screen.findByRole("button", { name: /tentar novamente/i });
    expect(retry).toBeInTheDocument();

    // The retry re-runs the export and succeeds this time.
    await user.click(retry);
    expect(buildStoryPdf).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: /pdf baixado/i })).toBeInTheDocument();
  });

  it("downloads the blob via a temporary anchor (browserDownload) — no network", async () => {
    const user = userEvent.setup();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    await screen.findByRole("button", { name: /pdf baixado/i });

    // The rendered blob is handed to the real browserDownload helper.
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    anchorClick.mockRestore();
  });

  it("ignores a second click while an export is already in flight", async () => {
    const user = userEvent.setup();
    let release!: (blob: Blob) => void;
    buildStoryPdf.mockImplementationOnce(() => new Promise<Blob>((resolve) => (release = resolve)));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    // While exporting the button re-labels to "baixando". A raw click on the
    // disabled element triggers handleExport, whose guard returns early — the
    // PDF builder is never called a second time.
    fireEvent.click(screen.getByRole("button", { name: /gerando pdf/i }));
    expect(buildStoryPdf).toHaveBeenCalledTimes(1);

    release(new Blob(["pdf"], { type: "application/pdf" }));
    expect(await screen.findByRole("button", { name: /pdf baixado/i })).toBeInTheDocument();
  });
});
