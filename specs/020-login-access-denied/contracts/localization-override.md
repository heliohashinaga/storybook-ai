# Contract: Override de localização de acesso negado (app ↔ Clerk)

**Feature**: `020-login-access-denied` | **Branch**: `feature/020-login-access-denied`

## Natureza

Esta feature é **interna** (UI/localização) — não há mudança em API pública, OpenAPI ou rotas de
servidor. O único "contrato" novo é a **fronteira de mapeamento** entre a `LocalizationResource` do
Clerk e os catálogos next-intl do app. Este arquivo documenta essa fronteira para que `tasks.md` e
os testes tenham uma referência única.

## Fronteira (input → output)

```
Clerk emite erro de permissão no fluxo <SignIn>/<SignUp> (restricted/invite-only)
  → clerkLocalizationFor(locale) resolve a cópia localizada do app
  → ClerkProvider (localization) renderiza a mensagem localizada dentro do UI do Clerk
```

### Mapeamento de chaves

| Chave Clerk (`LocalizationResource`, nível topo) | Cópia app (next-intl `login.*`) | pt-BR | en |
|---|---|---|---|
| `unstable__errors.not_allowed_access` | `login.accessDenied` | "Esta conta não pode entrar aqui." | "This account can't sign in here." |
| `unstable__errors.organization_not_found_or_unauthorized` | `login.accessDenied` | idem | idem |

### Regras do contrato

1. **Exclusividade**: `unstable__errors.not_allowed_access` e
   `organization_not_found_or_unauthorized` **sempre** resolvem para `login.accessDenied` (genérica,
   sem identificador). Erros não-permissionais **nunca** mapeiam para `accessDenied` → usam
   `login.signInError` ou o default do Clerk.
2. **Neutralidade**: a mensagem final é indistinguível entre conta existente-sem-permissão e e-mail
   inexistente (anti-enumeração).
3. **Identidade**: nenhuma das cópias contém e-mail/nome/id (privacidade).
4. **Espalhamento defensivo**: o override NUNCA pode quebrar se o Clerk remover/renomear a chave em
   versão futura — o spread sobre o `base` garante isso.
5. **Escopo da tela**: o override aplica-se **somente** na tela de login (`/`). Playground autenticado
   e demo permanecem intactos.

## Validação do contrato

- Teste unitário hermético de `clerkLocalizationFor({ locale: 'pt-BR' | 'en' })` retornando as
  chaves mapeadas para as cópias do app — **sem** dependência de rede/estado.
- Teste de invariante de privacidade: as cópias resultantes não contêm {@pattern email} nem
  identificador.

## Fora de escopo (inalterado)

- `POST /api/stories`, `POST /api/narrate` e OpenAPI (`story-generation.openapi.yaml`) — **não
  tocados**.
- Estrutura de sessão/cookie (`authjs.session-token` → Clerk session) — inalterada.
- Demo (`/demo`, `/demo/reader`) — zero cookies, inalterada.