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

// TopNav calls `useClerk()` for sign-out; the playground always mounts a
// ClerkProvider at runtime, but this isolated unit test doesn't, so we stub
// the hook AND make `ClerkProvider` a pass-through (the kebab wraps its sign
// out action in a scoped ClerkProviderGate). Stubbing avoids booting real
// Clerk JS in JSDOM; we only assert TopNav's behavior.
vi.mock("@clerk/nextjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clerk/nextjs")>()),
  useClerk: () => ({ signOut: vi.fn() }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
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
    // Brand name is visible inside the home button.
    expect(screen.getByText("Storybook AI")).toBeVisible();
  });

  it("hides the app header on the / login gate (standalone screen)", () => {
    navState.setPath("/");
    renderTopNav();

    // Spec 015: the login page has no app header — the brand is presented by
    // the centered login hero itself.
    expect(screen.queryByRole("button", { name: "Voltar ao início" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Idioma" })).not.toBeInTheDocument();
  });

  it("navigates to the login gate / when the brand mark is clicked", () => {
    navState.setPath("/reader");
    renderTopNav();

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(navState.push).toHaveBeenCalledWith("/");
  });

  it("returns to the demo form /demo when the brand mark is clicked on a demo route", () => {
    navState.setPath("/demo/reader");
    renderTopNav();

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao início" }));
    expect(navState.push).toHaveBeenCalledWith("/demo");
  });

  it("marks the home button as current on the /demo form", () => {
    navState.setPath("/demo");
    renderTopNav();

    const home = screen.getByRole("button", { name: "Voltar ao início" });
    expect(home).toHaveAttribute("aria-current", "page");
  });
});

describe("TopNav — kebab menu (all breakpoints)", () => {
  it("collapses the actions behind a kebab toggle that opens a menu panel", () => {
    navState.setPath("/reader");
    renderTopNav();

    // The kebab trigger is a menu button with aria-haspopup.
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Panel content is not rendered until opened.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Both locales are listed as menu items.
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Português/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /English/ })).toBeInTheDocument();
    // A theme row is present (its text reflects the effective scheme).
    expect(
      screen.getByRole("menuitem", { name: /modo escuro|modo claro|dark|light/i })
    ).toBeInTheDocument();
  });

  it("shows a sign-out action on the playground route when Clerk is configured", async () => {
    navState.setPath("/reader");
    // Sign out only mounts when Clerk is configured (anonymous demo has none).
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    renderTopNav();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    // `SignOutButton` is lazily imported via `next/dynamic` (kept out of the
    // initial bundle), so await the async chunk before asserting.
    expect(await screen.findByRole("menuitem", { name: /sair/i })).toBeInTheDocument();
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  });

  it("closes the kebab menu when pressing Escape", () => {
    navState.setPath("/reader");
    renderTopNav();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
