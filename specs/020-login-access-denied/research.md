# Research: Mensagem de acesso negado no login (Clerk invite-only)

**Feature**: [spec.md](spec.md) | **Branch**: `feature/020-login-access-denied`

## Objetivo

Resolver as incógnitas do plano: **como** surfacing a recusa de acesso de um usuário não autorizado
(cadastro _invite-only_ recusado) na tela de login, **reaproveitando** as strings localizadas
`accessDenied`/`signInError` já existentes em `src/features/auth/locales`, sem comprometer a
privacidade (anti-enumeração), a demo anônima (zero cookies) nem o orçamento de bundle.

## Decisões (R-NN)

### R-01 — O mecanismo é um **override da tela `signUp.restrictedAccess`**, não um banner custom

- O `ClerkProvider` já recebe `localization` (`enUS`/`ptBR` de `@clerk/localizations`,
  resolvidos em `clerkLocalizationFor(locale)`, `src/features/auth/components/login-screen-view.tsx`).
- O Clerk, em modo **restricted/invite-only**, recusa cadastro de não-convidado exibindo uma **tela
  terminal "Restricted access"**, cuja cópia vem da chave **`signUp.restrictedAccess`** (title /
  subtitle / actionLink). Confirmado no pacote instalado (`@clerk/localizations` 4.15.6), **linha
  1487 em `pt-BR.mjs` e `en-US.mjs`**, aninhada em `signUp`:
  - `pt-BR.title`: "Acesso restrito" | `subtitle`: "Cadastros estão desabilitados no momento. ...".
  - `en-US.title`: "Access restricted" | `subtitle`: "Sign ups are currently disabled. ...".
- **Validação externa (Clerk docs)**: a chave `unstable__errors.not_allowed_access` (removida dos
  arquivos `en_*` — PR clerk#5701) é o caso de bloqueio por **domínio/e-mail** (allowlist paga),
  **não** o fluxo invite-only. A doc oficial (`customization/localization`) referencia
  `unstable__errors` essencialmente para erros de domínio; a tela de sign-up restrito usa
  `signUp.restrictedAccess` (PRs clerk#4220/#4335 "Render Restricted access screen").
- **Decisão**: estender `clerkLocalizationFor`/`buildClerkLocalization` para sobrescrever
  **`signUp.restrictedAccess.title`** com a cópia localizada do app (`t("accessDenied")`) — e, se
  desejado, `signUp.restrictedAccess.subtitle` (default já localizado/genérico via ptBR/enUS
  permanece aceitável). **Nenhum** componente/banner novo, **nenhum** bundle novo, **nenhum** cookie
  novo.
- **Alternativa rejeitada**: um componente React custom (hook `useSignUp`/eventos do clerk-js) para
  renderizar um banner próprio com `accessDenied`. É mais complexo, depende de APIs internas do
  clerk-js (frágil), adiciona estado/lógica cliente sem ganho — o override de localização atinge o
  mesmo resultado (mensagem localizada do app na tela de acesso restrito) com fração do código.

### R-02 — Anti-enumeração (US2) via **default genérico do Clerk** (sem override)

- Erros de assinatura do Clerk para credenciais erradas/inexistentes já são **genéricos** (não
  revelam se o e-mail existe). Em modo **invite-only** (sem organizações), não há erro específico de
  "assinatura de conta revogada" — um convidado existente continua podendo entrar; quem não é
  convidado nem tem conta simplesmente nunca cria sessão. **Nenhum override** de chave de assinatura
  é necessário nem desejado.
- 🔁 **Correção de escopo**: a chave `unstable__errors.organization_not_found_or_unauthorized` é
  **específica de organizações** — este app **não** usa organizações (spec 018: sem roles/groups),
  portanto **fora de escopo**. Removida do plano. A neutralidade (anti-enumeração) é garantida
  simplesmente **não tocando** os erros de assinatura do Clerk.
- **Invariante de privacidade**: a cópia do app (`accessDenied`/`signInError`) **não contém**
  identificador (e-mail/nome/id); o override fica restrito a `signUp.restrictedAccess` — atendido e
  assertado por teste (as demais chaves de erro permanecem intactas).

### R-03 — Erro transiente/diferente ≠ acesso negado

- Para falhas não relacionadas a permissão (rede, credenciais erradas, captcha) o usuário vê a
  mensagem genérica de `signInError` / default do Clerk. O override de `signUp.restrictedAccess` se
  limita **estritamente** à tela de recusa por permissão, para não desenhar "acesso negado" em
  erros de onde não há.

### R-04 — Demo anônima e bundle inalterados

- O override vive em `clerkLocalizationFor` — código **cliente já existente** carregado na tela `/`.
  Não toca `(playground)/layout`, `/demo`, `/form`, `/reader` nem as rotas de API. `/demo` continua
  sem cookie/identidade (spec 018 / ADR 0013).
- O Clerk (`clerk-js`) já é lazy-loaded; o override **não** acrescenta cliente novo → orçamento de
  JS da rota `/` preservado.

## Fatos verificados no repositório

- `clerkLocalizationFor` atualmente só sobrescreve `signIn.start.title/subtitle` (blank) —
  o padrão para adicionar o override de `signUp.restrictedAccess` já existe.
- Chaves `accessDenied`/"Esta conta não pode entrar aqui." e `signInError`/"Não deu para entrar..."
  existem em `src/features/auth/locales/{pt-BR,en}.json`, **desde a spec 015** (removida allowlist,
  mas as strings permaneceram) e hoje estão **sem uso** — elegível para reaproveitamento.
- Não há testes de auth/login existentes; há story de `LoginScreenView`
  (`login-screen.stories.tsx`) cobrindo o frame (nenhuma chave Clerk em Storybook → fallback demo).

## Riscos e mitigação

- **Risco**: Clerk pode alterar/renomear `signUp.restrictedAccess` em versões futuras.
  **Mitigação**: spread defensivo sobre o base (nunca quebrar se a chave sumir) + um teste
  unitário que pina a chave e falha se ela deixar de existir na versão instalada (T002/T003).
- **Risco**: sobrescrever a chave pode esconder contexto útil (motivo da recusa).
  **Mitigação**: a cópia do app é genérica de propósito (requisito FR-002/anti-enumeração); é a
  decisão de privacidade do dono; o `subtitle` default do Clerk (já localizado) é preservado.

## Referências

- Validação externa: Clerk docs `customization/localization` (Localization prop; `signUp`
  `restrictedAccess`); PRs clerk/javascript #4220/#4335 (tela "Restricted access"), #5701
  (remoção de `not_allowed_access` em `en_*`), #9600 (`actionBlocked` — só em versões mais novas).
- Clerk localization structure: `node_modules/@clerk/localizations/dist/pt-BR.mjs` / `en-US.mjs`
  (chave `signUp.restrictedAccess`, dentro de `signUp`).