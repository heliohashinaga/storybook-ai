# Quickstart — 018 · Clerk Session Playground

Migrar a autenticação do playground de Auth.js para **Clerk**, adicionando login por
e-mail/senha, autoCadastro gated (Invite-only) e reset de senha self-service — mantendo Google e
a demo anônima. **UI de auth via Clerk Components** (`<SignIn>`/`<SignUp>` — decisão B).

## Pré-requisitos

- Conta no [Clerk](https://clerk.com) (plano free "Developer").
- Criar um aplicativo Clerk; **habilitar** as estratégias **Google** (conectar OAuth client id) e
  **email/password**. Ativar modo **Invite-only** (cadastro só por convite). Definir política de
  senha **≥8 + letra e número** no painel.
- Copiar de `Danger/Development` → `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGN_IN_URL=/
CLERK_SIGN_UP_URL=/
CLERK_AFTER_SIGN_IN_URL=/form
CLERK_AFTER_SIGN_UP_URL=/form
```

## Passos principais (ver tasks.md)

1. **ADR 0013** + emenda no AGENTS.md (feito na branch).
2. **Deps**: remover `next-auth`; adicionar `@clerk/nextjs`, `@clerk/clerk-react`.
3. **Env**: remover `AUTH_*`, adicionar `CLERK_*` (`src/lib/env.ts`, `.env.example`, `.env.local`).
4. **Proxy** `src/proxy.ts` (ex-`src/middleware.ts`; renomeado no Next.js 16) com `publicRoutes`
   para `/`, `/api/stories`, `/api/narrate`; matcher **exclui `/demo`** e **inclui `/api/:path*`**.
5. **Provider**: `ClerkProvider` só em `(playground)` e `/` — **não** no root/demo.
6. **session.ts**: reimplementar `isAuthenticated`/`requireSession` sobre `auth()` do Clerk (com
   stub demo-only).
7. **Login screen**: montar `<SignIn>`/`<SignUp>` do Clerk (StarField/DemoLink no wrapper).
8. **CSP**: origens do Clerk (relaxamento documentado).
9. **Testes**: mockar Clerk (MSW/Vitest); invariantes preservados.
10. **Gates finais** após o último edit: `lint`, `format:check`, `typecheck`, `build`.

## Cuidados

- **Demo (`/demo`)**: não montar `ClerkProvider`; **fora do matcher** do middleware; sem cookie.
- **Anonimato da criança**: payload fechado (`ageBand|locale|theme|sceneCount`); nenhuma história
  associada a usuário.
- **Gating**: Invite-only do Clerk (não allowlist paga em produção).
- **Identificador de login**: e-mail (sem campo de usuário separado).
- **Sem chamada live em testes**: Clerk sempre mockado.
