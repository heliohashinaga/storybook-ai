import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "../i18n/locale-provider";
import { TopNav } from "../features/shell/components/top-nav";
import { SiteFooter } from "../features/shell/components/site-footer";
import { StorySessionProvider } from "../features/story-request/client/story-session-context";

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
// Defaults to en (the app's default locale); the in-form language switch
// keeps the title static and anonymous.
export const metadata: Metadata = {
  title: "Storybook AI",
  description: "Create personalized, anonymous, and ephemeral children's stories.",
};

/**
 * Minimal root layout. The anonymous app defaults to `en`; the story
 * language selected in the form drives the whole UI through LocaleProvider
 * (ADR 0003 / T056). This shell is kept intentionally lightweight.
 *
 * `StorySessionProvider` lives here (not per-route) so the in-memory session
 * persists across `/form` ↔ `/reader` navigation — client-side route changes
 * keep the layout mounted, so the anonymous story history survives between
 * screens (Spec 009). It is never serialized to durable storage.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable}`}>
      <body>
        <LocaleProvider defaultLocale="en">
          <StorySessionProvider>
            <TopNav />
            <main className="pb-xl">{children}</main>
            <SiteFooter />
          </StorySessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
