# ADR 0013 — Migração do playground para Clerk (usuários + senha + autoCadastro)

- Status: **Ratificado** (aprovação do dono do projeto, 2026-08-19 — implícita na
  direção de implementação da feature 018)
- Decisores: manutenção do `storybook-ai` (dono do projeto)
- Data: 2026-08-19
- Contextos relacionados: AGENTS.md ("Non-Negotiable Privacy Rules"); ADR 0012
  (sessão OAuth para o playground); spec `018-clerk-session-playground`;
  spec `015-tela-inicial`; constitution.md (Governance: amendments documentados
  e aprovados).

> Emenda ao AGENTS.md conforme governança do `constitution.md` (amendments
> exigem documentação e aprovação humana). Este ADR **reverte parcialmente** a
> posição do ADR 0012 ("Provedor SaaS (Clerk/Auth0) rejeitado") por mudança de
> requisito, **sem** tocar no invariante de anonimato da criança.

## Contexto

O ADR 0012 introduziu a menor exceção possível à regra "no cookies": uma sessão
OAuth (Google/GitHub) stateless (JWT) para gate do playground, rejeitando
explicitamente SaaS de identidade "por depender externo desnecessário para app
pessoal". A autorização era por **allowlist de e-mails em env** (`AUTH_ALLOWLIST_EMAILS`).

Novo requisito do dono:

1. Manter login com **Google**;
2. Adicionar login por **usuário e senha**;
3. **AutoCadastro** self-service (criar conta sozinho), mas **somente se
   permitido** (só o dono ou familiares);
4. **Reset de senha** self-service (esqueci minha senha).

AutoCadastro e reset de senha exigem **usuários persistentes** (PII: e-mail +
hash de senha) e **entrega de e-mail** — impossíveis no desenho env/stateless do
ADR 0012 (credencial em env não se cadastra; reset exige e-mail). O requisito
cresceu de "gate de acesso" para "sistema de contas".

## Decisão

Adotar **Clerk** (auth gerenciada SaaS) para o **playground**, com:

1. **Provedores**: Google OAuth (gerenciado pelo Clerk) **+** e-mail/senha
   (Clerk). GitHub removido (não mais requisito; opcional no painel).
2. **AutoCadastro gated = modo "Invite-only" do Clerk** (free tier): sign-up
   aberto desabilitado; **só e-mails convidados pelo dono se cadastram**. A
   allowlist em env (`AUTH_ALLOWLIST_EMAILS`) é **removida** — o gating passa a
   viver no painel do Clerk (invites). Nota: o modo "Restricted" (allowlist
   com nomes de e-mail) é pago em produção no plano selecionado; **Invite-only**
   é free e atende "só pode se cadastrar se for permitido".
3. **Reset de senha self-service** via e-mail (forgot password) — funcionalidade
   do Clerk incluída no free tier.
4. **Escopo do cookie preservado**: `ClerkProvider` montado **somente** no route
   group `(playground)` (`/form`, `/reader`) e na página de login `/`. A rota
   demo (`/demo`) **não** monta o provider → continua 100% cookie/anônimo.
   `clerkMiddleware` com `publicRoutes` para `/`, `/demo`, `/api/stories`,
   `/api/narrate` (Playground protegido).
5. **Identidade da criança intacta (invariante)**:
   - Payload de geração continua **apenas** `ageBand|locale|theme|sceneCount`
     (Zod `.strict()`); `POST /api/stories` e `/api/narrate` seguem
     `Cache-Control: no-store`.
   - Nenhum identificador de criança (nome, idade exata) em UI, API, logs,
     analytics ou payload de provider. A conta é do **adulto/família** que faz o
     gate; a história permanece anônima e nunca associada a usuário.
6. **Superfície server**: `isAuthenticated()`/`requireSession()` mantêm a
   mesma assinatura (reescritos por cima de `auth()` do `@clerk/nextjs/server`),
   minimizando mudança nos consumidores. Rate limiting IP de `/api/stories` e
   `/api/narrate` permanece inalterado. O limiter custom de `/api/auth/*`
   (Auth.js) é removido — o Clerk rate-limita os endpoints próprios.

## Alternativas consideradas

| Alternativa                                                             | Por que foi rejeitada                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manter Auth.js + `Credentials` provider com senha em env                | Serve para **um** usuário/credencial estática, mas **não** suporta autoCadastro nem reset self-service (exigem persistência + e-mail)                                                                                       |
| Auth.js v5 + banco (SQLite/Prisma) + autoCadastro + reset feitos na mão | Resolve, mas exige implementar hashing, token store, fluxo de e-mail e segurança de reset — muito código custom para exatamente o que um provider gerenciado entrega; e-mail continua dependência externa de qualquer forma |
| Permitir autoCadastro aberto sem gating                                 | Fura "só eu e família"; quebra requisito 3                                                                                                                                                                                  |
| Allowlist de e-mails no modo Restricted do Clerk                        | Pago em produção no plano escolhido; Invite-only é free e equivale (ou supera) o requisito                                                                                                                                  |

## Consequências

- **AGENTS.md**: a seção "Non-Negotiable Privacy Rules" passa a registrar que
  a autenticação do playground é feita via Clerk (novo ADR), com a ressalva de
  que **o anonimato da criança é invariante intocável** — contas são de adultos
  que fazem o gate; histórias continuam anônimas e sem associação a usuário.
- **Privacidade**: o usuário anônimo (rota demo) mantém o comportamento atual —
  sem cookies, sem identidade, sem LLM real.
- **Segurança**: CSP precisa ganhar origens do Clerk (`script-src`,
  `connect-src`, `frame-src`) — relaxamentos **sinalizados no diff** em
  `next.config.ts` (nenhum looseness não rotulado). Remoção de `AUTH_*` e
  adição de `CLERK_*` em `src/lib/env.ts` (`.strict()`). A variável
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` é **exceção registrada** à regra
  "no `NEXT_PUBLIC_*`" do AGENTS.md: é uma chave **publishable** (não-secreta,
  por design exposta ao browser); `CLERK_SECRET_KEY` permanece server-only.
- **Dependência externa**: uptime/SSO do playground passa a depender do Clerk.
  Aceito pelo dono para este app pessoal não-comercial.
- **Testes**: testes Auth.js (session/cookie/oauth-guards/allowlist/rate-limit)
  reescritos para **mockar** `@clerk/nextjs/server` e `@clerk/clerk-react` via
  MSW — sem chamadas live. Invariantes de privacidade ainda asserts nos testes.
- **Exceção escopada à Constitution III (Storybook espelha o app)**: por decisão do
  dono (decisão B), os **internos das Clerk Components** (`<SignIn>`/`<SignUp>`) **não**
  são cobertos por stories do repo — o visual/i18n é do Clerk (`pt-BR`) e o Storybook
  cobre os **wrappers do app** (login screen: StarField/DemoLink/layout/estado). Esta é
  uma **exception aprovada e documentada** (não diluição silenciosa) ao MUST de stories;
  os wrappers do app continuam obrigatoriamente com `.stories.tsx` + a11y.

## Referências

- `specs/018-clerk-session-playground/{spec,plan,tasks}.md`
- `specs/015-tela-inicial/contracts/auth-flow.md` (contrato antigo, será atualizado)
- ADR 0012 (posição original, parcialmente revertida aqui)
- `constitution.md` v1.1.0 (Governance)
- Clerk docs: restricting access (Invite-only), forgot password, free plan
