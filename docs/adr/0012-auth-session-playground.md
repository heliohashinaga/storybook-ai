# ADR 0012 — Emenda de privacidade: cookie de sessão OAuth para o playground (spec 015)

- Status: **Ratificado (human approval: dono do projeto, 2026-08-18)**
- Decisores: manutenção do `storybook-ai` (dono do projeto)
- Data: 2026-08-18
- Contextos relacionados: spec `015-tela-inicial`; AGENTS.md (seção
  "Non-Negotiable Privacy Rules"); ADR 0009 (rotas de frontend);
  spec `012-fake-content-catalog` (modo demo).

> Emenda ao AGENTS.md conforme governança do `constitution.md` (v1.1.0,
> Governance: _"Amendments MUST be documented, follow semantic versioning, and
> include a brief rationale... getting human approval"_). Ratificação explícita
> do dono do projeto registrada nesta data.

## Contexto

O AGENTS.md proíbe, em "Non-Negotiable Privacy Rules": **no cookies**, **no
persistence**, **anonymous by design** e **no direct identifiers**. A spec 015
(tela inicial) pede, por decisão do dono do projeto:

- Autenticação OAuth (Google e GitHub) como porta de entrada para o
  **playground** (geração com LLM real);
- Botão **demo** sem autenticação, com dados fake (catálogo da spec 012),
  permanecendo anônimo.

Autenticação exige um **cookie de sessão** (transportando uma identidade
verificada) para distinguir, no servidor, playground (LLM real) de demo
(fake) — sem depender de algo forjável pelo cliente (ver Complexity Tracking do
plan.md da spec 015).

## Decisão

Introduzir a menor exceção possível à regra "no cookies", com salvaguardas:

1. **Único cookie de sessão** (`authjs.session-token`) — JWT stateless
   (sem banco, sem persistência de identidade), `httpOnly`, `SameSite=Lax`,
   `Secure` em produção, TTL 24h.
2. **Escopo restrito**: o cookie só existe no caminho do playground
   (`/form`, `/reader`). As rotas `/` e `/demo` **não** recebem cookie —
   o caminho demo permanece 100% anônimo.
3. **Identidade mínima**: o JWT carrega apenas `sub` (id do provedor) e
   `provider`; e-mail/nome/foto/tokens de acesso **nunca** são persistidos,
   logados, expostos ao cliente ou enviados aos provedores de LLM. O session
   callback expõe só `{ authenticated: true, provider }`.
4. **Payload de geração inalterado**: `POST /api/stories` continua com
   `ageBand|locale|theme|sceneCount` (Zod `.strict()`); a sessão é camada de
   autorização, não muda o contrato nem associa histórias a usuários.
5. **Modo derivado no servidor**: sessão válida → LLM real; sem sessão → demo
   (fake). `STORIES_TEST_MODE=fake` continua como override de teste.
   Anônimo **nunca** aciona LLM real (defense-in-depth).
6. **Rate limiting** nos endpoints `/api/auth/*` (`InMemoryRateLimiter`),
   `Cache-Control: no-store`.

## Alternativas consideradas

| Alternativa                                           | Por que foi rejeitada                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Manter "sem cookies" e autorizar por chave por IP     | IP não prova identidade e é compartilhável — não distingue playground de demo de forma confiável            |
| Modo enviado pelo cliente no payload (`mode: "real"`) | Forjável; fura o "closed enum set" do servidor; anônimo conseguiria LLM real                                |
| Sessão em memória no servidor (mapa token→estado)     | Quebra statelessness, não escala, adiciona estado global (hostil ao design atual single-instance in-memory) |
| Provedor SaaS (Clerk/Auth0)                           | Terceiriza identidade para fora do controle; dependência externa desnecessária para app pessoal             |
| OAuth2 manual (PKCE custom)                           | Mais superfície de código/ataque; Auth.js v5 resolve callback/CSRF/state de forma testada                   |

## Consequências

- **AGENTS.md**: a seção "Non-Negotiable Privacy Rules" passa a registrar esta
  exceção ratificada (com link para este ADR). Tudo o mais permanece
  inalterado (sem identificadores em payloads/logs, sem persistência de
  histórias, server-only boundary, etc.).
- **Privacidade**: o usuário anônimo (caminho demo) mantém exatamente o
  comportamento atual — sem cookies, sem identidade, sem LLM real.
- **Segurança**: a superfície de servidor ganha `/api/auth/[...nextauth]`
  (rate-limited, no-store); nenhuma relaxação de CSP prevista (fluxo OAuth é
  same-origin + redirect top-level).
- **Testes**: e2e de login usam OAuth simulado (JWT assinado com `AUTH_SECRET`
  de teste); nenhuma chamada real a Google/GitHub/LLM.

## Referências

- `specs/015-tela-inicial/plan.md` (Constitution Check, Complexity Tracking)
- `specs/015-tela-inicial/contracts/auth-flow.md` (contrato do cookie/fluxo)
- `specs/015-tela-inicial/data-model.md` (Session JWT, GenerationMode)
- `constitution.md` v1.1.0 (Governance)
