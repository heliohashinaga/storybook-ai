import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryRequestApp } from "../../src/features/story-request/components/story-request-app";
import { LocaleProvider } from "../../src/i18n/locale-provider";
import { requestHome } from "../../src/lib/home-request-event";

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
  fireEvent.change(screen.getByRole("slider", { name: /idade/i }), {
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

  it("shows the loading panel while the story request is in flight", async () => {
    // Defer resolving fetch so the request stays pending long enough for the
    // loading/progress panel to render before a story arrives.
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderApp();

    await submitValidForm();

    // While the request is pending, the progress panel (with a progressbar role)
    // is shown, not the scene reader.
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Resolve with the approved story; the reader replaces the loading panel.
    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    expect(await screen.findByRole("button", { name: /^Próxima$/i })).toBeInTheDocument();
  });

  it("the form's language selector sets the story locale independently of the UI (T056)", async () => {
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
    // T056: the story language is chosen in the form's own selector (decoupled
    // from the header LangToggle, which only drives the UI locale).
    renderApp();

    const user = userEvent.setup();
    fireEvent.change(screen.getByRole("slider", { name: /idade/i }), {
      target: { value: "6" },
    });
    // Pick the English story-language option (the UI stays pt-BR).
    await user.click(screen.getByRole("button", { name: /^inglês$/i }));
    // Theme is a ChoiceCard button; pick the Friendship card (pt-BR UI label).
    await user.click(screen.getByRole("button", { name: /amizade/i }));
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    // The reader chrome stays in the pt-BR UI while the story content is English.
    expect(await screen.findByRole("region", { name: /sua história/i })).toBeInTheDocument();
    expect(screen.getByText("The Dream of the Star")).toBeInTheDocument();

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
    // Nova história: leave the reader for an unfilled form (no auto-generate).
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /nova história/i }));
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();

    // Submitting the fresh form appends a second story instead of replacing.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(second), { status: 200 }))
    );
    fireEvent.change(screen.getByRole("slider", { name: /idade/i }), {
      target: { value: "6" },
    });
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    // The appended story becomes active and the first stays in the switcher.
    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(secondBody).toEqual({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    });
  });

  it("top-nav home request returns from the reader to the form (logo → home)", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(approvedStory), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderApp();

    await submitValidForm();
    expect(await screen.findByRole("button", { name: /^Próxima$/i })).toBeInTheDocument();

    // Simulate a top-nav brand-mark click: a bare router.push("/") would be a
    // client-side no-op on the already-mounted `/`, so the logo emits the shared
    // "home" event. The app must leave the reader for the form.
    act(() => requestHome());

    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();
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

    // Append a second story so the session holds multiple switchable entries:
    // "Nova história" opens an empty form; submitting it generates the next.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(second), { status: 200 }))
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /nova história/i }));
    await user.click(screen.getByRole("button", { name: /criar história/i }));
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
    expect(screen.queryByLabelText(/idade/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criando sua história/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    expect(await screen.findByRole("region", { name: /sua história/i })).toBeInTheDocument();
  });

  it("Nova história keeps the previous story in the session list and appends a new one", async () => {
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
    await screen.findByRole("region", { name: /sua história/i });
    expect(screen.getByText("A missão da estrelinha")).toBeInTheDocument();

    // New story: the reader stays mounted, the previous story stays in the
    // Nova história leaves the reader for an empty form; submitting it then
    // appends a second story instead of wiping the prior one.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(second), { status: 200 }))
    );
    await userEvent.click(screen.getByRole("button", { name: /nova história/i }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();
    // The first story is still listed (not wiped) and the new one is active.
    expect(screen.getByRole("button", { name: /A missão da estrelinha/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /O segredo da floresta \(História ativa\)/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /sua história/i })).toBeInTheDocument();
  });
});
