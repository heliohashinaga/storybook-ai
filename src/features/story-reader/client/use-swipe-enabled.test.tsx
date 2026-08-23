import { describe, expect, it, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeEnabled } from "./use-swipe-enabled";

/**
 * SW1 — ativação do gesto.
 *
 * O arraste de cena fica ativo somente quando o dispositivo é touch primário
 * (`pointer: coarse`) E o usuário não pediu redução de movimento
 * (`prefers-reduced-motion: no-preference`). O hook é hidration-safe (SSR →
 * `false`).
 */

function setupMatchMedia(overrides: Record<string, boolean> = {}) {
  const matchMediaMock = vi.fn((query: string) => ({
    matches: overrides[query] ?? false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("matchMedia", matchMediaMock);
  return matchMediaMock;
}

const COARSE = "(pointer: coarse)";
const MOTION = "(prefers-reduced-motion: no-preference)";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSwipeEnabled", () => {
  it("responde false quando as media queries não casam (padrão jsdom)", () => {
    setupMatchMedia({}); // nada casa → false
    const { result } = renderHook(() => useSwipeEnabled());
    expect(result.current).toBe(false);
  });

  it("habilita quando toque primário e sem redução de movimento", () => {
    setupMatchMedia({ [COARSE]: true, [MOTION]: true });
    const { result } = renderHook(() => useSwipeEnabled());
    expect(result.current).toBe(true);
  });

  it("desabilita em ponteiro fino (mouse/desktop)", () => {
    setupMatchMedia({ [COARSE]: false, [MOTION]: true });
    const { result } = renderHook(() => useSwipeEnabled());
    expect(result.current).toBe(false);
  });

  it("desabilita quando o usuário prefere reduzir movimento", () => {
    setupMatchMedia({ [COARSE]: true, [MOTION]: false });
    const { result } = renderHook(() => useSwipeEnabled());
    expect(result.current).toBe(false);
  });

  it("usa a media query de ponteiro e de movimento esperadas", () => {
    const mm = setupMatchMedia({ [COARSE]: true, [MOTION]: true });
    renderHook(() => useSwipeEnabled());
    const queries = mm.mock.calls.map((c) => c[0]);
    expect(queries).toContain(COARSE);
    expect(queries).toContain(MOTION);
  });
});
