# Data Model: Clerk session (spec 018)

**Objectivo**: deixar explícito o que entra/sai no modelo de dados/sessão com Clerk,
e o que **continua proibido**. Este documento é contract entre o app e o provedor de auth.

## Sessão (Clerk)

- **Cookie de sessão**: gerenciado por Clerk (`__clerk_session`, `__clerk_client`,
  `__client_uat` etc.). Sem persisteção de usuário no app; a conta vive no Clerk.
- **TTL**: gerenciado pelo Clerk (configurável; default razoável).
- **Escopo**: presente **somente** nas páginas com `ClerkProvider`
  (`(playground)` → `/form`, `/reader`; e `/` login). **Ausente** em `/demo`.

## Identidade exposta ao app (via `@clerk/nextjs/server` → `auth()`)

O app **consome apenas** o estado de autenticação para gate e modo LLM:

```ts
type AuthState = { userId: string | null } | null; // presença/ausência de login
// Derivado no servidor:
//   autenticado  -> modo "playground" (LLM real)
//   anônimo      -> modo "demo" (fake)
```

- `isAuthenticated()` retorna `boolean` (userId presente).
- `requireSession()` redireciona para `/` quando não autenticado.
- **Identificador de login = e-mail** (sem campo de "usuário" separado); senha com política
  **≥8 + letra e número** (regra no painel do Clerk).
- **Não** persistir, logar ou expor ao cliente: e-mail completo, nome, foto,
  endereço, telefone ou qualquer dado do perfil do usuário além do necessário
  (booleano de autenticação).

## Payload de geração — INVARIANTE (inalterado)

`POST /api/stories` (e `/api/narrate`): **apenas**

```ts
{ ageBand: "2-4"|"5-7"|"8-9"; locale: "pt-BR"|"en"; theme: "courage"|"friendship"|"kindness"|"curiosity"|"perseverance"|"empathy"; sceneCount?: 3|4|5 }
```

- Zod `.strict()` no servidor — campos extras rejeitados.
- `Cache-Control: no-store` em `/api/stories` e `/api/narrate`.

## Entidades

| Entidade | Persistida? | Observação |
|---|---|---|
| Usuário (adulto/cuidador) — conta | Fora do app (no Clerk) | Gate de acesso ao playground |
| Sessão (cookie) | Gerenciada pelo Clerk | Só no caminho do playground + login |
| Pedido de história | **Não** | Anônimo; payload `ageBand\|locale\|theme\|sceneCount` |
| História gerada | **Não** | Em memória no React; nunca associada a usuário |
| Criança | **Nunca** | Sem entidade, sem nome, sem idade exata persistida |

## UI de auth (Clerk Components — decisão B)

- Login, cadastro, verificação de e-mail e reset usam **`<SignIn>`/`<SignUp>`** do
  `@clerk/nextjs` (visual/i18n do Clerk com `appearance` para tokens; `pt-BR`).
- `StarField` e `DemoLink` continuam no wrapper do app (login screen).
- E-mail+senha e Google convivem na mesma instância (multi-estratégia), gerenciados pelo Clerk.

## Env do app (contrato)

Sai (Auth.js): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
`AUTH_GITHUB_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_ALLOWLIST_EMAILS`.

Entra (Clerk):
- `CLERK_SECRET_KEY` (server-only)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — chave **publishable** (não-secreta); exceção registrada à
  regra "no NEXT_PUBLIC_*" (ADR 0013)
- `CLERK_SIGN_IN_URL=/`, `CLERK_SIGN_UP_URL=/`
- `CLERK_AFTER_SIGN_IN_URL=/form`, `CLERK_AFTER_SIGN_UP_URL=/form`

Demo-only deploy: sem `CLERK_SECRET_KEY` → auth desabilitada via **stub** (não montar
middleware/provider; `auth()` retorna null) para **não crachar o Clerk**; demo intacta (mesmo
`if (!secret)` atual). Middleware: matcher inclui `/api/:path*` (contexto p/ `auth()` em route
handlers) e **exclui `/demo`** (sem `__clerk_*` na demo).
