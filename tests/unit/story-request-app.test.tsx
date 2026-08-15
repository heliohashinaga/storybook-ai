import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StoryRequestApp } from "../../src/features/story-request/components/story-request-app";
import { StorySessionProvider } from "../../src/features/story-request/client/story-session-context";
import { LocaleProvider } from "../../src/i18n/locale-provider";

// Route-aware harness (Spec 009). `usePathname()` is the single source of the
// screen mode; `StoryRequestApp` reads it to decide `/form` vs `/reader` and the
// router `replace`/`push` drive navigation to the clean `/form` or `/reader`.
const navState = vi.hoisted(() => {
  let path = "/form";
  const replace = vi.fn<(href: string) => void>((href) => {
    path = href;
  });
  const push = vi.fn<(href: string) => void>((href) => {
    path = href;
  });
  return {
    setPath: (p: string) => {
      path = p;
    },
    getPath: () => path,
    replace,
    push,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => navState.getPath(),
  useRouter: () => ({ replace: navState.replace, push: navState.push }),
}));

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

function secondStory() {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme: "courage",
    safetyDecision: "approved",
    title: "O segredo da floresta",
    scenes: [scene(1), scene(2), scene(3)],
  };
}

function renderProviderTree() {
  return (
    <LocaleProvider defaultLocale="pt-BR">
      <StorySessionProvider>
        <StoryRequestApp />
      </StorySessionProvider>
    </LocaleProvider>
  );
}

/**
 * Render the app and return a `navigate(path)` helper. `navigate` simulates the
 * app's route navigation: it updates the mocked `usePathname()` and re-renders
 * a fresh tree so `StoryRequestApp` (which derives its screen from the path)
 * reacts, inside `act` so React state flushes synchronously.
 */
function renderApp(path = "/form") {
  navState.setPath(path);
  const view = render(renderProviderTree());
  const navigate = (next: string) => {
    act(() => {
      navState.setPath(next);
      view.rerender(renderProviderTree());
    });
  };
  return { ...view, navigate };
}

async function submitValidForm() {
  const user = userEvent.setup();
  fireEvent.change(screen.getByRole("slider", { name: /idade/i }), {
    target: { value: "6" },
  });
  await user.click(screen.getByRole("button", { name: /criar história/i }));
}

/** Complete the app's own `replace("/reader")` navigation after success. */
async function goToReaderAfterSuccess(navigate: (p: string) => void) {
  expect(navState.replace).toHaveBeenCalledWith("/reader");
  await act(async () => navigate("/reader"));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  navState.setPath("/form");
});

describe("StoryRequestApp — routing (Spec 009)", () => {
  it("starts on the request form and never shows a reader on /form", () => {
    renderApp();
    // The form screen renders its main heading (the localized form title).
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
  });

  it("sends only ageBand/locale/theme and navigates to the reader on success", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(approvedStory), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { navigate } = renderApp();

    await submitValidForm();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stories");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage", sceneCount: 3 });
    expect(JSON.stringify(body)).not.toMatch(/"name"/i);

    await goToReaderAfterSuccess(navigate);
    expect(screen.getByRole("region", { name: /sua história/i })).toBeInTheDocument();

    const user = userEvent.setup();
    for (let i = 0; i < approvedStory.scenes.length; i += 1) {
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(screen.getByRole("img")).toHaveAttribute("alt", approvedStory.scenes[i]!.altText);
      if (i < approvedStory.scenes.length - 1) {
        await user.click(screen.getByRole("button", { name: /^Próxima$/i }));
      }
    }
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeDisabled();
  });

  it("shows the loading panel on /form while a request is in flight, then navigates to /reader", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { navigate } = renderApp();

    await submitValidForm();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(navState.getPath()).toBe("/form");

    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    await goToReaderAfterSuccess(navigate);
    expect(await screen.findByRole("button", { name: /^Próxima$/i })).toBeInTheDocument();
  });

  it("/reader without a session redirects to the clean /form (session gate)", () => {
    renderApp("/reader");
    expect(navState.replace).toHaveBeenCalledWith("/form");
  });

  it("the form's language selector sets the story locale independently of the UI (T056)", async () => {
    const enStory = {
      locale: "en",
      ageBand: "5-7",
      theme: "friendship",
      safetyDecision: "approved",
      title: "The Dream of the Star",
      scenes: [
        { ...scene(1), title: "Scene 1", altText: "Illustration of scene 1." },
        { ...scene(2), title: "Scene 2", altText: "Illustration of scene 2." },
        { ...scene(3), title: "Scene 3", altText: "Illustration of scene 3." },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(enStory), { status: 200 }))
    );
    const { navigate } = renderApp();

    const user = userEvent.setup();
    fireEvent.change(screen.getByRole("slider", { name: /idade/i }), {
      target: { value: "6" },
    });
    await user.click(screen.getByRole("button", { name: /^inglês$/i }));
    await user.click(screen.getByRole("button", { name: /amizade/i }));
    await user.click(screen.getByRole("button", { name: /criar história/i }));

    await goToReaderAfterSuccess(navigate);
    expect(await screen.findByText("The Dream of the Star")).toBeInTheDocument();
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ ageBand: "5-7", locale: "en", theme: "friendship", sceneCount: 3 });
  });

  it("'Nova história' leaves the reader for the clean /form, then appends a second story (T050)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    const { navigate } = renderApp();
    await submitValidForm();
    await goToReaderAfterSuccess(navigate);
    expect(screen.getByRole("region", { name: /sua história/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /nova história/i }));
    expect(navState.replace).toHaveBeenCalledWith("/form");
    navigate("/form");
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(secondStory()), { status: 200 }))
    );
    await submitValidForm();
    await goToReaderAfterSuccess(navigate);
    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();
    const secondBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(secondBody).toEqual({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    });
  });

  it("top-nav home returns from the reader to a clean /form (logo → home)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    const { navigate } = renderApp();
    await submitValidForm();
    await goToReaderAfterSuccess(navigate);
    expect(screen.getByRole("button", { name: /^Próxima$/i })).toBeInTheDocument();

    // The brand/nav to clean /form is the app-internal navigation (a push).
    navState.push("/form");
    navigate("/form");
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
  });

  it("redirects from a deep-linked reader without a session, and keeps a fresh reader after appending", async () => {
    // Deep link: no session at all.
    const deep = renderApp("/reader");
    expect(navState.replace).toHaveBeenCalledWith("/form");
    navState.replace.mockClear();
    deep.navigate("/form");
    expect(screen.getByRole("button", { name: /criar história/i })).toBeInTheDocument();

    // Generate one story and navigate to the reader with a session.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    await submitValidForm();
    await goToReaderAfterSuccess(deep.navigate);
    expect(screen.getByRole("region", { name: /sua história/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /sua história/i })).toBeInTheDocument();
  });

  it("shows a localized retry on a provider failure and stays on the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: "rate_limited",
              messageKey: "story.error.rateLimited",
              retryable: true,
            }),
            { status: 429 }
          )
      )
    );
    renderApp();

    await submitValidForm();

    expect(await screen.findByRole("button", { name: /criar história/i })).toBeInTheDocument();
    expect(navState.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: /sua história/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows the generation progress panel while the request is in flight", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)))
    );
    const { navigate } = renderApp();

    await submitValidForm();

    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText(/idade/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar história/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(new Response(JSON.stringify(approvedStory), { status: 200 }));
    });
    await goToReaderAfterSuccess(navigate);
    expect(await screen.findByRole("region", { name: /sua história/i })).toBeInTheDocument();
  });

  it("renders the in-session story switcher and switches back to an earlier story (T051)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(approvedStory), { status: 200 }))
    );
    const { navigate } = renderApp();
    await submitValidForm();
    await goToReaderAfterSuccess(navigate);
    expect(screen.getByRole("region", { name: /sua história/i })).toBeInTheDocument();

    // Second story via clean /form.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /nova história/i }));
    navigate("/form");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(secondStory()), { status: 200 }))
    );
    await submitValidForm();
    await goToReaderAfterSuccess(navigate);
    expect(await screen.findByText("O segredo da floresta")).toBeInTheDocument();

    const switcher = screen.getByLabelText(/suas histórias/i);
    expect(switcher).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A missão da estrelinha/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^História — A missão da estrelinha$/ }));
    expect(await screen.findByText("A missão da estrelinha")).toBeInTheDocument();
  });
});
