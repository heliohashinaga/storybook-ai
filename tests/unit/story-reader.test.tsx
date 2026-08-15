import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "../../src/i18n/config";
import { StoryReader } from "../../src/features/story-reader/components/story-reader";
import { SceneView } from "../../src/features/story-reader/components/scene-view";
import { SceneProgress } from "../../src/features/story-reader/components/scene-progress";
import type {
  GeneratedScene,
  GeneratedStory,
} from "../../src/features/story-generation/server/schemas";

const scene = (ordinal: number, body: string): GeneratedScene => ({
  ordinal,
  title: `Título ${ordinal}`,
  body,
  illustrationDataUri: `data:image/webp;base64,cena${ordinal}`,
  altText: `Ilustração da cena ${ordinal} em aquarela.`,
});

const story: GeneratedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  sceneCount: 3,
  safetyDecision: "approved",
  title: "A missão da estrelinha",
  scenes: [
    scene(1, "Era uma vez uma estrelinha."),
    scene(2, "A estrelinha subiu ao céu."),
    scene(3, "E brilhou para sempre."),
  ],
};

function renderReader() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
      <StoryReader story={story} />
    </NextIntlClientProvider>
  );
}

describe("story reader — first/middle/last bounds", () => {
  it("navigates a 5-scene story to the last scene and stops (variable scene count)", async () => {
    const five: GeneratedStory = {
      locale: "pt-BR",
      ageBand: "8-9",
      theme: "courage",
      sceneCount: 5,
      safetyDecision: "approved",
      title: "A grande jornada",
      scenes: [
        scene(1, "A estrelinha parte."),
        scene(2, "Atravessa o rio."),
        scene(3, "Encontra a amiga."),
        scene(4, "Enfrenta a noite."),
        scene(5, "Volta para casa feliz."),
      ],
    };
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
        <StoryReader story={five} />
      </NextIntlClientProvider>
    );
    expect(screen.getByText("A estrelinha parte.")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 5|de 5|of 5|\/5/)).toBeInTheDocument();
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    }
    expect(screen.getByText("Volta para casa feliz.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();
    expect(screen.getByText(/5 \/ 5|de 5|of 5|\/5/)).toBeInTheDocument();
  });

  it("opens on the first scene with only forward navigation enabled", async () => {
    renderReader();

    expect(screen.getByText("Era uma vez uma estrelinha.")).toBeInTheDocument();
    expect(screen.queryByText("A estrelinha subiu ao céu.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Anterior$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeEnabled();
  });

  it("enables both directions on a middle scene", async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));

    expect(screen.getByText("A estrelinha subiu ao céu.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Anterior$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeEnabled();
  });

  it("disables forward navigation on the last scene", async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));

    expect(screen.getByText("E brilhou para sempre.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Anterior$/i })).toBeEnabled();
  });

  it("never navigates past the bounds when clicking the disabled edges", async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole("button", { name: /^Anterior$/i }));
    expect(screen.getByText("Era uma vez uma estrelinha.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    expect(screen.getByText("E brilhou para sempre.")).toBeInTheDocument();
  });
});

describe("story reader — previous/next navigation and progress", () => {
  it("moves forward and backward in order and updates the progress indicator", async () => {
    const user = userEvent.setup();
    renderReader();

    expect(screen.getByText("Cena 1 de 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    expect(screen.getByText("Cena 2 de 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
    expect(screen.getByText("Cena 3 de 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Anterior$/i }));
    expect(screen.getByText("Cena 2 de 3")).toBeInTheDocument();
  });

  it("navigates with the left and right arrow keys while the scene is focused", async () => {
    const user = userEvent.setup();
    renderReader();

    // A keyboard user focuses the scene content, then uses the arrow keys.
    screen.getByRole("heading", { name: /título 1/i }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("A estrelinha subiu ao céu.")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText("Era uma vez uma estrelinha.")).toBeInTheDocument();
  });
});

describe("story reader — focus management", () => {
  it("moves focus to the scene heading when navigating scenes", async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));

    const heading = screen.getByRole("heading", { name: /título 2/i });
    await expect.poll(() => heading).toHaveFocus();
  });

  it("does not steal focus on the initial render", async () => {
    renderReader();

    expect(screen.getByRole("heading", { name: /título 1/i })).not.toHaveFocus();
  });
});

describe("story reader — localized alt text and scene rendering", () => {
  it("renders the illustration with the localized alt text for the current scene", async () => {
    const user = userEvent.setup();
    renderReader();

    const article = screen.getByRole("article", { name: /cena 1/i });
    const img = within(article).getByRole("img");
    expect(img).toHaveAttribute("alt", "Ilustração da cena 1 em aquarela.");
    expect(img).toHaveAttribute("src", "data:image/webp;base64,cena1");

    await user.click(screen.getByRole("button", { name: /^Próxima$/i }));

    const nextArticle = screen.getByRole("article", { name: /cena 2/i });
    expect(within(nextArticle).getByRole("img")).toHaveAttribute(
      "alt",
      "Ilustração da cena 2 em aquarela."
    );
  });

  it("presents each scene as a semantic reading structure (article + heading + body)", async () => {
    renderReader();

    const article = screen.getByRole("article", { name: /cena 1/i });
    expect(within(article).getByRole("heading", { name: /título 1/i })).toBeInTheDocument();
    expect(within(article).getByText("Era uma vez uma estrelinha.")).toBeInTheDocument();
  });
});

describe("scene progress — variable total (US3)", () => {
  it("renders one segment per scene reflecting the real (3–5 variable) total", () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
        <SceneProgress current={3} total={5} label="Posição" />
      </NextIntlClientProvider>
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[2]).toHaveAttribute("aria-current", "step");
  });

  it("marks the last segment active on the final scene", () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
        <SceneProgress current={4} total={4} label="Posição" />
      </NextIntlClientProvider>
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[3]).toHaveAttribute("aria-current", "step");
  });

  it("exposes the position through a labelled list", () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
        <SceneProgress current={1} total={3} label="Posição na história" />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("list", { name: "Posição na história" })).toBeInTheDocument();
  });
});

describe("scene view — standalone illustration header", () => {
  it("renders a scene's full-bleed illustration", async () => {
    render(<SceneView scene={story.scenes[1] ?? scene(1, "fallback")} />);

    expect(screen.getByRole("img")).toHaveAttribute("alt", "Ilustração da cena 2 em aquarela.");
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/webp;base64,cena2");
  });
});

describe("story reader — US4 show more / show less (accessible body collapse)", () => {
  const longBody =
    "Era uma vez uma estrelinha muito curiosa que queria conhecer o mar. " +
    "Ela brilhou forte e desceu até a areia, onde conheceu uma conchinha. " +
    "Juntas enfrentaram a tempestade e descobriram que amizade vence tudo. ".repeat(8);

  // jsdom does no layout: stub scrollHeight/clientHeight so the overflow
  // measurement is deterministic (200 > 100 = overflow, 100 == 100 = fits).
  const originalScrollHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollHeight"
  );
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientHeight"
  );

  function stubLayout(overflows: boolean, isDesktop: boolean) {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => (overflows ? 200 : 100),
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: isDesktop,
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  function restoreLayout() {
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
    }
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
    }
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  afterEach(() => {
    restoreLayout();
  });

  function renderReaderWith(body: string) {
    const longStory: GeneratedStory = {
      ...story,
      scenes: [scene(1, body)],
    };
    return render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
        <StoryReader story={longStory} />
      </NextIntlClientProvider>
    );
  }

  // Desktop (matchMedia >= 640px) with a body long enough to overflow 6 lines:
  // the reader clamps to ~6 lines and renders an accessible "Mostrar mais"
  // button (aria-expanded=false).
  it("clamps a long body on desktop and shows the show-more button (collapsed)", async () => {
    stubLayout(true, true);
    renderReaderWith(longBody);

    const button = await screen.findByRole("button", { name: /mostrar mais/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  // Activating the toggle expands the full body and switches the label +
  // aria-expanded state.
  it("expands the body and switches to 'Mostrar menos' (aria-expanded=true)", async () => {
    const user = userEvent.setup();
    stubLayout(true, true);
    renderReaderWith(longBody);

    const showMore = await screen.findByRole("button", { name: /mostrar mais/i });
    await user.click(showMore);

    const showLess = await screen.findByRole("button", { name: /mostrar menos/i });
    expect(showLess).toHaveAttribute("aria-expanded", "true");
  });

  // Short text: no overflow -> no clamp, no button (no useless control).
  it("renders no show-more button for a short body", async () => {
    stubLayout(false, true);
    renderReaderWith("Era uma vez uma estrelinha.");

    expect(screen.getByText("Era uma vez uma estrelinha.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /mostrar mais|mostrar menos/i })
      ).not.toBeInTheDocument()
    );
  });

  // Mobile (<640px): the body is never clamped, so no button even for long text.
  it("does not clamp or show the button on mobile", async () => {
    stubLayout(true, false);
    renderReaderWith(longBody);

    // body is fully rendered on mobile
    expect(screen.getByText(new RegExp(longBody.slice(0, 40)))).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /mostrar mais|mostrar menos/i })
      ).not.toBeInTheDocument()
    );
  });
});
