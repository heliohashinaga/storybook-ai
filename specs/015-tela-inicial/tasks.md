# Tasks: Tela Inicial — Login (Google/GitHub) + Demo

**Input**: Design docs de `specs/015-tela-inicial/` (spec, plan, research,
data-model, contracts/auth-flow, quickstart) + clarificações 2026-08-18.

**Test-first obrigatório** (constitution.md — Princípio II; AGENTS.md — Testing
Rules): testes ANTES da implementação; confirmam falha pelo motivo certo.
Nenhum teste toca Google/GitHub/LLM reais (OAuth simulado via JWT assinado com
`AUTH_SECRET` de teste; providers fake). Emenda de privacidade **ratificada**
(ADR 0012 + AGENTS.md) — pré-requisito satisfeito.

**Format**: `- [ ] [ID] [P?] [Story?] Description (file path)`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dep `next-auth@beta` + whitelist de env `AUTH_*`

- [X] T001 Adicionar dependência `next-auth@beta` (Auth.js v5) ao
  `package.json` e rodar `pnpm install`; conferir `pnpm audit` (nenhum CVE high
  novo no runtime path)
- [X] T002 [P] Estender a whitelist Zod em `src/lib/env.ts` com `AUTH_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`,
  `AUTH_ALLOWLIST_EMAILS` (opcionais; `.strict()`; nunca expostas ao cliente)
- [X] T003 [P] Atualizar `.env.example` com as chaves `AUTH_*` + comentário
  de geração (`openssl rand -base64 32`) e uso local
  (`AUTH_TRUST_HOST=true`, `AUTH_URL=http://localhost:3000`)
- [X] T004 [P] Unit test do schema de env (`AUTH_*` aceitos/ausentes → botão/
  rota desabilitada) em `tests/unit/env.test.ts` (estender o existente)

**Checkpoint**: `pnpm lint && pnpm format:check && pnpm typecheck` verdes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Nenhuma user story começa antes desta fase**

### Tests (test-first — escrever ver falhar antes da implementação)

- [X] T005 [P] Contract test: `POST /api/stories` sem sessão → demo (fake,
  determinístico); com sessão (JWT de teste assinado) → runtime real com fake
  provider, em `tests/contract/auth-mode.test.ts`
- [X] T006 [P] Security test: JWT adulterado/assinado com chave errada/`exp`
  vencido → sessão inválida (401 ou redirect), em `tests/unit/auth-session.test.ts`
- [X] T007 [P] Security test: cookie de sessão é `httpOnly`, `SameSite=Lax`,
  `Secure` (prod), TTL ≤24h; rota `/demo` NÃO recebe cookie, em
  `tests/unit/auth-cookie.test.ts`
- [X] T008 [P] Security test: callback OAuth com `state` ausente/inválido é
  rejeitado; `redirectTo` externo é bloqueado (só same-origin), em
  `tests/unit/auth-oauth-guards.test.ts`
- [X] T009 [P] Security test: `/api/auth/*` rate-limited (limite → 429) e
  responde `Cache-Control: no-store`, em `tests/unit/auth-rate-limit.test.ts`
- [X] T010 [P] Security test: allowlist `AUTH_ALLOWLIST_EMAILS` — e-mail fora
  da lista rejeitado no callback `signIn` (sem sessão); dentro cria sessão;
  e-mail não vaza para logs/resposta, em `tests/unit/auth-allowlist.test.ts`
- [X] T011 [P] Privacy test: nenhum e-mail/nome/sub aparece em logs, payloads,
  fakes ou resposta ao cliente (inclui logs anônimos do FR-014), em
  `tests/unit/auth-privacy-invariants.test.ts`

### Implementation

- [X] T012 [P] Criar `src/features/auth/server/auth.ts` (server-only):
  `NextAuth({ providers: [Google, GitHub], session: { strategy: "jwt",
  maxAge: 86400 }, callbacks: { signIn: allowlist (memória, rejeita fora),
  jwt: claims mínimas (sub, provider), session: → { authenticated, provider }
  } })` — sem e-mail/nome no token; `AUTH_*` via `getEnv()`
- [X] T013 [P] Criar `src/features/auth/server/session.ts` (server-only):
  `auth()` (server session) e `requireSession()` → `redirect("/")`
- [X] T014 [P] Criar `src/features/auth/server/auth-rate-limit.ts` (server-only):
  wrapper do `InMemoryRateLimiter` p/ `/api/auth/*` (`resolveClientIp()`;
  `Cache-Control: no-store`)
- [X] T015 [P] Criar `src/app/api/auth/[...nextauth]/route.ts` (server-only):
  exporta `GET`/`POST` do handler Auth.js; aplica rate limit
- [X] T016 [P] Implementar logging anônimo (login/logout, sucesso/falha,
  provedor, timestamp — sem e-mail/nome/sub) no handler `/api/auth/*` e
  callbacks (FR-014); campos scrubbed (AGENTS.md)
- [X] T017 Estender `src/features/story-generation/server/generation-runtime.ts`:
  modo — `STORIES_TEST_MODE === "fake"` → demo (override); sessão válida →
  real; senão → demo (anônimo nunca roda LLM real)
- [X] T018 Estender `src/features/story-read-aloud/server/tts-runtime.ts`:
  mesma derivação de modo (espelha T017)
- [X] T019 [P] Atualizar `src/features/shell/components/top-nav.tsx`: home →
  `/` (era `/form`); `aria-current` reflete rota ativa

**Checkpoint**: Fase 2 verde (T005–T011 passam); stories podem começar.

---

## Phase 3: User Story 1 - Entrar no playground com Google (Priority: P1) 🎯 MVP

**Goal**: Tela de login em `/` (cópia story-blossom-room) com "Continue with
Google"; login OAuth → sessão → `/form` (LLM real); `/form`+`/reader`
protegidos; logout no TopNav.

**Independent Test**: E2E OAuth simulado: `/` → Google → `/form` → geração
runtime real (fake provider); sem sessão `/form` redireciona a `/`; payload sem
identificador; logout remove cookie → `/`.

### Tests (escrever primeiro — devem falhar)

- [X] T020 [P] [US1] Component test da tela de login (título, marca, botões,
  card "AI Playground", foco/teclado) em `tests/unit/login-screen.test.tsx`
- [X] T021 [P] [US1] Teste de paridade i18n — chaves `auth/*` em pt-BR e en
  (estender `tests/unit/i18n-*.test.ts`)/SC-007
- [X] T022 [P] [US1] E2E: jornada login Google simulada (`/` → signIn → sessão
  injetada via JWT de teste → `/form` → geração fake determinística) em
  `tests/e2e/login-google.spec.ts`
- [X] T023 [P] [US1] E2E: proteção do playground — `/form` e `/reader` sem
  sessão → redirect `/`; `POST /api/stories` anônimo → demo, em
  `tests/e2e/playground-guard.spec.ts`

### Implementation

- [X] T024 [P] [US1] Criar `src/features/auth/locales/pt-BR.json` e `en.json`
  com strings da tela de login (título, subtítulo, card, botões, "or", "Sair",
  erros, "acesso restrito", "Explore the Demo")
- [X] T025 [P] [US1] Criar `src/features/auth/components/oauth-provider-button.tsx`
  (`'use client'`): botão com ícone SVG inline (Google/GitHub) e `signIn()` de
  `next-auth/react`; desabilitado quando credenciais ausentes; trata
  `isRedirectError` no try/catch
- [X] T026 [P] [US1] Criar `src/features/auth/components/login-screen.tsx`
  (Server Component): cópia fiel de
  `story-blossom-room/src/routes/index.tsx` adaptada a tokens Blossom +
  next-intl (marca, título, card "AI Playground", botões OAuth, divisor "or",
  botão "Explore the Demo" → `/demo`)
- [X] T027 [P] [US1] Criar `src/features/auth/client/playground-session-provider.tsx`
  (`'use client'`): `SessionProvider` do Auth.js (monta só no playground)
- [X] T028 [US1] Criar `src/app/page.tsx`: renderiza `LoginScreen` (substitui
  o `redirect("/form")` atual) e, **se tiver sessão válida** (`auth()`),
  `redirect("/form")` (FR-015 — login só para anônimos)
- [X] T029 [US1] Atualizar `src/app/layout.tsx`: `SessionProvider` apenas no
  playground (fora de `/demo` e `/demo/reader` — demo zero cookies)
- [X] T030 [US1] Atualizar `src/app/form/page.tsx`: `requireSession()` +
  `isFake=false` (modo da rota, não do env)
- [X] T031 [US1] Atualizar `src/app/reader/page.tsx`: `requireSession()`
- [X] T032 [US1] Implementar botão "Sair" (logout) no TopNav
  `src/features/shell/components/top-nav.tsx`: `signOut({ redirectTo: "/" })`
  visível apenas no playground, cópia localizada (FR-013) + e2e de logout
  (cookie removido → `/`)

**Checkpoint**: US1 funcional e testável isoladamente (MVP) — T020–T023 verdes.

---

## Phase 4: User Story 2 - Entrar no playground com GitHub (Priority: P1)

**Goal**: Paridade total com Google usando GitHub.

**Independent Test**: E2E OAuth simulado GitHub: `/` → GitHub → `/form` →
geração real (fake provider); mesmo runtime e ausência de identidade; e-mail
fora da allowlist rejeitado.

### Tests (escrever primeiro — devem falhar)

- [X] T033 [P] [US2] E2E: jornada login GitHub simulada em `tests/e2e/login-github.spec.ts`
- [X] T034 [P] [US2] E2E: e-mail fora da allowlist é rejeitado (mensagem
  localizada "acesso restrito", sem sessão) em `tests/e2e/allowlist-denied.spec.ts`
- [X] T035 [P] [US2] Unit: credenciais GitHub ausentes → botão desabilitado com
  texto localizado (edge), em `tests/unit/oauth-provider-button.test.tsx`

### Implementation

- [X] T036 [US2] Confirmar provider GitHub em `src/features/auth/server/auth.ts`
  (T012 já inclui ambos — validar paridade de env `AUTH_GITHUB_*` e fluxo)
- [X] T037 [US2] Garantir strings de erro/edge do GitHub nos catálogos
  `src/features/auth/locales/{pt-BR,en}.json`

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 - Explorar a demo sem conta (Priority: P1)

**Goal**: "Explore the Demo" → `/demo` (espelho `/form`) e `/demo/reader`
(espelho `/reader`), anônimos, dados fake (spec 012), zero cookies.

**Independent Test**: E2E: `/` → "Explore the Demo" → `/demo` → geração fake →
`/demo/reader`; nenhum cookie no caminho demo; nenhum LLM real.

### Tests (escrever primeiro — devem falhar)

- [X] T038 [P] [US3] E2E: jornada demo (`/` → `/demo` → geração → `/demo/reader`)
  em `tests/e2e/demo-journey.spec.ts`
- [X] T039 [P] [US3] E2E/unit: invariante — caminho demo não define cookie
  (Set-Cookie ausente) em `tests/e2e/demo-no-cookie.spec.ts`
- [X] T040 [P] [US3] Visual: screenshot aprovado de `/demo` (fluxo fake) em
  `tests/visual/` (demo = mesma UX do playground)

### Implementation

- [X] T041 [P] [US3] Criar `src/app/demo/page.tsx`: `StoryRequestApp` com
  `isFake=true` (sem `requireSession`, sem `SessionProvider`)
- [X] T042 [P] [US3] Criar `src/app/demo/reader/page.tsx`: espelho do reader
  (in-memory, sem sessão)
- [X] T043 [US3] Stories Storybook da tela de login (default/edge: creds
  ausentes; error: falha OAuth; reduced-motion) em
  `src/features/auth/components/login-screen.stories.tsx` +
  `oauth-provider-button.stories.tsx`
- [X] T044 [US3] Estender `tests/e2e/security-headers.spec.ts`: fluxo de login
  e demo mantêm CSP/HSTS/headers intactos (nenhuma relaxação no diff)

**Checkpoint**: Todas as user stories funcionais e independentes.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T045 [P] Atualizar `specs/009-frontend-routes/` (frontend-routing.md):
  `/` deixa de redirecionar; `/demo`/`/demo/reader` novas; `/form`+`/reader`
  exigem sessão
- [X] T046 [P] Atualizar README: deployment (`storybook-ai.hashinaga.dev`,
  Vercel + Cloudflare CNAME `cname.vercel-dns.com`, env de auth, consoles
  Google/GitHub OAuth, deploy demo-only, `AUTH_ALLOWLIST_EMAILS`)
- [X] T047 [P] Rodar `pnpm audit` final (CVE do `next-auth@beta` verificado) e
  conferir Dependabot
- [X] T048 [P] Rodar `quickstart.md` C1–C6 (demo, logins, proteção, budgets)
- [X] T049 Verificar budgets (rota inicial ≤250 KiB gzip; LCP p75 ≤2.5 s) via
  `pnpm test:performance`; lazy-load do SDK de auth se necessário
- [X] T050 Rodar gates finais após a ÚLTIMA edição: `pnpm lint` (0 warnings),
  `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage:check`
- [X] T051 Commit final com gitmoji + Conventional Commits
  (ex.: `:lock: feat(auth): login screen with Google/GitHub OAuth + demo mode`)

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2)** → **US1 → US2 → US3**
- **US1** depende de T017–T018 (modo) + auth server (Fase 2)
- **US2** depende da tela de login (T026–T028) — só paridade GitHub + testes
- **US3** depende da tela (T026, botão "Explore the Demo") e do modo fake
  (T017/T018)
- **Polish (P6)** depende de todas as stories desejadas

### Parallel Opportunities

- Fase 1: T002/T003/T004 ∥ (após T001)
- Fase 2: T005–T011 (testes) ∥ T012–T016 (auth server) ∥ T019 (TopNav);
  T017/T018 espelhados
- Fase 3: T020–T023 (testes) ∥ T024–T027 [P]; depois T028–T032 (sequencial:
  layout → pages → logout)
- Fase 5: T038–T040 [P] ∥ T041–T042 [P]; depois T043–T044 [P]
- Fase 6: T045/T046/T047/T049 [P]

---

## Parallel Example: Fase 3 (User Story 1)

```bash
# Testes (primeiro, em paralelo):
Task: "Component test da tela de login em tests/unit/login-screen.test.tsx"
Task: "Paridade i18n auth/* em tests/unit/i18n-*.test.ts"
Task: "E2E login Google em tests/e2e/login-google.spec.ts"
Task: "E2E proteção do playground em tests/e2e/playground-guard.spec.ts"

# Implementação [P] em paralelo:
Task: "locales em src/features/auth/locales/"
Task: "oauth-provider-button.tsx em src/features/auth/components/"
Task: "login-screen.tsx em src/features/auth/components/"
Task: "playground-session-provider.tsx em src/features/auth/client/"

# Sequencial:
Task: "page.tsx → LoginScreen + redirect autenticados"
Task: "layout.tsx → SessionProvider só no playground"
Task: "form/page.tsx → requireSession + isFake=false"
Task: "reader/page.tsx → requireSession"
Task: "top-nav.tsx → botão Sair (logout)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Fase 1 (Setup) → 2. Fase 2 (Foundational) → 3. Fase 3 (US1 Google) →
   **STOP e VALIDA** (T020–T023 verdes) → deploy.

### Incremental Delivery

Setup+Foundational → US1 → deploy (MVP) → US2 → US3 → Polish (docs/audit/
budgets/gates).

### Parallel Team Strategy

1. Equipe completa Setup + Foundational
2. Após Foundational: Dev A → US1; Dev B → US3 (prepara `/demo`+tests);
   Dev C → US2 (após US1); integração final.

---

## Notes

- [P] = arquivos diferentes, sem dependências
- [Story] = rastreabilidade à user story
- Testes falham antes de implementar (test-first)
- Cada story completável e testável independentemente
- Segurança: testes da Fase 2 (T006–T010) são gate de implementação — nenhuma
  feature de auth entra sem eles verdes
