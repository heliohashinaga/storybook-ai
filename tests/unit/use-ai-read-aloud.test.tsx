import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAiReadAloud } from "../../src/features/story-read-aloud/client/use-ai-read-aloud";
import type { NarrationStatus } from "../../src/features/story-read-aloud/client/tts-state";
import { fakeMp3Bytes } from "./tts/fake";

/**
 * useAiReadAloud (spec 004 — US1 happy path, US2 controlled error, US3
 * on-demand/zero-persistence). Deterministic fakes only — never a live TTS.
 */

class MockUtterance {
  text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

type SpeechMock = {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  calls: () => MockUtterance[];
};

const ptBRVoice = {
  default: false,
  lang: "pt-BR",
  localService: true,
  name: "Teste PT",
  voiceURI: "teste-pt",
} as SpeechSynthesisVoice;

function mockSpeech(): SpeechMock {
  const spoken: MockUtterance[] = [];
  const speech = {
    speak: vi.fn((u: MockUtterance) => {
      spoken.push(u);
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [ptBRVoice]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    calls: () => spoken,
  };
  Object.defineProperty(window, "speechSynthesis", {
    value: speech,
    configurable: true,
    writable: true,
  });
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;
  return speech;
}

/** Minimal Audio stub so `new Audio(url)` + `play()` work in jsdom.
 * Returns a real <audio> element (a valid Node for appendChild) with play()
 * mocked, so the production path that attaches the element to the DOM is
 * exercised without a custom-element registry error. */
const audioInstances: HTMLAudioElement[] = [];
function createMockAudio(url: string): HTMLAudioElement {
  const el = document.createElement("audio");
  el.src = url;
  el.play = vi.fn(() => Promise.resolve()) as unknown as typeof el.play;
  el.pause = vi.fn() as unknown as typeof el.pause;
  audioInstances.push(el);
  return el;
}
// Emulate `new Audio(url)` while keeping the created element a real Node.
const MockAudio = createMockAudio as unknown as { new (url: string): HTMLAudioElement };
Object.defineProperty(MockAudio, "instances", { get: () => audioInstances });

type FetchScenario = "ok" | "disabled" | "error";

const SCENE_TEXT = "Era uma vez uma estrelinha no céu.";
const ERROR_LABEL = "Não foi possível reproduzir o áudio. Tente novamente.";

function installAudioMocks() {
  const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-narration");
  const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  audioInstances.length = 0;
  vi.stubGlobal("Audio", MockAudio);
  return { createObjectUrl, revokeObjectUrl };
}

function installFetchMock(scenario: FetchScenario) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    switch (scenario) {
      case "ok":
        return new Response(fakeMp3Bytes(), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      case "disabled":
        return new Response(null, { status: 204 });
      default:
        return new Response(JSON.stringify({ code: "narration_unavailable" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAiReadAloud(props: { text?: string; locale?: string; errorLabel?: string } = {}) {
  // The callback consumes `p` so RTL's `rerender(newProps)` injects the
  // updated props (used to simulate a locale switch while an error is shown).
  return renderHook((p: { text?: string; locale?: string; errorLabel?: string } = props) =>
    useAiReadAloud({
      text: p.text ?? SCENE_TEXT,
      locale: p.locale ?? "pt-BR",
      errorLabel: p.errorLabel ?? ERROR_LABEL,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true });
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = undefined;
  audioInstances.length = 0;
});

beforeEach(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;
});

describe("useAiReadAloud — US1 happy path (AI narration)", () => {
  it("is idle with mode 'ai' before any interaction and never calls /narrate early (US3)", () => {
    const fetchMock = installFetchMock("ok");
    const { result } = renderAiReadAloud();

    expect(result.current.status).toBe("idle");
    expect(result.current.mode).toBe("ai");
    expect(result.current.speaking).toBe(false);
    expect(result.current.supported).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toggle() POSTs only sceneText/locale and plays the AI audio Blob (US1/US3)", async () => {
    const fetchMock = installFetchMock("ok");
    const { createObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/narrate");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    // Anonymous contract: only sceneText + locale, no identifier.
    expect(JSON.parse(String(init.body))).toEqual({ sceneText: SCENE_TEXT, locale: "pt-BR" });

    await waitFor(() => expect(result.current.status).toBe("speaking"));
    expect(result.current.mode).toBe("ai");
    expect(result.current.speaking).toBe(true);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });

  it("stop() revokes the transient object URL and returns to idle (US3)", async () => {
    installFetchMock("ok");
    const { revokeObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));

    act(() => result.current.stop());

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-narration");
    expect(result.current.status).toBe("idle");
    expect(result.current.speaking).toBe(false);
  });

  it("a second toggle while speaking stops the narration (single control)", async () => {
    installFetchMock("ok");
    const { revokeObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(revokeObjectUrl).toHaveBeenCalled();
  });

  it("unmount revokes any pending object URL (zero persistence, US3)", async () => {
    installFetchMock("ok");
    const { revokeObjectUrl } = installAudioMocks();
    const { result, unmount } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));

    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock-narration");
  });

  it("audio onended releases the object URL and returns to idle", async () => {
    installFetchMock("ok");
    const { revokeObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));

    // Playback finishes: fire the Audio element's onended callback.
    act(() => {
      const audio = audioInstances.at(-1);
      audio?.onended?.(new Event("ended"));
    });

    expect(result.current.status).toBe("idle");
    expect(revokeObjectUrl).toHaveBeenCalled();
  });

  it("audio onerror also cleans up and returns to idle", async () => {
    installFetchMock("ok");
    const { revokeObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));

    act(() => {
      const audio = audioInstances.at(-1);
      audio?.onerror?.(new Event("error"));
    });

    expect(result.current.status).toBe("idle");
    expect(revokeObjectUrl).toHaveBeenCalled();
  });

  it("does nothing on toggle with empty text", () => {
    const fetchMock = installFetchMock("ok");
    const { result } = renderAiReadAloud({ text: "" });

    act(() => result.current.toggle());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});

describe("useAiReadAloud — 204 delegates to Web Speech (AI disabled)", () => {
  it("switches mode to 'system' and reads via speechSynthesis without AI audio", async () => {
    const speech = mockSpeech();
    const fetchMock = installFetchMock("disabled");
    const { createObjectUrl } = installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.mode).toBe("system"));
    // Web Speech is speaking → the accessible control reflects an in-progress
    // narration ("parar leitura"), not an idle/"ouvir" state.
    await waitFor(() => expect(result.current.status).toBe("speaking"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.calls()[0]!.text).toBe(SCENE_TEXT);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});

describe("useAiReadAloud — US2 controlled error (no Web Speech fallback)", () => {
  it("updates the error message when the locale changes after the error (no frozen string)", async () => {
    const speech = mockSpeech();
    const fetchMock = installFetchMock("error");
    const EN_ERROR_LABEL = "We couldn't play the audio. Please try again.";
    const { result, rerender } = renderAiReadAloud({ errorLabel: ERROR_LABEL });

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe(ERROR_LABEL);

    // User switches language (pt-BR → en) while the error is still shown.
    // The error label is re-derived from the new locale, not frozen at failure.
    rerender({ errorLabel: EN_ERROR_LABEL, text: SCENE_TEXT, locale: "en" });
    expect(result.current.errorMessage).toBe(EN_ERROR_LABEL);
    expect(result.current.status).toBe("error");
    // US2 invariant preserved: no Web Speech fallback on locale switch.
    expect(speech.speak).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enters an accessible error state on 502 and never falls back to Web Speech", async () => {
    const speech = mockSpeech();
    const fetchMock = installFetchMock("error");
    const { result } = renderAiReadAloud({ errorLabel: ERROR_LABEL });

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.mode).toBe("ai");
    expect(result.current.errorMessage).toBe(ERROR_LABEL);
    expect(result.current.speaking).toBe(false);
    // US2: no Web Speech utterance is ever issued.
    expect(speech.speak).not.toHaveBeenCalled();
    // No infinite retry: exactly one /narrate call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers to idle on a later toggle after an error", async () => {
    mockSpeech();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "narration_unavailable" }), { status: 502 })
    );
    fetchMock.mockResolvedValueOnce(
      new Response(fakeMp3Bytes(), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    installAudioMocks();

    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.status).toBe("speaking"));
    expect(result.current.mode).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useAiReadAloud — statuses exposed to the accessible control", () => {
  it("reports 'busy' while the server request is in flight", async () => {
    let resolveFetch: ((r: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)))
    );
    installAudioMocks();
    const { result } = renderAiReadAloud();

    act(() => result.current.toggle());
    expect(result.current.status).toBe("busy");

    act(() => resolveFetch?.(new Response(fakeMp3Bytes(), { status: 200 })));
    await waitFor(() => expect(result.current.status).toBe("speaking"));
  });
});

/**
 * Type-level assertion: the statuses consumed by the a11y control are exactly
 * the NarrationStatus union (compile-time guard, no runtime cost).
 */
const _statusGuard: Record<NarrationStatus, true> = {
  idle: true,
  busy: true,
  speaking: true,
  stopping: true,
  error: true,
};
void _statusGuard;
