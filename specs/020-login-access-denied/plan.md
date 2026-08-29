# Implementation Plan: Mensagem de acesso negado no login

**Branch**: `feature/020-login-access-denied` | **Date**: 2026-08-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature spec `specs/020-login-access-denied/spec.md` + decisões do dono (**opção 1**:
mensagem localizada de acesso negado no próprio login, reaproveitando as strings
`accessDenied`/`signInError` já existentes; **não** criar página `/access-denied`; manter a demo
anônima e a privacidade/anti-enumeração) + `research.md` (R-01: override de localização do Clerk).

## Summary

Quando um usuário **sem permissão** é recusado no login/cadastro (autoCadastro _invite-only_ do
Clerk), a tela `/` mostra a mensagem **localizada e genérica** de acesso negado — reaproveitando a
string `login.accessDenied` de `src/features/auth/locales/{pt-BR,en}.json` — em vez de um erro
genérico/vazio do Clerk. O mecanismo é um **override de `LocalizationResource`**: estendemos
`clerkLocalizationFor(locale)` (`login-screen-view.tsx`) para sobrescrever as chaves de permissão
do Clerk (`unstable__errors.not_allowed_access` e
`unstable__errors.organization_not_found_or_unauthorized`) com a cópia localizada do app.
**Nenhum** banner custom, **nenhum** bundle novo, **nenhum** cookie/rota de API alterado — a demo
anônima e o playground autenticado permanecem intactos. A recusa fica anti-enumerável
(indistinguível entre conta-sem-permissão e e-mail inexistente) e nunca expõe identificador.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16 (App Router); React 19; next-intl (pt-BR + en);
`@clerk/nextjs` ^7.8.1; `@clerk/localizations` ^4.15.6.

**Primary Dependencies**: existentes apenas — `@clerk/nextjs` (`ClerkProvider`, lazy) e
`@clerk/localizations` (`enUS`/`ptBR`). **Nenhuma dependência nova**.

**Storage**: N/A — zero persistência, zero cookie novo.

**Auth / Sessions**: inalterado. Mesmo cookie de sessão do Clerk; override **somente** na tela `/`.

**Testing**: Vitest (unit hermético do override) + Storybook (story de `LoginScreenView` + a11y) +
`pnpm lint`/`format:check`/`typecheck`. **Hermético**: teste unitário sem rede/Clerk; assert de
invariante de privacidade (cópia sem identificador).

**Target Platform**: Web (cliente, tela `/`).

**Performance Goals**: rota `/` sem aumento de bundle (override usa clerk-js já lazy-loaded); sem
pipeline extra. **Nenhum** impacto no budget de JS.

**Constraints**: copy localizada (pt-BR + en) via next-intl; **sem `any`**; **sem** identificar
qualquer string hardcoded; manifesto do ORM/tokens intacto; `format:check` limpo.

**Scale/Scope**: interno/UI; nenhuma superfície nova — escopo restrito a `clerkLocalizationFor` +
testes + story.

## Constitution Check

*GATE — reavaliado após o design. Sem violações permissíveis sem justificativa.*

- **I (Code Quality)**: mudança única e pequena num módulo existente; sem `any`; sem código morto;
  contrato de localização documentado em `contracts/localization-override.md`. ✅
- **II (Testing)**: test-first — teste unitário hermético de `clerkLocalizationFor` (mapping +
  invariante de privacidade); story de login cobre o frame; gates rodados após a última edição. ✅
- **III (UX)**: mensagem localizada, genérica e consistente nas duas línguas; a11y preservada
  (mensagem vem do fluxo do Clerk, sem quebrar contraste/foco); sem regressão no frame login. ✅
- **IV (Performance)**: override não adiciona bundle (reusa clerk-js lazy); rota `/` inalterada. ✅
- **Privacidade (AGENTS / Non-Negotiable)**: override aplicado **somente** na tela `/` autenticada;
  demo (`/`, `/demo`) zero cookies intacta; `no-store` das APIs intacto; cópia sem identificador
  (anti-enumeração). ✅

## Project Structure

### Documentation (this feature)

```text
specs/020-login-access-denied/
├── plan.md                       # Este arquivo
├── research.md                   # R-01..R-04 (override de localização)
├── data-model.md                 # Map de chaves Clerk ↔ cópias do app (sem persistência)
├── quickstart.md                 # Validar o fluxo invite-only + regressões
├── contracts/
│   └── localization-override.md  # Contrato app↔Clerk (mapeamento e regras)
└── tasks.md                      # (/speckit-tasks — não criado por /speckit-plan)
```

### Source Code (repository root)

```text
# Web application — Next.js App Router (frontend, sem backend próprio)
src/
├── i18n/                         # catálogos next-intl (pt-BR + en)
├── features/auth/
│   ├── locales/{pt-BR,en}.json   # login.accessDenied / login.signInError (já presentes; reaproveitadas)
│   ├── client/clerk-localization.ts       # tipo `ClerkLocalization` (inalterado)
│   ├── client/clerk-provider.tsx          # `ClerkProviderGate` (inalterado)
│   ├── components/login-screen-view.tsx   # [EDITAR] clerkLocalizationFor → override unstable__errors
│   └── components/login-screen.stories.tsx# [EDITAR] story login (pt-BR + en) após override
tests/
├── unit/                                # teste hermético do override (novo)
├── component/                           # (conforme padrão do repo)
└── e2e/                                 # (playwright; opcional para este fluxo)
```

**Structure Decision**: mudança pontual no cliente de autenticação já existente, seguindo a
estrutura feature-based do repo (`src/features/auth/`). Nenhuma árvore nova; nada de backend.

## Migration Map

### Remover
- Nada (feature additive).

### Adicionar / Editar
- **Editar** `src/features/auth/components/login-screen-view.tsx`: em `clerkLocalizationFor(locale)`,
  além do override de `signIn.start`, adicionar o **override top-level** de
  `unstable__errors.not_allowed_access` e `unstable__errors.organization_not_found_or_unauthorized`
  → `useTranslations("login")("accessDenied")` (cópias pt-BR/en). Espalhamento **defensivo**
  (spread sobre `base.unstable__errors`) para jamais quebrar se a chave sumir.
- **Novo** teste unitário (hermético) de `clerkLocalizationFor`: mapeia as chaves para
  `accessDenied` nas duas línguas; invariante de privacidade (nenhuma cópia contém
  e-mail/identificador); erro não-permissional NÃO mapeia para `accessDenied`.
- **Editar** `src/features/auth/components/login-screen.stories.tsx`: manter/cobrir o frame em
  pt-BR + en (o override não muda o frame; story já cobre fallback demo). Adicionar assert de
  invariante se conveniente.
- **Editar** locais pt-BR/en apenas **se** a cópia `accessDenied` precisar de ajuste pontual
  (hoje já é genérica e adequada).

## Complexity Tracking

Sem violações da Constitution — coluna não preenchida.

## Risks / Open items

- Chave `unstable__errors.not_allowed_access` do Clerk pode mudar/renomear em versão futura →
  mitigado por spread defensivo + teste unitário que falha se a chave sumir na versão instalada.
- A parcela de **assinatura** recusada por permissão (`organization_not_found_or_unauthorized`)
  depende do Clerk emitir esse erro no fluxo de login; se o Clerk só emitir para organizações, o
  override cobre o caso de assinatura e o `not_allowed_access` cobre o cadastro — ambos mapeados
  para a mesma cópia genérica. Revisar no `tasks.md`.