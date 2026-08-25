# Quickstart — 018 · Clerk Session Playground

Migrar a autenticação do playground de Auth.js para **Clerk**, adicionando login por
usuário/senha, autoCadastro gated (Invite-only) e reset de senha self-service — mantendo Google e
a demo anônima.

## Pré-requisitos

- Conta no [Clerk](https://clerk.com) (plano free "Developer").
- Criar um aplicativo Clerk; **habilitar** as estratégias **Google** (conectar OAuth client id) e
  **email/password**. Ativar modo **Invite-only** (cadastro só por convite).
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

1. **ADR 0013** + emenda no AGENTS.md.
2. **Deps**: remover `next-auth`; adicionar `@clerk/nextjs`, `@clerk/clerk-react`.
3. **Env**: remover `AUTH_*`, adicionar `CLERK_*` (`src/lib/env.ts`, `.env.example`, `.env.local`).
4. **Middleware** `src/middleware.ts` com `publicRoutes` para `/`, `/demo`, `/api/stories`,
   `/api/narrate`.
5. **Provider**: `ClerkProvider` só em `(playground)` e `/` — **não** no root/demo.
6. **session.ts**: reimplementar `isAuthenticated`/`requireSession` sobre `auth()` do Clerk.
7. **Login screen**: Google + formulário usuário/senha + criar conta + esqueci a senha.
8. **CSP**: origens do Clerk (relaxamento documentado).
9. **Testes**: mockar Clerk (MSW/Vitest); invariantes preservados.
10. **Gates finais** após o último edit: `lint`, `format:check`, `typecheck`, `build`.

## Cuidados

- **Demo (`/demo`)**: não montar `ClerkProvider`; sem cookie de sessão; anônimo.
- **Anonimato da criança**: payload fechado (`ageBand|locale|theme|sceneCount`); nenhuma história
  associada a usuário.
- **Gating**: Invite-only do Clerk (não allowlist pagável em produção).
- **Sem chamada live em testes**: Clerk sempre mockado.
