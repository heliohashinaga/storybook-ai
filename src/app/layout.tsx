import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "../i18n/locale-provider";
import { TopNav } from "../features/shell/components/top-nav";

// Self-hosted identity fonts ported from story-blossom-room (design-system §3).
// Baloo 2 (round display) for headings; Nunito (legible body) for copy. Weights
// are limited to what the prototype uses to keep the font payload modest
// (initial JS ≤ 250 KiB gzip budget) — see specs/007 plan performance goals.
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-display",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-sans",
});

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
    <html lang="pt-BR" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        <LocaleProvider defaultLocale="pt-BR">
          <TopNav />
          <main>{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
