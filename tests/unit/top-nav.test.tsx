import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { TopNav } from "../../src/features/shell/components/top-nav";
import { getMessages } from "../../src/i18n/config";

// Route harness (Spec 009 + 015): `usePathname()` drives `aria-current`, and
// the home button always navigates to the login gate `/` via `router.push`
// (the server redirects to `/form` only when the visitor is authenticated).
const navState = vi.hoisted(() => {
  let path = "/reader";
  const push = vi.fn<(href: string) => void>();
  return {
    setPath: (p: string) => {
      path = p;
    },
    getPath: () => path,
    push,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => navState.getPath(),
  useRouter: () => ({ push: navState.push }),
}));

function renderTopNav() {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <TopNav />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  navState.push.mockClear();
  document.documentElement.classList.remove("light", "dark");
});

describe("TopNav — brand home + lang/theme toggles (Spec 009 / a11y)", () => {
  it("renders the brand mark as a single home destination without aria-current off /form", () => {
    navState.setPath("/reader");
    renderTopNav();

    const home = screen.getByRole("button", { name: "Voltar ao início" });
    expect(home).toHaveAttribute("type", "button");
    expect(home).not.toHaveAttribute("aria-current");
    // Brand name + tagline are visible inside the home button.
    expect(screen.getByText("Storybook AI")).toBeVisible();
    expect(screen.getByText("Histórias ilustradas")).toBeVisible();
  });

  it("marks the home button as the current page on the / login gate", () => {
    navState.setPath("/");
    renderTopNav();

    const home = screen.getByRole("button", { name: "Voltar ao início" });
    expect(home).toHaveAttribute("aria-current", "page");
  });

  it("navigates to the login gate / when the brand mark is clicked", () => {
    navState.setPath("/reader");
    renderTopNav();

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(navState.push).toHaveBeenCalledWith("/");
  });

  it("also renders the language and theme toggles without identifiers", () => {
    renderTopNav();

    // Segmented locale picker group.
    const lang = screen.getByRole("group", { name: "Idioma" });
    expect(lang).toBeVisible();
    // Theme toggle (light system default).
    expect(screen.getByRole("button", { name: "Ativar modo escuro" })).toBeVisible();
  });
});
