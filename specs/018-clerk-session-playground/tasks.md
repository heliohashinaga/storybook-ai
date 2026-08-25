---
description: "Task list for feature implementation: Clerk Session Playground"
---

# Tasks: Clerk Session Playground

**Input**: Design documents from `/specs/018-clerk-session-playground/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md
(decisions R-01..R-05), data-model.md (session/env contract), ADR 0013 (governança).

**Important**: esta feature muda **autenticação**. Antes de todo commit final, rodar os quality
gates (`lint`, `format:check`, `typecheck`) **após o último edit** (regra AGENTS.md). Clerk é
**sempre mockado** em testes — nenhuma chamada live.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (Setup/Foundation | US1..US5 | Polish)
- Include exact file paths in descriptions

---

## Phase 0 — Setup / Foundation

- [ ] **T-01** **Gov** Adicionar `docs/adr/0013-clerk-session-playground.md` (já rascunhado nesta
      branch) e registrar a emenda no `AGENTS.md` (seção "Non-Negotiable Privacy Rules": playground
      autenticado via Clerk; anonimato da criança invariante). Atualizar `docs/adr/README.md` (lista).
- [ ] **T-02** **Dep** `package.json`: remover `next-auth`; adicionar `@clerk/nextjs` e
      `@clerk/clerk-react`. `pnpm install`. Remover `src/types/next-auth.d.ts` e o import do módulo
      auge (se houver).
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
      middleware **somente quando `CLERK_SECRET_KEY` presente** (demo-only sem crash). Registrar no
      `package.json` se preciso (config do middleware do Next não exige script).
- [ ] **T-05** **Dep** `src/features/auth/client/clerk-provider.tsx` (novo): `ClerkProvider`
      (cliente). Montar em `src/app/(playground)/layout.tsx` (no lugar do
      `playground-session-provider`) e em `src/app/page.tsx`/layout da `/`. **Root layout
      (`src/app/layout.tsx`) NÃO monta o provider** (mantém `/demo` anônimo).
- [ ] **T-06** **Dep** `src/features/auth/server/session.ts`: reescrever `isAuthenticated()` e
      `requireSession()` sobre `auth()` de `@clerk/nextjs/server`; **gate demo-only com stub** (sem
      `CLERK_SECRET_KEY` → `auth()` retorna null; provider/middleware não montados — evita crash do
      Clerk). **Confirmar que `auth()` resolve em `/api/stories` e `/api/narrate`** (matcher cobre
      `/api/:path*`). Remover `src/features/auth/server/auth.ts` e `auth-rate-limit.ts`. Remover
      `src/app/api/auth/[...nextauth]/route.ts`.

## Phase 1 — US1 · Login por usuário e senha

- [ ] **T-07** **US1** `src/features/auth/components/login-screen-view.tsx`: trocar `signIn`/
      `signOut` (next-auth/react) por `useSignIn`/`useSignOut` (Clerk). Adicionar formulário
      e-mail/usuário + senha. Erro genérico localizado em credencial inválida (anti-enumeração).
      Manter `StarField`, `DemoLink`, a11y, `aria-busy`, languages.
- [ ] **T-08** **US1** `src/features/auth/locales/{pt-BR,en}.json`: adicionar strings de
      login-senha (email, senha, "entrar", "credenciais inválidas", "acesso restrito",
      "esqueci a senha", "criar conta").
- [ ] **T-09** **US1** `src/app/page.tsx`: usar `auth()` do Clerk para redirecionar autenticados →
      `/form`; renderizar tela de login com Google + usuário/senha. Confirmar `requireSession` em
      `(playground)/form/page.tsx` e `reader/page.tsx` (inalterado).

## Phase 2 — US2 · AutoCadastro gated (Invite-only)

- [ ] **T-10** **US2** Login screen: fluxo de **criação de conta** via `useSignUp` (Clerk) com
      e-mail + senha. Feedback localizado de "acesso restrito" quando o e-mail não é convidado
      (não enumerar). Apontar `CLERK_AFTER_SIGN_UP_URL` para `/form`.
- [ ] **T-11** **US2** Confirmar na config Clerk (fora do código): modo **Invite-only** ativo no
      app Clerk; invites enviados pelo dono. Documentar em `contracts/auth-flow.md` (espec 015
      atualizado) como o gating é atingido via invites.

## Phase 3 — US3 · Reset de senha self-service

- [ ] **T-12** **US3** Login screen: link "esqueci a senha" → fluxo forgot password via
      `useSignIn().forgotPassword()` (ou tela gerenciada). Resposta neutra para e-mail inexistente
      (anti-enumeração). Strings localizadas estados loading/erro/sucesso.

## Phase 4 — US4 · Google + demo anônima intactos

- [ ] **T-13** **US4** `src/features/auth/components/oauth-provider-button.tsx` (+ stories):
      adaptar para login **Google via Clerk** (`useSignIn`/`authenticateWithRedirect`). Remover
      GitHub (não é requisito). `src/app/page.tsx` deixa de expor credenciais Google env.
- [ ] **T-14** **US4** Confirmar `/demo` não monta `ClerkProvider` **e** que `/demo` está
      **fora do matcher** do middleware (sem `__clerk_*` cookies na demo). Teste (T-20) afirma demo
      sem cookie.

## Phase 5 — US5 · Privacidade da criança (invariante)

- [ ] **T-15** **US5** Reafirmar/adaptar asserts: payload de `POST /api/stories` rejeita qualquer
      campo fora de `ageBand|locale|theme|sceneCount` (Zod `.strict()`); `Cache-Control: no-store`;
      nenhum identificador de criança em logs/payload. Contrato em
      `specs/015-tela-inicial/contracts/auth-flow.md` e `data-model.md` atualizados.

## Phase 6 — Polish

- [ ] **T-16** **Pol** `next.config.ts` (CSP): adicionar origens do Clerk (`https://*.clerk.accounts`
      e domínio custom se usado) a `script-src`, `connect-src`, `frame-src`, `worker-src` — com
      comentário "EXPLICIT RELAXATION" documentado no diff (regra AGENTS.md). Nada mais relaxado.
- [ ] **T-17** **Pol** Reescrever testes unit/component para **mock** de Clerk: `tests/unit/
      auth-session.test.ts`, `auth-cookie.test.ts`, `auth-oauth-guards.test.ts`, `login-screen.test.tsx`,
      e **substituir** `auth-allowlist.test.ts` por um teste de **invariante do gating invite-only**
      (só usuário convidado cadastra; não-convidado recusado com erro não-enumerável),
      `auth-rate-limit.test.ts` (limiter próprio de `/api/auth` removido; manter limiter de
      `/api/stories`). Vitest/MSW.
- [ ] **T-18** **Pol** E2E `tests/e2e/login-google.spec.ts` adaptar (Google via Clerk fake);
      `login-github.spec.ts` remover/substituir se GitHub fora de escopo.
- [ ] **T-19** **Pol** `.stories.tsx` da login screen e do oauth-provider-button cobrem
      default/loading/error/edge + a11y (Storybook espelha o app).
- [ ] **T-20** **Pol** Teste de invariante: acessar `/demo` não cria cookie de sessão; utente sem
      sessão em `/form` é redirecionado à login.
- [ ] **T-21** **Pol** Correr gates finais **após o último edit**: `pnpm lint`, `pnpm format:check`
      (rodar `pnpm format` nos arquivos novos/editados incluindo .md do specs/ADR), `pnpm typecheck`,
      `pnpm build`, e suíte de testes. Verificar `pnpm audit` (sem CVE nova no runtime path).
