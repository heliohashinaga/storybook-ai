import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryRequestApp } from "../../src/features/story-request/components/story-request-app";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import { LangToggle } from "../../src/features/shell/components/lang-toggle";

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
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
  });

  it("sends only ageBand/locale/theme and shows the approved story on success", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(approvedStory), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderApp();

    await submitValidForm();

    expect(await screen.findByRole("region", { name: /sua história/i })).toBeInTheDocument();
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
        await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
      }
    }
    // Forward bound: the last scene disables "next".
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();

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
    // T056: locale switching happens at the app shell via LangToggle (ADR
    // 0003); the whole tree shares one LocaleProvider so the form follows.
    render(
      <LocaleProvider defaultLocale="pt-BR">
        <LangToggle />
        <StoryRequestApp />
      </LocaleProvider>
    );

    const user = userEvent.setup();
    fireEvent.change(screen.getByRole("slider", { name: /idade da criança/i }), {
      target: { value: "6" },
    });
    await user.click(screen.getByRole("button", { name: /^english$/i }));
    // The whole UI flips to English immediately after the locale selection.
    // Theme is a ChoiceCard button; pick the Friendship card.
    await user.click(screen.getByRole("button", { name: /friendship/i }));
    await user.click(screen.getByRole("button", { name: /create story/i }));

    // The reader chrome is English once the story language is English.
    expect(await screen.findByRole("region", { name: /your story/i })).toBeInTheDocument();
    expect(screen.getByText("The Dream of the Star")).toBeInTheDocument();
    expect(screen.getByText("Scene 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next$/i })).toBeEnabled();

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
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
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
    expect(screen.getAllByText(/escrevendo sua história/i).length).toBeGreaterThan(0);
    // Blossom-style: the request form is unmounted while the story is being
    // generated, so only the progress panel occupies the screen.
    expect(screen.queryByLabelText(/idade da criança/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criando sua história/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    expect(await screen.findByRole("region", { name: /sua história/i })).toBeInTheDocument();
  });

  it("returns to the form after creating another story", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    renderApp();

    await submitValidForm();
    await screen.findByRole("region", { name: /sua história/i });

    await userEvent.click(screen.getByRole("button", { name: /nova história/i }));
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
    expect(screen.getByText("Storybook AI")).toBeInTheDocument();
  });
});
