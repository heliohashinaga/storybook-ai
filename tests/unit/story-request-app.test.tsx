import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryRequestApp } from "../../src/features/story-request/components/story-request-app";
import { LocaleProvider } from "../../src/i18n/locale-provider";

const webpDataUri = "data:image/webp;base64,QUJDRA";

function scene(ordinal: number) {
  return {
    ordinal,
    title: `Cena ${ordinal}`,
    body: `Texto da cena ${ordinal}.`,
    illustrationDataUri: webpDataUri,
    altText: `Ilustração da cena ${ordinal}.`,
  };
}

const approvedStory = {
  locale: "pt-BR",
  ageBand: "5-7",
  theme: "courage",
  safetyDecision: "approved",
  title: "A missão da estrelinha",
  scenes: [scene(1), scene(2), scene(3)],
};

function renderApp() {
  return render(
    <LocaleProvider defaultLocale="pt-BR">
      <StoryRequestApp />
    </LocaleProvider>
  );
}

async function submitValidForm() {
  const user = userEvent.setup();
  fireEvent.change(screen.getByRole("slider", { name: /idade da criança/i }), {
    target: { value: "6" },
  });
  await user.click(screen.getByRole("button", { name: /criar história/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryRequestApp — flow", () => {
  it("starts on the request form and never shows a reader initially", () => {
    renderApp();
    expect(screen.getByText("Storybook AI")).toBeInTheDocument();
    expect(screen.queryByText("Sua história")).not.toBeInTheDocument();
  });

  it("sends only ageBand/locale/theme and shows the approved story on success", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(approvedStory), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderApp();

    await submitValidForm();

    expect(await screen.findByText("Sua história")).toBeInTheDocument();
    expect(screen.getByText("A missão da estrelinha")).toBeInTheDocument();
    // The reader (T040) shows exactly one scene at a time; every scene is
    // reachable via the "next" button and carries a localized alt text.
    const user = userEvent.setup();
    for (let i = 0; i < approvedStory.scenes.length; i += 1) {
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img")).toHaveAttribute("alt", approvedStory.scenes[i]!.altText);
      expect(
        screen.getByText(`Cena ${i + 1} de ${approvedStory.scenes.length}`)
      ).toBeInTheDocument();
      if (i < approvedStory.scenes.length - 1) {
        await user.click(screen.getByRole("button", { name: /próxima cena/i }));
      }
    }
    // Forward bound: the last scene disables "next".
    expect(screen.getByRole("button", { name: /próxima cena/i })).toBeDisabled();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stories");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 });
    expect(JSON.stringify(body)).not.toMatch(/"name"/i);
  });

  it("switches UI and story language together when English is selected (T056)", async () => {
    const enStory = {
      locale: "en",
      ageBand: "5-7",
      theme: "friendship",
      safetyDecision: "approved",
      title: "The Dream of the Star",
      scenes: [
        {
          ordinal: 1,
          title: "Scene 1",
          body: "Once upon a time.",
          illustrationDataUri: webpDataUri,
          altText: "Illustration of scene 1.",
        },
        {
          ordinal: 2,
          title: "Scene 2",
          body: "The star smiled.",
          illustrationDataUri: webpDataUri,
          altText: "Illustration of scene 2.",
        },
        {
          ordinal: 3,
          title: "Scene 3",
          body: "The sea embraced it.",
          illustrationDataUri: webpDataUri,
          altText: "Illustration of scene 3.",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(enStory), { status: 200 }))
    );
    renderApp();

    const user = userEvent.setup();
    fireEvent.change(screen.getByRole("slider", { name: /idade da criança/i }), {
      target: { value: "6" },
    });
    await user.selectOptions(screen.getByLabelText(/idioma/i), "en");
    // The whole UI flips to English immediately after the locale selection.
    // Theme is a ChoiceCard button; pick the Friendship card.
    await user.click(screen.getByRole("button", { name: /friendship/i }));
    await user.click(screen.getByRole("button", { name: /create story/i }));

    // The reader chrome is English once the story language is English.
    expect(await screen.findByText("Your story")).toBeInTheDocument();
    expect(screen.getByText("The Dream of the Star")).toBeInTheDocument();
    expect(screen.getByText("Scene 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next scene/i })).toBeEnabled();

    // Privacy contract: the payload carries only the derived values.
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ ageBand: "5-7", locale: "en", theme: "friendship", sceneCount: 3 });
    expect(JSON.stringify(body)).not.toMatch(/"name"/i);
  });

  it("generate another reuses last preferences and appends a second story (T050)", async () => {
    const second = {
      locale: "pt-BR",
      ageBand: "5-7",
      theme: "courage",
      safetyDecision: "approved",
      title: "O segredo da floresta",
      scenes: [scene(1), scene(2), scene(3)],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    renderApp();
    await submitValidForm();

    expect(await screen.findByText("A missão da estrelinha")).toBeInTheDocument();
    // The in-memory age/locale/theme are reused: the "generate another"
    // button appears only once we have stored preferences.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(second), { status: 200 }))
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /gerar outra história/i }));

    // The new story becomes active and the payload reused age/locale/theme.
    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(secondBody).toEqual({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    });
  });

  it("renders the in-session story switcher and switches back to an earlier story (T051)", async () => {
    const second = {
      locale: "pt-BR",
      ageBand: "5-7",
      theme: "friendship",
      safetyDecision: "approved",
      title: "O segredo da floresta",
      scenes: [scene(1), scene(2), scene(3)],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    renderApp();
    await submitValidForm();
    expect(await screen.findByText("A missão da estrelinha")).toBeInTheDocument();

    // Append a second story so the session holds multiple switchable entries.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(second), { status: 200 }))
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /gerar outra história/i }));
    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();

    // The accessible switcher groups the stories and marks the active one.
    const switcher = screen.getByLabelText("Suas histórias");
    expect(switcher).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A missão da estrelinha/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /O segredo da floresta \(História ativa\)/i })
    ).toBeInTheDocument();

    // Switching back to the first story selects it and keeps it fully readable.
    // Exact aria-label match targets only the non-active first-story button.
    await user.click(screen.getByRole("button", { name: /^História — A missão da estrelinha$/ }));
    expect(await screen.findByText("A missão da estrelinha")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /A missão da estrelinha \(História ativa\)/i })
    ).toBeInTheDocument();
  });

  it("shows a localized retry on a provider failure and stays on the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "rate_limited",
              messageKey: "story.error.tryAgainLater",
              retryable: true,
            }),
            { status: 429 }
          )
      )
    );
    renderApp();

    await submitValidForm();

    expect(await screen.findByText(/muitas solicitações/i)).toBeInTheDocument();
    expect(screen.queryByText("Sua história")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();
  });

  it("shows the generation progress panel while the request is in flight", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)))
    );
    renderApp();

    await submitValidForm();

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/escrevendo e ilustrando/i)).toBeInTheDocument();
    // The request form stays mounted (fields disabled + button announced), so
    // its localized retry error still renders on failure; the progress panel
    // replaces the form heading while generating.
    expect(screen.getByLabelText(/idade da criança/i)).toBeInTheDocument();
    // The submit button shows its busy label and is disabled while loading.
    expect(screen.getByRole("button", { name: /criando sua história/i })).toBeDisabled();

    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    expect(await screen.findByText("Sua história")).toBeInTheDocument();
  });

  it("returns to the form after creating another story", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    renderApp();

    await submitValidForm();
    await screen.findByText("Sua história");

    await userEvent.click(screen.getByRole("button", { name: /criar outra história/i }));
    expect(screen.queryByText("Sua história")).not.toBeInTheDocument();
    expect(screen.getByText("Storybook AI")).toBeInTheDocument();
  });
});
