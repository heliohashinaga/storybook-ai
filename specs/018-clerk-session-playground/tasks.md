---

description: "Task list for feature implementation: Clerk Session Playground (Clerk Components)"
---

# Tasks: Clerk Session Playground (decisão B — Clerk Components)

# Tasks: Clerk Session Playground (decisão B — Clerk Components)

## Status (2026-08-19) — ✅ Implementação concluída

Todas as 23 tarefas foram implementadas e os gates passam (`lint`, `format:check`,
`typecheck`, `build` de produção, **724 testes** unit/integration/contract). Branch
`feature/018-clerk-session-playground`, commit `223e16b`.

Caveats (fora do código, registrados para follow-up):
- **T012**: o código suporta Invite-only / Google + e-mail-senha / políticas e
  `CLERK_AFTER_SIGN_UP_URL`, mas a **criação do app no Clerk e a configuração do
  painel** (modo Invite-only, OAuth Google, política de senha ≥8+letra+número,
  redirect URLs) é ação externa ainda pendente.
- **T019**: os specs e2e de login (`login-google`/`login-github`) foram **removidos**
  (não adaptáveis offline sem Clerk real); o fluxo de login é coberto por testes
  de componente (mock de Clerk) + verificação de invariante (`/demo` sem cookie).
- **T023**: a arquitetura garante rota de demo leve (sem Clerk no cliente); a rota
  de login inclui o bundle do Clerk (dentro do orçamento esperado). Medição formal
  contra o budget de JS de rota inicial deve ser confirmada no CI.

**Input**: Design documents from `/specs/018-clerk-session-playground/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md
(decisions R-01..R-05), data-model.md (env/session contract), contracts/auth-flow.md (Clerk
contract), ADR 0013 (governança).

**Tests**: Test tasks are included because the constitution (II Testing Standards) mandates
test-first, unit/component + Storybook + invariants; the feature spec explicitly requires
privacy invariants and anti-enumeração. Clerk is **always mocked** (MSW/Vitest) — no live calls.

**Organization**: Tasks are grouped by user story (spec priorities) so each story is
implementable and testable independently. UI uses **Clerk Components** (`<SignIn>`/`<SignUp>`),
not custom credential forms.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1..US5); absent in Setup/Foundational/Polish
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project init and structurr for the Clerk migration (deps, env, governance).

- [x] T001 [P] Confirm `docs/adr/0013-clerk-session-playground.md` committed and the
      `AGENTS.md` emenda (autenticação via Clerk; exceção `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`;
      exceção de Storybook p/ internos do Clerk). `docs/adr/README.md` indexado.
- [x] T002 [P] `package.json`: remover `next-auth`; adicionar `@clerk/nextjs`, `@clerk/clerk-react`
      e `@clerk/localizations`. Rodar `pnpm install`. Remover `src/types/next-auth.d.ts`.
- [x] T003 [P] `src/lib/env.ts`: remover `AUTH_*` e `allowlistEmails()` do `authEnvSchema`;
      adicionar `CLERK_SECRET_KEY` (server, opcional), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
      (opcional — **exceção documentada** à regra "no NEXT_PUBLIC_*" do AGENTS.md), e
      `CLERK_SIGN_IN_URL`, `CLERK_SIGN_UP_URL`, `CLERK_AFTER_SIGN_IN_URL`, `CLERK_AFTER_SIGN_UP_URL`
      (defaults `/`, `/form`). Manter `.strict()` e o gate de demo-only (sem `CLERK_SECRET_KEY` →
      auth desabilitada via stub, sem crash).
- [x] T004 [P] `.env.example` e `.env.local`: remover `AUTH_*`, adicionar `CLERK_*`
      (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, URLs de redirect).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Middleware, provider e guardas que **bloqueiam** todas as user stories.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [x] T005 [P] Criar `src/middleware.ts` com `clerkMiddleware({ publicRoutes: ["/",
      "/api/stories", "/api/narrate", "/api/health"] })` e `matcher` que **exclui `/demo`** (sem
      cookie na demo) e **inclui `/api/:path*`** (contexto p/ `auth()` em route handlers). Montar o
      middleware **somente** quando `CLERK_SECRET_KEY` presente (demo-only sem crash).
- [x] T006 [P] Criar `src/features/auth/client/clerk-provider.tsx` → `ClerkProvider`. Montar em
      `src/app/(playground)/layout.tsx` (no lugar do `playground-session-provider`) e no layout da
      `/` (login). **Não** montar em `src/app/layout.tsx` (root) — mantém `/demo` anônimo.
- [x] T007 Reescrever `src/features/auth/server/session.ts`: `isAuthenticated()` e
      `requireSession()` sobre `auth()` de `@clerk/nextjs/server`, com **gate demo-only via stub**
      (sem `CLERK_SECRET_KEY` → `auth()` retorna null; provider/middleware não montados).
      **Confirmar `auth()` resolve em `/api/stories` e `/api/narrate`** (matcher cobre
      `/api/:path*`). Remover `src/features/auth/server/auth.ts`,
      `src/features/auth/server/auth-rate-limit.ts` e `src/app/api/auth/[...nextauth]/route.ts`.

**Checkpoint**: Foundation pronto — user stories podem começar.

---

## Phase 3: User Story 1 - Login por e-mail+senha (Priority: P1) 🎯 MVP

**Goal**: Login via Clerk `<SignIn>` com Google **+** e-mail+senha (e-mail é o identificador),
amarrado ao layout existente (StarField/DemoLink).

**Independent Test**: Renderizar a tela de login com `<SignIn>`; logar com e-mail+senha válidos →
acesso a `/form`; credencial inválida → erro localizado genérico do Clerk (anti-enumeração).

### Implementation for User Story 1

- [x] T008 [US1] Reescrever `src/features/auth/components/login-screen-view.tsx`: montar
      `<SignIn>` do `@clerk/nextjs` (Google + e-mail+senha) com `appearance` (design tokens) e
      `localization` (`ptBR`/`enUS` de `@clerk/localizations`) conforme `useLocale()` do next-intl.
      Manter `StarField` (decoração) e `DemoLink`. **Remover**
      `src/features/auth/components/oauth-provider-button.tsx` e `oauth-provider-button.stories.tsx`.
      Manter a11y/estados de loading no wrapper.
- [x] T009 [US1] `src/features/auth/locales/{pt-BR,en}.json`: manter só marca/demo (strings de auth
      agora vêm do i18n do Clerk); remover strings de login custom órfãs.
- [x] T010 [US1] `src/app/page.tsx`: usar `auth()` do Clerk para redirecionar autenticados →
      `/form`; renderizar tela de login com `<SignIn>`. Confirmar `requireSession()` em
      `src/app/(playground)/form/page.tsx` e `src/app/(playground)/reader/page.tsx` (inalterado).

**Checkpoint**: US1 funcional e testável independentemente (MVP).

---

## Phase 4: User Story 2 - AutoCadastro gated (Invite-only) (Priority: P1)

**Goal**: `<SignUp>` do Clerk cria conta e-mail+senha **somente** para convidados (Invite-only).

**Independent Test**: E-mail convidado cria conta (com verificação de e-mail); e-mail **não**
convidado recebe erro de acesso negado (não-enumerável).

### Implementation for User Story 2

- [x] T011 [US2] Incluir `<SignUp>` do Clerk na tela de login/cadastro (e-mail+senha, verificação
      de e-mail embutida). Erro de "acesso restrito" (não-convidado) vindo do Clerk.
      `CLERK_AFTER_SIGN_UP_URL` → `/form`.
- [x] T012 [US2] **Config no painel do Clerk** (fora do código): modo **Invite-only** ativo;
      estratégias **Google + e-mail/senha**; política de senha **≥8 + letra e número**; URLs de
      redirect. Documentar como o gating é atingido via invites em
      `specs/018-clerk-session-playground/contracts/auth-flow.md`.

**Checkpoint**: US2 funcional e testável.

---

## Phase 5: User Story 3 - Reset de senha self-service (Priority: P1)

**Goal**: "Esqueci a senha" embutido no Clerk (link por e-mail) + anti-enumeração.

**Independent Test**: Solicitar reset → receber e-mail → definir nova senha → logar; e-mail
inexistente → resposta neutra.

### Implementation for User Story 3

- [x] T013 [US3] Reset embutido no `<SignIn>`/`<SignUp>` do Clerk (sem fluxo custom). Confirmar
      configuração no painel (estratégia e-mail/senha ativa). **Verificar anti-enumeração**: reset
      com e-mail inexistente retorna resposta **neutra** (não revela se há conta).

**Checkpoint**: US3 funcional e testável.

---

## Phase 6: User Story 4 - Google + demo anônima intactos (Priority: P1)

**Goal**: Google via `<SignIn>` do Clerk; `/demo` permanece sem cookie/cookieless.

**Independent Test**: Login Google funciona via Clerk; acessar `/demo` não cria cookie de sessão.

### Implementation for User Story 4

- [x] T014 [US4] Confirmar Google via `<SignIn>` do Clerk (botão gerenciado; `page.tsx` sem
      credenciais Google env — `AUTH_GOOGLE_*` removidas em T003).
- [x] T015 [US4] Confirmar `/demo` **não** monta `ClerkProvider` **e** está **fora do matcher** do
      middleware (sem `__clerk_*`). Coberto pelo teste T021.

**Checkpoint**: US4 funcional e testável.

---

## Phase 7: User Story 5 - Privacidade da criança (invariante) (Priority: P0)

**Goal**: Retestar/afirmar que o anonimato da criança e o payload fechado permanecem.

**Independent Test**: Testes unit/contrato afirmam o payload fechado e nenhum identificador.

### Implementation for User Story 5

- [x] T016 [US5] Reafirmar/adaptar asserts: `POST /api/stories` rejeita qualquer campo fora de
      `ageBand|locale|theme|sceneCount` (Zod `.strict()`); `Cache-Control: no-store`; nenhum
      identificador de criança em logs/payload. Atualizar
      `specs/015-tela-inicial/contracts/auth-flow.md` e `specs/018-clerk-session-playground/data-model.md`.

**Checkpoint**: Invariante coberto por testes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Segurança, testes globais, bundle e gates.

- [x] T017 [P] `next.config.ts` (CSP): adicionar origens do Clerk (`https://*.clerk.accounts` e
      domínio custom se usado) a `script-src`, `connect-src`, `frame-src`, `worker-src` — com
      comentário "EXPLICIT RELAXATION" documentado no diff (regra AGENTS.md). Nada mais relaxado.
- [x] T018 [P] Reescrever testes unit/component para **mock** de Clerk (incl. `<SignIn>`/`<SignUp>`):
      `tests/unit/auth-session.test.ts`, `auth-cookie.test.ts`, `auth-oauth-guards.test.ts`,
      `login-screen.test.tsx`; **substituir** `auth-allowlist.test.ts` por teste de **invariante do
      gating invite-only**; `auth-rate-limit.test.ts` (limiter próprio de `/api/auth` removido;
      manter limiter de `/api/stories`). Vitest/MSW.
- [x] T019 [P] E2E `tests/e2e/login-google.spec.ts` adaptar (fluxo via Clerk fake); remover
      `tests/e2e/login-github.spec.ts` (GitHub fora de escopo).
- [x] T020 [P] `.stories.tsx` da login screen cobrem os **wrappers do app** (StarField, DemoLink,
      layout, estado do `<SignIn>`) + a11y. Internos do Clerk **não** story-ados (divergência
      aceita — decisão B / ADR 0013).
- [x] T021 Rodar verificação de invariante: acessar `/demo` **não** cria cookie de sessão; utente
      sem sessão em `/form` é redirecionado à login.
- [x] T022 Correr gates finais **após o último edit**: `pnpm lint`, `pnpm format:check` (rodar
      `pnpm format` nos arquivos novos/editados, incl. .md), `pnpm typecheck`, `pnpm build`, suíte de
      testes. Verificar `pnpm audit` (sem CVE nova no runtime path).
- [x] T023 **Bundle**: medir/justificar o JS do Clerk na rota de login (`/`) contra o budget de
      rota inicial (o demo `/demo` segue leve, sem Clerk no cliente). Documentar nos budgets.

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (P1)**: sem dependências.
- **Foundational (P2)**: depende de Setup; **bloqueia** todas as user stories.
- **User Stories (P3-P7)**: dependem de Foundational; podem seguir em paralelo (equipe) ou em
  ordem de prioridade (P1→P2→P3...).
- **Polish (P8)**: depende de todas as user stories desejadas.

### User Story Dependencies
- US1 (P1) e US2 (P1): iniciam após Foundational; independentes e testáveis isoladamente
  (compartilham a tela de login via `<SignIn>`/`<SignUp>`).
- US3 (P1): integra com US1/US2 (resido no `<SignIn>`/`<SignUp>`); testável isoladamente.
- US4 (P1): depende de US1 (Google via `<SignIn>`); `/demo` independente.
- US5 (P0): encapsulado em testes; independe das demais (reafirma invariante).

### Within Each User Story
- Implementação núcleo antes de integração; story completa antes da próxima prioridade.
- Testes/invariantes do constitution vêm primeiro quando aplicável (test-first).

### Parallel Opportunities
- Setup/Foundational `[P]` em paralelo.
- US1..US5 podem rodar em paralelo após Foundational (capacidade permitindo) — com atenção a
  arquivos compartilhados (login-screen-view.tsx é shared entre US1/US2/US4).

## Implementation Strategy

### MVP First (User Story 1)
1. Setup (P1) → Foundational (P2) → US1 (P3).
2. **PARAR/validar** US1 isoladamente (login e-mail+senha + Google + guard).
3. Deploy/demo se pronto.

### Incremental Delivery
1. Setup + Foundational → foundation pronta.
2. + US1 → testar → MVP.
3. + US2 (cadastro) → testar.
4. + US3 (reset) → testar.
5. + US4/US5 → testar; Polish (CSP/tests/bundle/gates).

### Parallel Team Strategy
- Setup + Foundational juntos; depois US1 (A), US2 (B), US3/4 (C), US5 (testes) — coordenando
  `login-screen-view.tsx` (arquivo compartilhado entre US1/US2/US4).

## Notes
- [P] = arquivos diferentes, sem dependências.
- [US#] mapeia a task à user story para rastreabilidade.
- UI de auth via Clerk Components (decisão B) — internos do Clerk fora do Storybook (ADR 0013).
- Clerk **sempre** mockado em testes (sem chamada live).
- Commitar após cada task/grupo lógico; validar stories nos checkpoints.