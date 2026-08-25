# Research: Clerk para autenticação do playground

**Feature**: [spec.md](spec.md) | **Branch**: `018-clerk-session-playground`

## Objetivo

Validar que Clerk (auth gerenciada) atende os requisitos do dono **no plano free**
("Developer"), antes de fechar o ADR 0013. Foco: cadastro gated e reset de senha.

## Decisões (R-NN)

### R-01 — AutoCadastro gated: usar modo **Invite-only**, não allowlist

- Clerk tem três modos de sign-up: **Open**, **Invite-only** (a.k.a. "restricted":
  `sign_up_mode = restricted`) e **Waitlist**.
- **Invite-only**: sign-up aberto desabilitado; **somente** usuários convidados
  (invites) ou criados pelo admin entram. ✅ disponível no free tier.
- **Allowlist** (restringir a e-mails/domínios específicos): **habilitar em produção
  exige plano pago**, e só funciona em modo "Open" (incompatível com Invite-only).
- **Decisão**: usar **Invite-only**. Atende "só pode se cadastrar se for permitido"
  e é free. Remove a allowlist de env (`AUTH_ALLOWLIST_EMAILS`) — o gating passa ao
  painel do Clerk (invites por e-mail).

Fonte: Clerk docs (Restricting Access), Clerk Pricing, Changelog "Restricted Sign-up Mode".

### R-02 — Reset de senha self-service (forgot password) está no free tier

- Habilita e-mail/senha no painel; o fluxo "forgot password" avalia o link/OTP de
  reset por e-mail automaticamente, sem config custom.
- Disponível no free tier.

Fonte: Clerk docs "Forgot Password", Clerk Pricing.

### R-03 — Login por Google + usuário/senha simultâneos

- Clerk suporta múltiplos "connection strategies": OAuth **Google** **e**
  **email/password** na mesma instância. ⚠️ Quando multi-estratégias estão ativas,
  o e-mail pode precisar ser verificado (OTP por e-mail) — a verificação é parte do
  fluxo gerenciado.
- **Decisão**: manter **Google + email/password**. GitHub removido (não é mais
  requisito; pode ficar opcionalmente desabilitado no painel).

Fonte: Clerk docs (Authentication strategies).

### R-04 — Escopo cookie/ClerkProvider

- `@clerk/nextjs` expõe `clerkMiddleware` com `publicRoutes`. Para manter `/demo`
  anônimo, **não** montar `ClerkProvider` no layout da demo; montar em `(playground)`
  e `/`. `publicRoutes` cobre `/`, `/demo`, `/api/stories`, `/api/narrate`.
- Clerk monta cookies `__clerk_*` nas páginas que usam o provider; fora dele não há
  cookie. Manter o design atual (provider só no playground + login).

Fonte: @clerk/nextjs docs (middleware, provider).

### R-05 — Testes determinísticos (sem chamada live)

- Manter princípio "tests never call a live service": mockar `@clerk/nextjs/server`
  (`auth`, `clerkClient`) e `@clerk/clerk-react` (`useSignIn`, `useSignUp`,
  `useUser`, `useSignOut`) via Vitest/MSW. Login e2e via token de teste/fake.
- Clerk não é chamado em CI/testes.

Fonte: convenção do repo (AGENTS.md testing rules); Clerk test helpers (com mock local).

## Notas

- Domínio customizado de e-mail do Clerk é opcional (exige domínio próprio + DNS);
  sem isso, os e-mails saem do domínio padrão do Clerk. Decisão adiada (não bloqueia).
- Política de senha: configurável no painel do Clerk; usar mínimo razoável (≥8).
