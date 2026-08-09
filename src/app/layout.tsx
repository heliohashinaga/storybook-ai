import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { getMessages } from "../i18n/config";

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Minimal root layout. The anonymous app defaults to `pt-BR`; the full
 * next-intl routing configuration and message catalogs are wired in Phase 2
 * (T014). This shell is kept intentionally lightweight.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
