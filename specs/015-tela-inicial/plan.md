# Implementation Plan: Tela Inicial — Login (Google/GitHub) + Demo

**Branch**: `015-tela-inicial` | **Date**: 2026-08-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-tela-inicial/spec.md`
(redigida a partir do input do usuário: autenticação Google/GitHub + botão demo
sem auth + cópia da tela de login de `protótipo` + playground com LLM
real vs demo com dados fake).

## Summary

Transformar `/` (hoje `redirect("/form")`) em uma **tela de login** copiada de
`protótipo (src/routes/index.tsx`: marca + card "AI Playground" com
**Continue with Google** e **Continue with GitHub** (OAuth via Auth.js v5) e
**Explore the Demo** (→ `/demo`). Autenticado → **playground** (`/form`,
`/reader`, LLM real). Demo → **dados fake** (catálogo spec 012), anônimo, sem
cookies. O modo real/fake passa a ser **derivado da sessão no servidor** (com
`STORIES_TEST_MODE=fake` como override de teste), mantendo o payload de
geração inalterado. **Exige emenda ratificada** da regra "no cookies" do
AGENTS.md (ver Constitution Check).

## Technical Context

**Language/Version**: TypeScript strict, Next.js 16.3.1 (App Router), React 19.2.8

**Primary Dependencies**: `next-auth@5.0.0-beta` (Auth.js v5 — provedores
`google`/`github`, sessão JWT stateless, sem adapter/banco). Sem dependência
nova de ícones (SVG inline, como o TopNav atual).

**Storage**: Nenhum. Sessão JWT stateless em cookie httpOnly
(`authjs.session-token`). Sem banco, sem cache de história, sem persistência
de identidade.

**Testing**: Vitest (unit/component/contract/pipeline), Playwright (e2e),
Storybook test-runner (stories + a11y), visual (Playwright screenshots),
performance (budgets CI). OAuth simulado via JWT assinado com `AUTH_SECRET` de
teste; nenhuma chamada real a Google/GitHub/LLM em testes.

**Target Platform**: Web (browser), Vercel-ready; dev em `http://localhost:3000`

**Project Type**: Web application (Next.js App Router, RSC por padrão,
`'use client'` só onde há interatividade)

**Performance Goals**: rota inicial ≤250 KiB gzip; LCP p75 ≤2.5 s (mid-tier
mobile/4G); login e demo dentro do budget; sem asset pesado no caminho crítico.

**Constraints**:
- Privacidade: payloads de geração inalterados (`ageBand|locale|theme|sceneCount`,
  Zod `.strict()`); nenhum identificador em logs/payloads/fakes; `/demo` sem
  cookies; demo nunca consome LLM real.
- Servidor: `POST /api/stories` continua o único endpoint de geração,
  `Cache-Control: no-store`; superfície de servidor nova = apenas
  `/api/auth/[...nextauth]` (rate-limited, no-store).
- Segurança: CSP existente sem relaxação (fluxo OAuth é same-origin + redirect
  top-level; nenhuma mudança prevista — qualquer mudança DEVE ser rotulada);
  `AUTH_*` só via `getEnv()`.
- UX: design tokens (spec 007), next-intl pt-BR/en, a11y (AA, teclado, foco,
  `aria-live`, reduced-motion), Storybook = app (Princípio III).

**Scale/Scope**: app pessoal/não comercial; tráfego baixo; 1 instância;
sem multiusuário real (sessão é apenas porta para o playground).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Status | Notas |
|------|--------|-------|
| I. Code Quality | ✅ PASS | strict TS, lint/format/typecheck, módulos focados, sem dead code |
| II. Testing Standards | ✅ PASS | test-first; tiers unit/contract/e2e/visual/stories; determinístico (OAuth simulado) |
| III. UX Consistency | ✅ PASS | design tokens, i18n, a11y, Storybook = app, cópia fiel da referência |
| IV. Performance | ✅ PASS | budgets mantidos; sem dep nova pesada; SVG inline |
| **Privacy rules (AGENTS.md — "no cookies", "anonymous by design")** | ✅ **PASS — EMENDA RATIFICADA** | ver abaixo |

**EMENDA RATIFICADA (2026-08-18)**: o AGENTS.md proíbe cookies e define o app
como anônimo por design; autenticação OAuth exige um cookie de sessão. O dono
do projeto **ratificou explicitamente** a exceção mínima (um único cookie
httpOnly JWT stateless, somente no playground; demo anônima/sem cookies;
identidade nunca persistida/logada/enviada a provedores), registrada em
`docs/adr/0012-auth-session-playground.md` (Status: Ratificado) e na seção
"Non-Negotiable Privacy Rules" do AGENTS.md. **Pré-requisito de governança
satisfeito — a implementação pode iniciar.**

*Re-check pós-design: ✅ PASS — emenda documentada (ADR 0012) e ratificada.*

## Project Structure

### Documentation (this feature)

```text
specs/015-tela-inicial/
├── plan.md              # este arquivo
├── research.md          # Fase 0: Auth.js v5, sessão JWT, CSP, rate limit
├── data-model.md        # Fase 1: Session JWT, AuthProvider, GenerationMode
├── quickstart.md        # Fase 1: cenários de validação C1–C6
├── contracts/
│   └── auth-flow.md     # rotas, fluxo OAuth, cookie, derivação do modo, erros
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado por /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                       # tela de login (era redirect → /form)
│   ├── demo/page.tsx                  # NOVO: app em modo demo (fake, sem cookie) — espelha /form
│   ├── demo/reader/page.tsx           # NOVO: leitor da demo (fake, in-memory) — espelha /reader
│   ├── api/auth/[...nextauth]/route.ts# NOVO: handler Auth.js v5 (server-only)
│   ├── form/page.tsx                  # playground; requer sessão; isFake=false
│   ├── reader/page.tsx                # requer sessão
│   └── layout.tsx                     # SessionProvider apenas no playground
├── features/
│   ├── auth/
│   │   ├── server/
│   │   │   ├── auth.ts                # NextAuth config (Google+GitHub, JWT 24h,
│   │   │   │                          #   session callback → {authenticated,provider})
│   │   │   ├── session.ts             # auth() helper + requireSession() (redirect /)
│   │   │   └── auth-rate-limit.ts     # wrapper InMemoryRateLimiter p/ /api/auth/*
│   │   ├── components/
│   │   │   ├── login-screen.tsx       # cópia fiel (design tokens + next-intl)
│   │   │   └── oauth-provider-button.tsx # Google/GitHub (signIn cliente, disabled sem env)
│   │   ├── client/
│   │   │   └── playground-session-provider.tsx  # SessionProvider (só playground)
│   │   └── locales/                   # pt-BR.json, en.json (strings da tela/erros)
│   └── shell/components/top-nav.tsx   # home → "/" (era /form); aria-current atualizado
├── features/story-generation/server/generation-runtime.ts  # modo: sessão + STORIES_TEST_MODE
├── features/story-read-aloud/server/tts-runtime.ts         # idem
└── lib/env.ts                        # + AUTH_SECRET, AUTH_GOOGLE_*, AUTH_GITHUB_*, AUTH_URL, AUTH_TRUST_HOST, AUTH_ALLOWLIST_EMAILS

tests/                                # unit, contract, pipeline (fixtures/fakes)
e2e/                                  # Playwright: demo + login (OAuth simulado) + proteção
```

**Structure Decision**: feature-based (padrão do repo — `src/features/<feature>/
{components,client,server,locales}`); auth é uma feature nova com server-only
boundary (AGENTS.md: módulos que importam o SDK de auth/provedores devem ser
`server-only`). O runtime de geração/TTS já é o ponto único de decisão
real/fake — estendido sem nova camada.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Cookie de sessão (httpOnly JWT) — viola "no cookies" do AGENTS.md | autenticação OAuth exige sessão para autorizar o playground (LLM real) por pedido explícito do dono | demo sem cookies (mantida); sessão em memória do servidor (não escala e viola statelessness); sessão client-side (insegura — token exposto) |
| Identidade verificada (sub do provedor) — viola "anonymous by design" | distinguir playground (LLM real) de demo (fake) exige prova de autenticação no servidor | modo enviado pelo cliente no payload (forjável, fura o "closed enum set"); chave por IP (compartilhável, não prova identidade) |
