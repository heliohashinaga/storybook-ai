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

    // The trigger is an icon-only button addressed by its accessible label.
    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    expect(buildStoryPdf).toHaveBeenCalledTimes(1);
    expect(buildStoryPdf.mock.calls[0]?.[0]).toBe(story);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("shows an error below the trigger and keeps the button enabled after a failure", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("boom"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    // Error surfaces as a plain alert (no retry link); retry is done by
    // clicking the download trigger again.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/não foi possível baixar o pdf/i);
    expect(alert.querySelector("button")).toBeNull();
    expect(screen.getByRole("button", { name: /baixar pdf/i })).toBeEnabled();
  });
});

describe("ExportStoryButton — feedback states (US4)", () => {
  beforeEach(() => {
    buildStoryPdf.mockClear();
  });

  it("announces success via a status live region without changing the trigger label", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockResolvedValueOnce(new Blob(["pdf"], { type: "application/pdf" }));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    // The trigger label stays static; success is announced separately.
    expect(await screen.findByRole("status")).toHaveTextContent(/pdf baixado/i);
    expect(screen.getByRole("button", { name: /baixar pdf/i })).toBeInTheDocument();
  });

  it("retries the export when clicking the download trigger again after a failure", async () => {
    const user = userEvent.setup();
    buildStoryPdf.mockRejectedValueOnce(new Error("first failure"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    await screen.findByRole("alert");

    // Retry is the trigger itself: clicking it once more retries the export.
    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    expect(buildStoryPdf).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("status")).toHaveTextContent(/pdf baixado/i);
  });

  it("downloads the blob via a temporary anchor (browserDownload) — no network", async () => {
    const user = userEvent.setup();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));
    await screen.findByRole("status");

    // The rendered blob is handed to the real browserDownload helper.
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    anchorClick.mockRestore();
  });

  it("shows only the spinner (no download icon) while exporting", async () => {
    const user = userEvent.setup();
    let release!: (blob: Blob) => void;
    buildStoryPdf.mockImplementationOnce(() => new Promise<Blob>((resolve) => (release = resolve)));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    // While exporting the button is disabled and shows an inline spinner
    // (arc svg) instead of the download glyph. The spinner arc is the path
    // `M21 12a9...`; the download icon's polyline is absent.
    const trigger = screen.getByRole("button", { name: /baixar pdf/i });
    expect(trigger).toBeDisabled();
    const spinner = trigger.querySelector("svg[aria-hidden='true'] path");
    expect(spinner).not.toBeNull();
    expect(trigger.querySelector("polyline")).toBeNull();

    release(new Blob(["pdf"], { type: "application/pdf" }));
    await screen.findByRole("status");
  });

  it("ignores a second click while an export is already in flight", async () => {
    const user = userEvent.setup();
    let release!: (blob: Blob) => void;
    buildStoryPdf.mockImplementationOnce(() => new Promise<Blob>((resolve) => (release = resolve)));
    renderButton();

    await user.click(screen.getByRole("button", { name: /baixar pdf/i }));

    // While exporting the button is disabled (loading), so a second activation
    // is a no-op — the PDF builder is never called a second time.
    const trigger = screen.getByRole("button", { name: /baixar pdf/i });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(buildStoryPdf).toHaveBeenCalledTimes(1);

    release(new Blob(["pdf"], { type: "application/pdf" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/pdf baixado/i);
  });
});
