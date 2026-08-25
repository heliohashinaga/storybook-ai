# Implementation Plan: Playground com login por usuário/senha + autoCadastro (Clerk)

**Branch**: `018-clerk-session-playground` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-clerk-session-playground/spec.md` + decisões do
dono (Google + usuário/senha; autoCadastro invite-only; reset por e-mail; dependência externa
aceita) + ADR 0013.

## Summary

Migrar a autenticação do playground de **Auth.js (v5, JWT stateless, allowlist de e-mail em env)
para Clerk** (auth gerenciada), adicionando **login por usuário/senha**, **autoCadastro gated
(Invite-only)** e **reset de senha self-service por e-mail**, mantendo o login **Google**. O
anonimato da **criança** e a demo **anônima** são invariantes preservados. O `ClerkProvider` é
montado **apenas** no route group `(playground)` e na `/` (login); `/demo` permanece sem cookie.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16 (App Router); React 19; Tailwind v4 + tokens
Blossom; next-intl (pt-BR + en).

**Primary Dependencies**:
- **Adicionar**: `@clerk/nextjs` (server + middleware + provider), `@clerk/clerk-react`
  (hooks client: `useSignIn`, `useSignUp`, `useSignOut`, `useUser`).
- **Remover**: `next-auth` (e tipagem `src/types/next-auth.d.ts`).

**Storage**: N/A no app. Contas/sessões vivem no Clerk (dependência externa, ADR 0013). Sem banco
no app; sem persistência de histórias.

**Auth / Sessions**: `clerkMiddleware` (novo `src/middleware.ts`):
- `matcher` cobre páginas protegidas e **`/api/:path*`** — necessário para o `auth()` do Clerk
  resolver em route handlers (`/api/stories`, `/api/narrate` seguem **públicos** via
  `publicRoutes`; o modo é derivado da sessão — defense-in-depth anônimo→demo). **F2**
- `/demo` fica **fora do matcher** → o middleware **não roda** ali → zero `__clerk_*` na demo
  (invariante US4/US5). **F1**
- `publicRoutes` para `/`, `/api/stories`, `/api/narrate`, `/api/health`.
- Quando `CLERK_SECRET_KEY` ausente (demo-only), **não montar o middleware** (sem crash). **F4**

`auth()` de `@clerk/nextjs/server` reimplementa
`isAuthenticated()`/`requireSession()` (mesma API — mínimo churn nos consumidores).

**Privacy invariants (inalterados)**: payload `POST /api/stories`/`/api/narrate` apenas
`ageBand|locale|theme|sceneCount` (Zod `.strict()`); `Cache-Control: no-store`; demo sem cookie;
nenhum identificador de criança em qualquer lugar; identificador do usuário (adulto) nunca exposto
ao cliente além do booleano de autenticação.

**Testing**: Vitest (unit/component), Storybook (stories + a11y), Playwright (e2e). Clerk **sempre
mockado** (MSW/mocks) — nenhuma chamada live em testes.

**Target Platform**: Web (browser) + server (Route Handlers / RSC).

## Migration Map

### Remover
- `src/features/auth/server/auth.ts` (NextAuth) e `src/features/auth/server/auth-rate-limit.ts`.
- `src/app/api/auth/[...nextauth]/route.ts` (e `src/app/api/auth/`).
- `src/types/next-auth.d.ts`.
- `package.json`: `next-auth`.

### Adicionar
- `src/middleware.ts` → `clerkMiddleware({ publicRoutes: [...] })` com `matcher` que **exclui
  `/demo`** (sem cookie na demo) e **inclui `/api/:path*`** (contexto p/ `auth()` em route
  handlers). **F1/F2**
- `src/features/auth/client/clerk-provider.tsx` → `ClerkProvider` (montado em `(playground)/layout`
  e em `/`).
- `src/app/api/auth/` removido; nenhum handler custom de auth.

### Reescrever (mantendo API/semântica)
- `src/features/auth/server/session.ts`: `isAuthenticated()`/`requireSession()` sobre `auth()` do
  Clerk; gate "demo-only sem `CLERK_SECRET_KEY`" preservado **com stub explícito**: quando a chave
  falta, expor um `auth()` stub (retorna null) e **não** montar middleware/provider — evita crash
  do Clerk em deploy demo-only. **F4**
- `src/features/auth/components/login-screen-view.tsx`: trocar `signIn`/`signOut` (next-auth) por
  `useSignIn`/`useSignUp`/`useSignOut` (Clerk); formulário usuário+senha + link "esqueci a senha"
  (fluxo forgot password); manter Google; manter `StarField`, DemoLink, a11y, estados
  loading/erro. Strings em `pt-BR`/`en` (catalogs auth).
- `src/features/auth/components/oauth-provider-button.tsx` (+ stories): adaptar ao Google via Clerk.
- `src/features/auth/client/playground-session-provider.tsx` → vira wrapper de `ClerkProvider`.

### Tocar
- `src/lib/env.ts`: remover `AUTH_*` do `authEnvSchema`; adicionar `CLERK_*` (server) e validar
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — **exceção consciente** à regra "no `NEXT_PUBLIC_*`" do
  AGENTS.md (chave publishable é **não-secreta**, por design exposta ao browser; registrada no ADR
  0013); manter `.strict()` e gate de demo-only. Remover `allowlistEmails`. **F3**
- `src/app/page.tsx`: usar `auth()`/Clerk para redirecionar autenticados → `/form`; renderizar
  tela de login com Google + usuário/senha.
- `src/app/layout.tsx` (root): **não** montar ClerkProvider (mantém `/demo` sem cookie).
- `src/app/(playground)/layout.tsx`: montar `ClerkProvider`.
- `src/app/api/stories/route.ts` e `src/app/api/narrate/route.ts`: apenas re-importam
  `isAuthenticated` (sem mudança de lógica) — confirmar.
- `src/app/(playground)/form/page.tsx` e `reader/page.tsx`: usam `requireSession()` (inalterado).
- `next.config.ts` (CSP): adicionar origens do Clerk a `script-src`, `connect-src`, `frame-src`,
  `worker-src` — relaxamentos **documentados no diff** (regra AGENTS.md).

### Testes
- Reescrever `tests/unit/auth-session`, `auth-cookie`, `auth-oauth-guards`, `auth-allowlist`,
  `auth-rate-limit`, `login-screen` para mock de Clerk.
- E2E `tests/e2e/login-google.spec.ts`/`login-github.spec.ts`: adaptar (Google via Clerk fake;
  remover GitHub se não requisito).
- Manter asserts de invariante: payload fechado, demo sem cookie, sem identificador.

## Phases

1. **Setup/Foundational**: deps, env schema, middleware, layouts/ClerkProvider, session.ts.
2. **US1 — Login usuário/senha**: login screen com credenciais + guard.
3. **US2 — AutoCadastro invite-only**: fluxo sign-up gated + erro de acesso restrito.
4. **US3 — Reset de senha**: fluxo forgot password + e-mail.
5. **US4 — Google + demo intactos**: Google via Clerk; `/demo` sem cookie.
6. **US5 — Privacidade**: asserts de invariante nos testes.
7. **Polish**: CSP, lint, format, typecheck, build, stories/visual.

## Risks & Mitigations

- **CSP/conexões externas do Clerk**: relaxamentos controlados e documentados; testar fluxo na
  produção.
- **Cookies em `/demo`**: `/demo` fica **fora do matcher** do middleware (não apenas
  `publicRoutes`) e sem `ClerkProvider` → sem `__clerk_*` na demo. **F1**
- **`auth()` em rotas públicas**: `/api/:path*` no matcher garante o contexto; as rotas
  permanecem públicas com modo derivado (anônimo→demo). **F2**
- **Deploy demo-only sem chaves Clerk**: middleware/provider/auth condicionais com stub — sem
  crash em runtime. **F4**
- **Testes live**: Clerk sempre mockado; nenhuma chamada de rede em CI.
- **Dependência externa (uptime)**: aceita pelo dono (ADR 0013); google via Clerk.
- **PII de adultos em terceiro**: contrato (data-model) restringe exposição ao app a booleano;
  conta do adulto fora do repo.
