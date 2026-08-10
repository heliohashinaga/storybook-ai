import type { ReactNode } from "react";
import "./globals.css";
import { LocaleProvider } from "../i18n/locale-provider";

interface RootLayoutProps {
  children: ReactNode;
}

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
          <main>{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
