import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReadAloud } from "../../src/features/story-reader/client/use-read-aloud";

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

const enVoice = {
  default: false,
  lang: "en-US",
  localService: true,
  name: "Teste EN",
  voiceURI: "teste-en",
} as SpeechSynthesisVoice;

function mockSpeech(): SpeechMock {
  const spoken: MockUtterance[] = [];
  const speech = {
    speak: vi.fn((u: MockUtterance) => {
      spoken.push(u);
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [ptBRVoice, enVoice]),
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

function withoutSpeech() {
  Object.defineProperty(window, "speechSynthesis", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "speechSynthesis", { configurable: true, writable: true });
});
beforeEach(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;
});

describe("useReadAloud (US2 — leitura em voz alta)", () => {
  it("exposes supported=false when the browser has no speech synthesis", () => {
    withoutSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "Olá", locale: "pt-BR" }));
    expect(result.current.supported).toBe(false);
    expect(result.current.speaking).toBe(false);
  });

  it("starts speaking on toggle and stops on a second toggle (single control)", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() =>
      useReadAloud({ text: "A estrelinha brilhou.", locale: "pt-BR" })
    );

    expect(result.current.supported).toBe(true);
    expect(result.current.speaking).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(true);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    const utt = speech.calls()[0]!;
    expect(utt.text).toBe("A estrelinha brilhou.");
    expect(utt.lang.startsWith("pt-BR")).toBe(true);
    expect(utt.voice).toBe(ptBRVoice);

    // Toggling again stops without issuing a second utterance.
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(false);
    expect(speech.cancel).toHaveBeenCalledTimes(1);
  });

  it("does not start a second utterance while already speaking", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "Cena.", locale: "pt-BR" }));
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    // The first toggle stops; a third re-synthesizes once.
    act(() => result.current.toggle());
    expect(speech.speak).toHaveBeenCalledTimes(2);
  });

  it("marks speaking=false when the utterance naturally ends", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "Fim.", locale: "pt-BR" }));
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(true);
    const utt = speech.calls()[0]!;
    act(() => utt.onend?.());
    expect(result.current.speaking).toBe(false);
  });

  it("stop() cancels any in-flight narration", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "Texto.", locale: "pt-BR" }));
    act(() => result.current.toggle());
    act(() => result.current.stop());
    expect(speech.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(false);
  });

  it("does not overlap scenes: unmount cancels in-flight narration", () => {
    const speech = mockSpeech();
    const { result, unmount } = renderHook(() =>
      useReadAloud({ text: "Cena um.", locale: "pt-BR" })
    );
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(true);
    unmount();
    // The cleanup effect cancels in-flight narration on unmount/scene change.
    expect(speech.cancel).toHaveBeenCalled();
  });
});

describe("useReadAloud — edge behaviors", () => {
  it("does nothing on toggle with an empty text", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "", locale: "pt-BR" }));
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(false);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("does nothing on toggle/stop when unsupported", () => {
    withoutSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "x", locale: "pt-BR" }));
    act(() => result.current.toggle());
    act(() => result.current.stop());
    expect(result.current.speaking).toBe(false);
  });

  it("falls back to the primary-subtag voice match for unknown locales", () => {
    const speech = mockSpeech();
    // "fr" is not in LOCALE_TO_VOICE_TAG and no fr voice exists: narration
    // still starts with the correct fallback lang and no assigned voice.
    const { result } = renderHook(() => useReadAloud({ text: "Bonjour", locale: "fr" }));
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(true);
    const utt = speech.calls()[0]!;
    expect(utt.lang).toBe("fr");
    expect(utt.voice).toBeFalsy();
  });

  it("marks speaking=false when the utterance errors out", () => {
    const speech = mockSpeech();
    const { result } = renderHook(() => useReadAloud({ text: "Cena.", locale: "pt-BR" }));
    act(() => result.current.toggle());
    expect(result.current.speaking).toBe(true);
    act(() => speech.calls()[0]!.onerror?.());
    expect(result.current.speaking).toBe(false);
  });
});
