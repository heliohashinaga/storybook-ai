import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { StoryRequestApp } from "../../src/features/story-request/components/story-request-app";
import { getMessages } from "../../src/i18n/config";

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
    <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
      <StoryRequestApp defaultLocale="pt-BR" />
    </NextIntlClientProvider>
  );
}

async function submitValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/idade da criança/i), "6");
  await user.click(screen.getByRole("button", { name: /criar história/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryRequestApp — flow", () => {
  it("starts on the request form and never shows a reader initially", () => {
    renderApp();
    expect(screen.getByText("Crie uma história personalizada")).toBeInTheDocument();
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
    expect(screen.getAllByRole("img")).toHaveLength(3);
    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("alt");
    }

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/stories");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "courage" });
    expect(JSON.stringify(body)).not.toMatch(/"name"/i);
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
    expect(screen.getByRole("button")).toBeDisabled();

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
    expect(screen.getByText("Crie uma história personalizada")).toBeInTheDocument();
  });
});
