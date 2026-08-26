# Contrato: Autenticação (OAuth Google/GitHub) + Modo Demo

**Spec**: 015-tela-inicial | **Branch**: `015-tela-inicial` | **Date**: 2026-08-18

**Scope**: Define a superfície de autenticação (rotas, cookies, redirects) e a
derivação do modo real/fake. **Não altera** o contrato de geração existente
(`contracts/story-generation.openapi.yaml` — `POST /api/stories` com
`ageBand|locale|theme|sceneCount` permanece intacto).

## 1. Rotas novas

| Rota | Método | Acesso | Comportamento |
|------|--------|--------|---------------|
| `/` | GET | público | Tela de login (cópia protótipo). Substitui o redirect → `/form` (spec 009). |
| `/demo` | GET | público, **sem cookie** | App em modo demo (dados fake spec 012), anônimo — espelha `/form`. |
| `/demo/reader` | GET | público, **sem cookie** | Leitor de história da demo — espelha `/reader` (in-memory). |
| `/form`, `/reader` | GET | **requer sessão** | Playground (LLM real). Sem sessão → `redirect("/")`. |
| `/api/auth/[...nextauth]` | GET/POST | público | Handler Auth.js v5 (signin, callback, session, signout, csrf). |

## 2. Fluxo OAuth (Authorization Code + PKCE — gerido pelo Auth.js)

```text
Usuário em "/" → clica "Continue with Google|GitHub"
  → POST /api/auth/csrf (same-origin, obtém csrfToken)
  → POST /api/auth/signin/{provider} (form, same-origin)
  → 302 → accounts.google.com / github.com (top-level navigation)
  → usuário autoriza
  → GET /api/auth/callback/{provider}?code=...&state=...
  → Auth.js valida state/code, emite cookie authjs.session-token
  → redirect → /form (playground)
```

- **Sem server actions** (issue #13387 no Next 16): usamos `signIn()` do
  cliente (`next-auth/react`) ou form POST direto — nunca `signIn` como server
  action.
- Todos os hops são **same-origin** exceto o redirect top-level ao provedor →
  **nenhuma mudança de CSP** prevista (R5 do research.md).

## 3. Cookie de sessão

| Atributo | Valor |
|----------|-------|
| Nome | `authjs.session-token` |
| HttpOnly | `true` |
| SameSite | `Lax` |
| Secure | `true` em produção |
| Path | `/` |
| TTL | 24h (configurado; default Auth.js é 30d) |

- **Invariante**: nenhuma rota do caminho demo (`/`, `/demo`) chama o handler
  de sessão; o `SessionProvider` monta apenas no playground. Demo = zero
  cookies.

## 4. Derivação do modo (servidor)

```text
modo(storyGenerationRequest) =
  STORIES_TEST_MODE === "fake"   → demo            (override de teste, precedência)
  senão sessão válida            → playground (LLM real)
  senão                          → demo            (defense-in-depth: anônimo nunca roda LLM real)
```

- Decisão dentro do runtime de geração (`generation-runtime.ts` /
  `tts-runtime.ts`), que hoje lê `STORIES_TEST_MODE` e passa a consultar a
  sessão via `auth()`.
- O cliente recebe `isFake` por **rota** (`/demo` → true), mantendo UI e
  servidor coerentes (Princípio III).

## 5. Segurança

- **Rate limiting**: `/api/auth/*` passa pelo `InMemoryRateLimiter` (chave por
  IP resolvido via `resolveClientIp()`; regras `X-Forwarded-For` mantidas).
- **Cache**: todos os `/api/auth/*` respondem `Cache-Control: no-store`.
- **Segredos**: `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`
  apenas via `getEnv()` (whitelist Zod `.strict()`); nunca ao cliente.
- **Allowlist**: `AUTH_ALLOWLIST_EMAILS` (opcional, vírgula-separada) — e-mail
  do provedor é comparado **em memória** no callback `signIn`; fora da lista →
  login rejeitado; nunca persistido, logado ou exposto.
- **Privacidade**: identidade (sub) só dentro do JWT; e-mail/nome nunca
  persistidos, logados ou enviados aos provedores de LLM (FR-006).

## 6. Erros

| Caso | Comportamento |
|------|---------------|
| Credenciais OAuth ausentes (env) | botão desabilitado + texto localizado; demo intacta |
| E-mail fora da allowlist | login rejeitado no callback → volta a `/` com mensagem localizada "acesso restrito"; e-mail não logado/persistido |
| Erro/negação no provedor | volta a `/` com mensagem localizada (aria-live); nenhum estado corrompido |
| `POST /api/stories` sem sessão | responde como demo (fake) — nunca LLM real |
| `/form` sem sessão | `redirect("/")` |
| Rate limit atingido | 429 com mensagem localizada (padrão existente de rate-limit) |

## 7. Impacto em contratos existentes

- `story-generation.openapi.yaml`: **inalterado** (FR-008).
- `frontend-routing.md` (spec 009): `/` deixa de redirecionar; `/demo` é nova
  rota stateless; `/form`+`/reader` passam a exigir sessão. Atualizar o doc
  como parte da implementação.
- Rate limit de `/api/stories` e `/api/narrate`: **inalterado** (a sessão não
  muda a chave de rate limit anônima).
