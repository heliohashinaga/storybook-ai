# Research: Mensagem de acesso negado no login (Clerk invite-only)

**Feature**: [spec.md](spec.md) | **Branch**: `feature/020-login-access-denied`

## Objetivo

Resolver as incógnitas do plano: **como** surfacing a recusa de acesso de um usuário não autorizado
(cadastro _invite-only_ recusado) na tela de login, **reaproveitando** as strings localizadas
`accessDenied`/`signInError` já existentes em `src/features/auth/locales`, sem comprometer a
privacidade (anti-enumeração), a demo anônima (zero cookies) nem o orçamento de bundle.

## Decisões (R-NN)

### R-01 — O mecanismo é um **override de localização do Clerk**, não um banner custom

- O `ClerkProvider` já recebe `localization` (`enUS`/`ptBR` de `@clerk/localizations`,
  resolvidos em `clerkLocalizationFor(locale)`, `src/features/auth/components/login-screen-view.tsx`).
- O Clerk, em modo **restricted/invite-only**, recusa cadastro de não-convidado e exibe a mensagem
  localizada da chave **`unstable__errors.not_allowed_access`** dentro do próprio fluxo do
  `<SignIn>`/`<SignUp>`. Confirmado no pacote instalado:
  - `pt-BR`: `not_allowed_access: "O endereço de e-mail ou número de telefone não é permitido para registro. ..."` (linha 1665 de `@clerk/localizations/dist/pt-BR.mjs`, nível **topo** da
    `LocalizationResource`, **não** aninhada em `signUp`).
  - `en-US`: `not_allowed_access: void 0` (linha 1665) — default inglês do Clerk.
- **Decisão**: estender `clerkLocalizationFor` para sobrescrever `unstable__errors.not_allowed_access`
  (recusa de cadastro) com a cópia localizada do app (`t("accessDenied")`, próximo da string que
  o domínio recebe). **Nenhum** componente/banner novo, **nenhum** bundle novo, **nenhum** cookie novo.
- **Alternativa rejeitada**: um componente React custom (hook `useSignUp`/eventos do clerk-js) para
  renderizar um banner próprio com `accessDenied`. É mais complexo, depende de APIs internas do
  clerk-js (frágil), adiciona estado/lógica cliente sem ganho — o override de localização atinge o
  mesmo resultado (mensagem localizada do app no lugar da recusa) com fração do código.

### R-02 — Anti-enumeração (US2) é satisfeita pelo **default genérico** do Clerk + cópia do app

- Erros de assinatura do Clerk para credenciais erradas/inexistentes já são **genéricos** (não
  revelam se o e-mail existe). Não há mudança necessária para US2 no que se refere a não vazar o
  identificador.
- Para o caso de uma conta **sem permissão** na assinatura, sobrescreve-se também as chaves
  genéricas de `unstable__errors` que mapeiam "usuário não autorizado" (`organization_not_found_or_unauthorized`)
  com a mesma cópia genérica `accessDenied` — a mensagem final é **neutra/indistinguível** para
  conta existente-sem-permissão vs e-mail inexistente.
- **Invariante de privacidade**: a cópia do app (`accessDenied`/`signInError`) **não contém**
  identificador (e-mail/nome/id) — atendido e assertado por teste.

### R-03 — Erro transiente/diferente ≠ acesso negado

- Para falhas não relacionadas a permissão (rede, credenciais erradas, captcha) o usuário vê a
  mensagem genérica de `signInError` / default do Clerk. O override de `not_allowed_access` se limita
  **estritamente** à recusa por permissão, para não desenhar "acesso negado" em erros de onde não há.

### R-04 — Demo anônima e bundle inalterados

- O override vive em `clerkLocalizationFor` — código **cliente já existente** carregado na tela `/`.
  Não toca `(playground)/layout`, `/demo`, `/form`, `/reader` nem as rotas de API. `/demo` continua
  sem cookie/identidade (spec 018 / ADR 0013).
- O Clerk (`clerk-js`) já é lazy-loaded; o override **não** acrescenta cliente novo → orçamento de
  JS da rota `/` preservado.

## Fatos verificados no repositório

- `clerkLocalizationFor` atualmente só sobrescreve `signIn.start.title/subtitle` (blank) —
  o padrão para adicionar o override de `unstable__errors` já existe.
- Chaves `accessDenied`/"Esta conta não pode entrar aqui." e `signInError`/"Não deu para entrar..."
  existem em `src/features/auth/locales/{pt-BR,en}.json`, **desde a spec 015** (removida allowlist,
  mas as strings permaneceram) e hoje estão **sem uso** — elegível para reaproveitamento.
- Não há testes de auth/login existentes; há story de `LoginScreenView`
  (`login-screen.stories.tsx`) cobrindo o frame (nenhuma chave Clerk em Storybook → fallback demo).

## Riscos e mitigação

- **Risco**: Clerk pode alterar a key `unstable__errors.not_allowed_access` em versões futuras.
  **Mitigação**: espalhe defensivamente sobre o base (nunca quebrar se a chave sumir) + um teste
  unitário que pin [o shape] e falhe se a chave deixar de existir na versão instalada.
- **Risco**: sobrescrever a chave pode esconder contexto útil (motivo da recusa).
  **Mitigação**: a cópia do app é genérica de propósito (requisito FR-002/anti-enumeração); é a
  decisão de privacidade do dono.

## Referências

- Clerk localization structure: `node_modules/@clerk/localizations/dist/pt-BR.mjs` / `en-US.mjs`
  (chave `unstable__errors.not_allowed_access`, nível topo).