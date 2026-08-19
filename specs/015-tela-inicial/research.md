# Research: Autenticação (Google/GitHub) + Demo — Spec 015

**Branch**: `015-tela-inicial` | **Date**: 2026-08-18 | **Status**: Complete

## R1 — Biblioteca de autenticação

- **Decision**: Auth.js v5 (`next-auth@beta`, pacote `next-auth` v5.0.0-beta.x
  com import `next-auth/providers/google|github` e `NextAuth({...})`).
- **Rationale**: suporte nativo a App Router (handler `GET/POST` em
  `/api/auth/[...nextauth]`), provedores Google e GitHub prontos, sessão JWT
  stateless sem banco de dados (adequado ao "no persistence" do projeto), e
  detecção automática de env vars no padrão `AUTH_{PROVIDER}_ID/_SECRET`
  (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET`) + `AUTH_SECRET`.
- **Alternatives considered**:
  - OAuth2 manual (PKCE custom): mais código e superfície de ataque; rejeitado
    — o projeto valoriza superfície de servidor mínima.
  - Clerk/Auth0 (SaaS): adiciona dependência de terceiros e dados fora do
    controle; rejeitado — app pessoal, sem conta/assinatura.
  - Session cookie próprio + troca manual de tokens: reinventa o que Auth.js já
    resolve (CSRF, callback, verificação de state); rejeitado.
- **Known issue (Next.js 16)**: `signIn()` como **server action** falha no
  Next 16 (nextauthjs/next-auth#13387 — construção do request sintético,
  protocolo HTTP/HTTPS e `nextHeaders()`). Workaround aprovado: **form POST
  direto para `/api/auth/signin/{provider}`** (GET no `/api/auth/csrf` e POST
  com `csrfToken`), ou `signIn(provider)` no cliente. Na tela de login usamos
  o fluxo **cliente/`next-auth/react` `signIn("google")`** (que faz fetch
  same-origin ao CSRF e redireciona) — sem server actions.

## R2 — Estratégia de sessão

- **Decision**: JWT stateless (estratégia padrão do Auth.js v5; **sem adapter,
  sem banco**). Claims mínimas: `sub` (id do provedor), `exp`, `iat`; nada de
  e-mail/nome no token além do estritamente necessário, e o **session callback
  expõe apenas `authenticated: true`** ao cliente.
- **Rationale**: sessão sem estado = zero persistência de identidade no
  servidor, alinhado à emenda de privacidade; TTL curto; revogação por
  expiração.
- **Cookie**: `authjs.session-token`, `httpOnly`, `SameSite=Lax`, `Secure` em
  produção, path `"/"`, TTL default (30 dias; configuramos 24h). O caminho
  demo (`/demo`) não recebe o cookie (nenhuma rota demo chama o handler de
  sessão; o `SessionProvider` só monta no playground).
- **Alternatives considered**: banco de dados de sessões (rejeitado — não há
  banco e a emenda proíbe persistência); session cookie custom (rejeitado — ver
  R1).

## R3 — Derivação do modo real/fake no servidor

- **Decision**: `POST /api/stories` e `POST /api/narrate` passam a derivar o
  modo de **sessão no servidor** (via `auth()` do Auth.js): sessão válida →
  provedores reais; sem sessão → modo demo (dados fake da spec 012).
  `STORIES_TEST_MODE=fake` permanece como **override explícito** para
  testes/dev determinísticos (e2e, visual, storybook), com precedência sobre a
  sessão.
- **Rationale**: garante por construção que LLM real nunca é consumido sem
  autenticação (defense-in-depth, mesmo que um cliente chame a API direto);
  mantém o schema `.strict()` do payload inalterado (FR-008).
- **Client**: o prop `isFake` de `StoryRequestApp` deixa de vir do env e passa
  a refletir a **rota** (`/demo` → `true`; playground autenticado → `false`),
  evitando divergência entre UI e servidor (Princípio III — Storybook = app).

## R4 — Rotas e navegação

- **Decision**: `/` deixa de redirecionar a `/form` (spec 009) e vira a **tela
  de login** (cópia fiel de `story-blossom-room/src/routes/index.tsx`,
  adaptada a tokens Blossom + next-intl). `/demo` é rota nova (app em modo
  fake, anônimo, sem cookie). `/form`/`/reader` viram o **playground**
  (requerem sessão; sem sessão → redirect a `/`). `/api/auth/[...nextauth]`
  handler novo.
- **Rationale**: espelha a referência (story-blossom-room tem `/` landing e
  `/demo`) e mantém o modelo de rotas stateless da spec 009 para `/` e `/demo`.
- **TopNav**: o botão home (hoje `/form`) passa a apontar para `/` (login) —
  ver FR do shell.

## R5 — CSP e security headers

- **Decision**: CSP existente em `next.config.ts` permanece com
  `default-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, sem
  relaxar nada **exceto** se o fluxo OAuth exigir:
  - O form de login faz POST **same-origin** (`/api/auth/signin/*`) → coberto
    por `form-action 'self'` (sem mudança).
  - O redirect ao provedor (accounts.google.com / github.com) é **navegação
    top-level** (302), não fetch → não afeta `connect-src`.
  - Callback `GET /api/auth/callback/*` é same-origin.
  - **Conclusão**: nenhuma alteração de CSP prevista; se testes de e2e
    mostrarem bloqueio, a mudança DEVE ser rotulada no diff (regra AGENTS.md).
- **Nota**: `Referrer-Policy: strict-origin-when-cross-origin` já cobre o leak
  de referrer ao provedor.

## R6 — Rate limiting e DoS

- **Decision**: reutilizar `InMemoryRateLimiter` (`lib/rate-limit.ts`) nos
  endpoints de auth (`/api/auth/signin/*`, `/api/auth/callback/*`) via
  wrapper no handler; chave por IP resolvido com `resolveClientIp()` (regras
  existentes de `X-Forwarded-For` mantidas). Sem cache (`no-store`) em todos
  os `/api/auth/*`.
- **Rationale**: OAuth público é alvo de abuso (spam de callbacks, força
  bruta de tokens); o projeto já trata rate limiting como seam de segurança.

## R7 — Testes

- **Decision**: 
  - **Unit**: schema de env (`AUTH_*` no `lib/env.ts`), derivação de modo
    (sessão vs `STORIES_TEST_MODE`), callbacks do Auth.js (claims mínimas).
  - **Contract/integration**: `POST /api/stories` sem sessão → fake; com sessão
    (JWT assinado com `AUTH_SECRET` de teste) → runtime real com fake provider;
    handler `/api/auth/*` com `unstable_getServerSession`/MSW.
  - **E2E (Playwright)**: fluxo demo (`/` → `/demo` → reader, sem cookie) e
    fluxo login com **OAuth simulado** (interceptação de rede do callback,
    cookie de sessão injetado por JWT assinado com `AUTH_SECRET` de teste).
  - **Visual/Storybook**: stories da tela de login (default/edge/error: creds
    ausentes, erro OAuth, reduced-motion) + a11y.
- **Rationale**: nenhum teste toca Google/GitHub reais nem LLM real (regra do
  projeto); determinismo garantido por JWT assinado com segredo de teste.

## R8 — Variáveis de ambiente (whitelist `lib/env.ts`)

- `AUTH_SECRET` (obrigatório quando auth ativa; usado para assinar JWT).
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
  `AUTH_GITHUB_SECRET` (opcionais — ausência desabilita o botão/rota
  correspondente; app permanece utilizável em modo demo).
- `AUTH_URL` (opcional; produção/Vercel) e `AUTH_TRUST_HOST=true` para dev
  não-Vercel (necessário para `NEXTAUTH_URL`/host válido no callback).
- `AUTH_ALLOWLIST_EMAILS` (opcional; lista vírgula-separada): allowlist de
  acesso ao playground — e-mail do provedor comparado em memória no callback
  `signIn` (rejeita quem não está na lista; nunca persistido/logado).
- Todas via `getEnv()` (Zod `.strict()`), nunca expostas ao cliente.
