# ADR 0015 — Porteiro senha única substitui o Clerk (revoga 0013)

- Status: **Ratificado** (aprovação do dono do projeto, 2026-10-22)
- Decisores: manutenção do `storybook-ai` (dono do projeto)
- Data: 2026-10-22
- Contextos relacionados: AGENTS.md ("Non-Negotiable Privacy Rules"); ADR 0012
  (sessão OAuth para o playground); ADR 0013 (migração para Clerk);
  `GLOSSARY.md` (porteiro, sessão de porteiro, playground, demo anônima).

## Contexto

O ADR 0013 adotou o Clerk (SaaS gerenciado) porque o requisito tinha crescido
de "gate de acesso" para "sistema de contas": Google + usuário/senha +
auto-cadastro invite-only + reset de senha self-service. O dono confirmou em
2026-10-22 (rounds Q1–Q8) que o uso real é só **porteiro anti-abuso de hobby**:

- dor = peso/invasividade do Clerk (clerk-js no bundle, JS de terceiro,
  cookies `__clerk_*`, `proxy.ts` + gates condicionais, `NEXT_PUBLIC_*`);
- gate no playground continua, demo anônima sem cookie continua;
- público = só confiança, sem signup público nem SSO amplo (Q3);
- gestão de usuários (revogar 1 sem afetar os demais, auditoria por usuário)
  foi julgada preciosismo para 2–5 confianças (Q7–Q8).

## Decisão

Substituir o Clerk por **senha única compartilhada + JWT httpOnly**:

1. `POST /api/gate/login` (`{ password }`, Zod `.strict()`, rate-limit
   10/10min por IP) compara com `PLAYGROUND_PASSWORD_HASH` (hex SHA-256) em
   tempo constante; sucesso emite JWT HS256 (`GATEKEEPER_SECRET`, 24h).
2. Cookie `__Host-gatekeeper` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
   `Max-Age=86400`). Carrega só `{ gate: true }` — sem identidade.
3. `POST /api/gate/logout` apaga o cookie (idempotente, 200 + `no-store`).
4. `proxy.ts` guarda só `/form` e `/reader` (presença do cookie → `next()`,
   ausência → redirect `/`); APIs derivam o modo por request (autenticado →
   playground real; anônimo → demo fake). `requireSession()` verifica a
   assinatura/expiração no servidor.
5. Remoção total: `@clerk/nextjs`, `@clerk/localizations`, `ClerkProviderGate`,
   `clerkMiddleware`, rota `sso-callback`, `clerk-localization.ts`, `<SignIn>`,
   chaves `CLERK_*` (env e CSP); entram `GATEKEEPER_SECRET` (≥32 chars) e
   `PLAYGROUND_PASSWORD_HASH` (`printf %s "$PW" | sha256sum`).

## Consequências

- **Perdido (assumido):** auto-cadastro invite-only, reset self-service, login
  com Google. Adicionar familiar = partilhar a senha por fora; trocar =
  rodar as env e re-deploy. Sem e-mail/nome/sub em lugar algum — máximo
  alinhamento com _anonymous by design_.
- **Privacidade:** demo continua 100% cookie-less; payloads continuam
  `ageBand|locale|theme|sceneCount`; `no-store` em todas as respostas do gate.
- **Segurança:** brute-force contido pelo rate-limit do login + erro genérico
  (sem enumeração); segredo e hash só no servidor (`getEnv()`/`.strict()`).
- **Bundle:** zero JS de auth no cliente; teto de 900 KiB mantido com margem
  ampla (o floor de ~609 KiB do clerk-js deixa de existir).
- **Testes:** `gate.test.ts` + `api/gate/route.test.ts` + sessão mockada por
  cookie; invariantes de privacidade mantidos (nada de identidade em
  payload/log/cookie). E2E `playground-guard` e `demo-no-cookie` inalterados
  em espírito (nome do cookie atualizado).
- **Reversão:** se Q7/Q8 mudarem (revogação individual ou auditoria virarem
  necessidade), migrar para Auth.js/Better-Auth com tabela de usuários — a
  abstração `requireSession()`/`isAuthenticated()` isola a troca.

## Referências

- ADR 0012 (espírito reativado: gate stateless, sem SaaS externo)
- ADR 0013 (revogado por este)
- ADR 0014 (Turnstile demo, inalterado)
