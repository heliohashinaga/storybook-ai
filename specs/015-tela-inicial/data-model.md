# Data Model — Spec 015 (Autenticação + Demo)

**Branch**: `015-tela-inicial` | **Date**: 2026-08-18

> **Princípio**: o app permanece **sem banco de dados e sem persistência de
> identidade**. A única "entidade" nova é a **sessão JWT stateless** (cookie
> httpOnly), derivada do OAuth. Nenhuma história, idade, e-mail ou nome é
> armazenado ou associado à sessão.

## Entidades

### 1. AuthProvider (enum)

| Campo | Tipo | Valores |
|-------|------|---------|
| `id` | string literal | `"google"` \| `"github"` |

- Disponível quando o par `AUTH_{PROVIDER}_ID`/`AUTH_{PROVIDER}_SECRET` está
  configurado no `lib/env.ts` (whitelist Zod `.strict()`).
- Ausência de credenciais → botão correspondente desabilitado com texto
  localizado; a demo permanece funcional.

### 2. Session (JWT stateless — sem armazenamento)

| Claim | Tipo | Origem |
|-------|------|--------|
| `sub` | string | id estável do usuário no provedor OAuth |
| `provider` | `"google" \| "github"` | provedor usado no login |
| `iat` / `exp` | timestamp | emissão/expiração (TTL 24h) |

- Transporte: cookie `authjs.session-token` — `httpOnly`, `SameSite=Lax`,
  `Secure` (prod), path `/`.
- **Não** são incluídos/expostos ao cliente: e-mail, nome, foto, token de
  acesso do provedor. O `session` callback do Auth.js expõe apenas
  `authenticated: true` + `provider`.
- Validação: assinatura HMAC (`AUTH_SECRET`), expiração (`exp`). Nenhuma
  consulta a banco.
- Transição de estado: `anon → (login Google/GitHub) → authed`; `authed →
  (logout/expiração) → anon`.

### 3. GenerationMode (derivado — não armazenado)

| Modo | Condição (servidor) | Runtime usado | Rotas |
|------|---------------------|---------------|-------|
| `playground` | sessão válida **e** `STORIES_TEST_MODE !== "fake"` | provedores reais (LLM) | `/form`, `/reader` (requerem sessão) |
| `demo` | sem sessão, **ou** `STORIES_TEST_MODE === "fake"` (override) | provedores fake (catálogo spec 012) | `/demo` (anônimo, sem cookie) |

- Derivação exclusivamente no servidor (`auth()` + env), nunca no cliente —
  garante que LLM real só roda autenticado (FR-005).
- O cliente recebe o modo como prop `isFake` derivado da **rota** (não do env)
  para manter UI = servidor.

## Relacionamentos

```text
AuthProvider (google|github)
      │ 1..n
      ▼
Session (JWT: sub, provider, iat, exp)  ──►  habilita GenerationMode=playground
                                                    │
                                                    ▼
                                    POST /api/stories (payload inalterado:
                                    ageBand, locale, theme, sceneCount)
```

## Regras de validação (das FRs)

- **FR-006/FR-007**: a sessão nunca contém e-mail/nome; o cookie é
  `httpOnly`+`SameSite=Lax`+`Secure`; `/demo` não recebe cookie.
- **FR-008**: payload de geração permanece o schema Zod `.strict()` atual —
  nenhum campo novo (nem `userId`, nem `mode` no body).
- **FR-009**: endpoints de auth rate-limited + `no-store`.
- **FR-016**: allowlist `AUTH_ALLOWLIST_EMAILS` validada em memória no callback
  `signIn` (rejeita fora da lista; e-mail nunca persistido/logado).

## Decisões de modelagem

1. **Sem entidade User persistida**: a sessão JWT é autossuficiente; não há
   tabela, coleção ou arquivo de usuários. (Consistente com a emenda de
   privacidade e com "no persistence".)
2. **Modo derivado, não enviado**: o cliente não envia `mode` no payload —
   evita forjar "real" e mantém o contrato fechado (AGENTS.md).
3. **Override de teste**: `STORIES_TEST_MODE=fake` tem precedência sobre a
   sessão (e2e/visual/storybook rodam determinísticos mesmo com credenciais
   presentes no ambiente).
