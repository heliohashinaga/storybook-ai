# Auth Flow Contract — spec 018 (Clerk)

Atualização do contrato de autenticação do playground, migrando de Auth.js para **Clerk** com
**Clerk Components** (decisão B). Sucede o `contracts/auth-flow.md` da spec 015 (Auth.js).

## Visão

- **Provedor**: Clerk (auth gerenciada, free tier).
- **Provedores de login**: **Google** (OAuth) **+** **e-mail/senha** (mesma instância).
- **Identificador**: **e-mail** (sem campo de "usuário" separado). Política de senha **≥8 + letra
  e número** (config no painel do Clerk).
- **Gating de cadastro**: **Invite-only** — só convidados (invites enviados pelo dono) conseguem
  criar conta; sem convite → cadastro recusado (erro não-enumerável vindo do Clerk).
- **Reset de senha**: self-service, link por e-mail, **embutido** no `<SignIn>`/`<SignUp>`.
- **Verificação de e-mail**: automática (Clerk) no fluxo de cadastro.

## Rotas / escopo (cookie)

- `ClerkProvider` montado **apenas** em `(playground)` (`/form`, `/reader`) e `/` (login).
- **`/demo` fica fora** do `clerkMiddleware` (matcher exclui `/demo`) → sem `__clerk_*` cookie,
  100% anônimo.
- `clerkMiddleware({ publicRoutes: ["/", "/api/stories", "/api/narrate", "/api/health"] })`;
  matcher inclui `/api/:path*` (necessário para `auth()` resolver em route handlers).

## Guardas

- `isAuthenticated()` → booleano (via `auth()` do Clerk); anônimo → modo **demo** (fake).
- `requireSession()` → `redirect("/")` quando não autenticado (guard de `/form` e `/reader`).
- Autenticado → modo **playground** (LLM real).

## Privacidade (invariante)

- Payload de geração continua **apenas** `ageBand|locale|theme|sceneCount` (Zod `.strict()`);
  `Cache-Control: no-store`.
- O app expõe ao cliente apenas o **estado de autenticação**; e-mail/nome/foto do adulto nunca
  são logados, persistidos ou enviados a provedores de LLM.
- Nenhuma história é associada a usuário; a criança permanece anônima (sem entidade).

## Env (ver data-model.md)

`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (+ URLs de redirect). Remoção de `AUTH_*`.
Demo-only (sem `CLERK_SECRET_KEY`) → stub que desabilita auth sem crash.

## Fluxo endpoint de auth

- **Não** há endpoint `/api/auth/*` custom (removido). O Clerk gerencia sign-in/sign-up/verificação/
  reset nos endpoints dele; o app só usa `<SignIn>`/`<SignUp>` + rede de rotas `/api`.
- Rate limit IP do `/api/auth` (Auth.js) é removido; os endpoints do Clerk são rate-limited por ele.
  Rate limit IP de `/api/stories`/`/api/narrate` **permanece inalterado**.
