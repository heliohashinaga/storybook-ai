import { describe, expect, it, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColorScheme } from "../../src/features/theme/client/use-color-scheme";

function setSystemPrefersDark(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? dark : !dark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
  vi.restoreAllMocks();
});

describe("useColorScheme (US5 — modo escuro, alternador manual transitório)", () => {
  it("defaults to 'system' and applies no class before any manual toggle", () => {
    setSystemPrefersDark(false);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.mode).toBe("system");
    expect(result.current.applied).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("toggles to dark (adds .dark) and back to light (adds .light) in-session", () => {
    setSystemPrefersDark(false);
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("dark");
    expect(result.current.applied).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.mode).toBe("light");
    expect(result.current.applied).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reset() returns to following the system (removes any manual class)", () => {
    setSystemPrefersDark(true);
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.toggle()); // now light override
    act(() => result.current.toggle()); // back to dark override
    act(() => result.current.reset());
    expect(result.current.mode).toBe("system");
    expect(result.current.applied).toBe("dark"); // system prefers dark
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("reflects the system preference for 'applied' when in system mode", () => {
    setSystemPrefersDark(true);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.applied).toBe("dark");
  });
});
