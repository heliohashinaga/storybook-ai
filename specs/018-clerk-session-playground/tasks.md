---
description: "Task list for feature implementation: Clerk Session Playground (Clerk Components)"
---

# Tasks: Clerk Session Playground — decisão B (Clerk Components)

**Input**: Design documents from `/specs/018-clerk-session-playground/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md
(decisions R-01..R-05), data-model.md (session/env contract), ADR 0013 (governança),
Clarifications (e-mail identificador; Clerk Components B; senha ≥8 + letra e número).

**Important**: esta feature muda **autenticação**. Antes de todo commit final, rodar os quality
gates (`lint`, `format:check`, `typecheck`) **após o último edit** (regra AGENTS.md). Clerk é
**sempre mockado** em testes — nenhuma chamada live. A UI de auth usa **Clerk Components**
(`<SignIn>`/`<SignUp>`), **não** formulários custom.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (Setup/Foundation | US1..US5 | Polish)
- Include exact file paths in descriptions

---

## Phase 0 — Setup / Foundation

- [ ] **T-01** **Gov** Confirmar `docs/adr/0013-clerk-session-playground.md` (já na branch) e a
      emenda no `AGENTS.md` (playground autenticado via Clerk; anonimato da criança invariante;
      exceção `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`). `docs/adr/README.md` indexado.
- [ ] **T-02** **Dep** `package.json`: remover `next-auth`; adicionar `@clerk/nextjs`,
      `@clerk/clerk-react` e `@clerk/localizations`. `pnpm install`. Remover `src/types/next-auth.d.ts`.
- [ ] **T-03** **Env** `src/lib/env.ts`: remover `AUTH_*` e `allowlistEmails()` do `authEnvSchema`;
      adicionar `CLERK_SECRET_KEY` (server, opcional), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
      (opcional — **exceção documentada** à regra "no NEXT_PUBLIC_*" do AGENTS.md, ver ADR 0013),
      `CLERK_SIGN_IN_URL`, `CLERK_SIGN_UP_URL`, `CLERK_AFTER_SIGN_IN_URL`, `CLERK_AFTER_SIGN_UP_URL`
      (com defaults `/`, `/form`). Manter `.strict()` e o gate de demo-only (sem `CLERK_SECRET_KEY`
      → auth desabilitada via **stub**, sem crash). Atualizar `.env.example` (remover `AUTH_*`,
      adicionar `CLERK_*`) e `.env.local`.
- [ ] **T-04** **Dep** `src/middleware.ts` (novo): `clerkMiddleware({ publicRoutes: ["/",
      "/api/stories", "/api/narrate", "/api/health"] })` com `matcher` que **exclui `/demo`** (sem
      cookie na demo) e **inclui `/api/:path*`** (contexto p/ `auth()` em route handlers). Montar o
      middleware **somente quando `CLERK_SECRET_KEY` presente** (demo-only sem crash).
- [ ] **T-05** **Dep** `src/features/auth/client/clerk-provider.tsx` (novo): `ClerkProvider`
      (cliente). Montar em `src/app/(playground)/layout.tsx` (no lugar do
      `playground-session-provider`) e no layout/caminho da `/` (login). **Root layout
      (`src/app/layout.tsx`) NÃO monta o provider** (mantém `/demo` anônimo).
- [ ] **T-06** **Dep** `src/features/auth/server/session.ts`: reescrever `isAuthenticated()` e
      `requireSession()` sobre `auth()` de `@clerk/nextjs/server`; **gate demo-only com stub** (sem
      `CLERK_SECRET_KEY` → `auth()` retorna null; provider/middleware não montados — evita crash do
      Clerk). **Confirmar que `auth()` resolve em `/api/stories` e `/api/narrate`** (matcher cobre
      `/api/:path*`). Remover `src/features/auth/server/auth.ts` e `auth-rate-limit.ts`. Remover
      `src/app/api/auth/[...nextauth]/route.ts`.

## Phase 1 — US1 · Login por e-mail e senha (Clerk Components)

- [ ] **T-07** **US1** `src/features/auth/components/login-screen-view.tsx`: substituir o botão
      OAuth custom + formulário por **Clerk Components** — renderizar `<SignIn>` do `@clerk/nextjs`
      (Google **+** e-mail+senha), com `appearance` alinhando tokens Blossom e **`localization`
      (`ptBR`/`enUS` de `@clerk/localizations`) conforme o `useLocale()` do next-intl**. Manter `StarField`
      (decoração) e `DemoLink`. **Remover** `oauth-provider-button.tsx` e seu `.stories.tsx`.
      Manter a11y/estados de loading no wrapper.
- [ ] **T-08** **US1** `src/features/auth/locales/{pt-BR,en}.json`: manter só marca/demo (strings
      do auth agora vêm do i18n do Clerk). Remover strings de login custom órfãs.
- [ ] **T-09** **US1** `src/app/page.tsx`: usar `auth()` do Clerk para redirecionar autenticados →
      `/form`; renderizar tela de login com `<SignIn>`. Confirmar `requireSession` em
      `(playground)/form/page.tsx` e `reader/page.tsx` (inalterado).

## Phase 2 — US2 · AutoCadastro gated (Invite-only)

- [ ] **T-10** **US2** Login screen: incluir `<SignUp>` do Clerk para criar conta (e-mail+senha,
      verificação de e-mail embutida). Erro de "acesso restrito" (não-convidado) vindo do Clerk.
      `CLERK_AFTER_SIGN_UP_URL` → `/form`.
- [ ] **T-11** **US2** **Config no painel do Clerk** (fora do código): modo **Invite-only** ativo;
      estratégias **Google + e-mail/senha**; política de senha **≥8 + letra e número**; URLs de
      redirect. Documentar em `contracts/auth-flow.md` como o gating é atingido via invites.

## Phase 3 — US3 · Reset de senha self-service

- [ ] **T-12** **US3** Reset "esqueci a senha" — **embutido** no `<SignIn>`/`<SignUp>` do Clerk
      (link + e-mail). Apenas confirmar config no painel (estratégia e-mail/senha ativa). Verificar
      **anti-enumeração**: solicitar reset com e-mail inexistente retorna resposta **neutra**
      (não revela se há conta).

## Phase 4 — US4 · Google + demo anônima intactos

- [ ] **T-13** **US4** Google via `<SignIn>` do Clerk (botão gerenciado). Remover
      `oauth-provider-button` (feito em T-07). `src/app/page.tsx` deixa de expor credenciais Google
      env (`AUTH_GOOGLE_*` removidos em T-03).
- [ ] **T-14** **US4** Confirmar `/demo` não monta `ClerkProvider` **e** que `/demo` está **fora do
      matcher** do middleware (sem `__clerk_*` cookies na demo). Teste (T-20) afirma demo sem
      cookie.

## Phase 5 — US5 · Privacidade da criança (invariante)

- [ ] **T-15** **US5** Reafirmar/adaptar asserts: payload de `POST /api/stories` rejeita qualquer
      campo fora de `ageBand|locale|theme|sceneCount` (Zod `.strict()`); `Cache-Control: no-store`;
      nenhum identificador de criança em logs/payload. Contrato em
      `specs/015-tela-inicial/contracts/auth-flow.md` e `data-model.md` atualizados.

## Phase 6 — Polish

- [ ] **T-16** **Pol** `next.config.ts` (CSP): adicionar origens do Clerk (`https://*.clerk.accounts`
      e domínio custom se usado) a `script-src`, `connect-src`, `frame-src`, `worker-src` — com
      comentário "EXPLICIT RELAXATION" documentado no diff (regra AGENTS.md). Nada mais relaxado.
- [ ] **T-17** **Pol** Reescrever testes unit/component para **mock** de Clerk (incl. mock de
      `<SignIn>`/`<SignUp>`): `tests/unit/auth-session.test.ts`, `auth-cookie.test.ts`,
      `auth-oauth-guards.test.ts`, `login-screen.test.tsx`, **substituir** `auth-allowlist.test.ts`
      por teste de **invariante do gating invite-only** (só convidado cadastra; não-convidado
      recusado, erro não-enumerável), `auth-rate-limit.test.ts` (limiter próprio de `/api/auth`
      removido; manter limiter de `/api/stories`). Vitest/MSW.
- [ ] **T-18** **Pol** E2E `tests/e2e/login-google.spec.ts` adaptar (fluxo via Clerk fake);
      `login-github.spec.ts` removido (GitHub fora de escopo).
- [ ] **T-19** **Pol** `.stories.tsx` da login screen cobrem os **wrappers do app** (StarField,
      DemoLink, layout, estado do `<SignIn>`) + a11y. Os internos do Clerk **não** são story-ados
      (divergência aceita — decisão B).
- [ ] **T-20** **Pol** Teste de invariante: acessar `/demo` não cria cookie de sessão; utente sem
      sessão em `/form` é redirecionado à login.
- [ ] **T-21** **Pol** Correr gates finais **após o último edit**: `pnpm lint`, `pnpm format:check`
      (rodar `pnpm format` nos arquivos novos/editados incluindo .md do specs/ADR), `pnpm typecheck`,
      `pnpm build`, e suíte de testes. Verificar `pnpm audit` (sem CVE nova no runtime path).
- [ ] **T-22** **Pol** **Bundle**: medir/justificar o JS do Clerk na rota de login (`/`) contra o
      budget de rota inicial (o demo `/demo` segue leve, **sem** Clerk no cliente). Documentar o
      resultado nos budgets de performance.
