import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "../i18n/locale-provider";
import { ThemeToggle } from "../features/theme/components/theme-toggle";

interface RootLayoutProps {
  children: ReactNode;
}

// Accessible non-empty document title (WCAG 2.4.2, `document-title` rule).
// Defaults to pt-BR (the app's default locale); the in-form language switch
// keeps the title static and anonymous.
export const metadata: Metadata = {
  title: "Crie histórias anônimas para seu filho",
  description: "Gere histórias infantis personalizadas de forma anônima e efêmera.",
};

/**
 * Minimal root layout. The anonymous app defaults to `pt-BR`; the story
 * language selected in the form drives the whole UI through LocaleProvider
 * (ADR 0003 / T056). This shell is kept intentionally lightweight.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <LocaleProvider defaultLocale="pt-BR">
          <header className="flex w-full justify-end px-md py-sm">
            <ThemeToggle />
          </header>
          <main>{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
