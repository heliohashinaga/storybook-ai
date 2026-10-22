import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE_NAME } from "./features/auth/gate-cookie";

/**
 * Porteiro do playground (ADR 0015).
 *
 * Guarda **só** as páginas do playground (`/form`, `/reader`): sem cookie de
 * porteiro → redirect para `/`. A verificação completa do JWT (assinatura +
 * expiração) acontece no servidor (`requireSession()` / `isAuthenticated()`);
 * aqui no proxy basta a presença do cookie para o redirect barato — um token
 * forjado/expirado cai no guard da página ou vira demo na API.
 *
 * `/demo` e `/` nunca recebem cookie (100% anônimos). As rotas de API
 * (`/api/stories`, `/api/narrate`) **não** redirecionam: derivam o modo da
 * sessão por request (autenticado → playground real; anônimo → demo fake).
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPlaygroundPage =
    pathname === "/form" ||
    pathname.startsWith("/form/") ||
    pathname === "/reader" ||
    pathname.startsWith("/reader/");
  if (!isPlaygroundPage) return NextResponse.next();
  if (request.cookies.has(GATE_COOKIE_NAME)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url);
}

export const config = {
  // Guarda as páginas do playground; pula internos/estáticos e a demo anônima.
  matcher: [
    "/((?!_next|demo|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
