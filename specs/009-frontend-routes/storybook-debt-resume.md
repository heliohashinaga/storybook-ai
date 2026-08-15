# Retomada — Dívida pré-existente: `story-request-form.stories.tsx`

> Escrito em 2026-08-15, ao fim da implementação da Spec 009 Frontend Routes.
> Objetivo: instruir uma NOVA sessão (com contexto limpo) a corrigir esta dívida
> pré-existente de teste sem o viés de contexto da sessão anterior.

## Contexto (estado pré-existente, NÃO relacionado à Spec 009)
- Branch: `009-frontend-routes`, working tree limpa, HEAD = `c08023a`.
- A Spec 009 (rotas `/form`+`/reader`, modo derivado do path, `replace`, session
  gateway, `StorySessionProvider` no layout) está **completa** e todos os seus
  gráficos verificados (lint/format/typecheck, 540 testes, 12 E2E, build).
- **`story-request-form.stories.tsx` NÃO foi tocado pela Spec 009** (git diff vazio
  nos commits `93539a0`/`2dffad7`/`c08023a`). É dívida pré-existente.

## O problema
`pnpm storybook:test` falha em **7 play-tests** de `story-request-form.stories.tsx`:
- Loading, SafeRetry, RateLimit, Success, EnDefault, EnLoading, EnSafeRetry.
- Erro: `asyncGeneratorStep ... story-request-form.stories.tsx:3:28` — este é o
  **polyfill de async** (compartilhado), NÃO o local real do bug. Não confie nele.
- As falhas aparecem como "● Console" — um ERRO JS lançado DENTRO das async play
  functions, não uma asserção falhada.

## O que já foi descartado (NÃO tente de novo)
- **Envolver `fireEvent.change` em `await act(...)` NÃO resolve** (testado e
  revertido). A causa não é warning de `act()`/React 19.
- **O polyfill `asyncGeneratorStep` NÃO é o bug** — é frame compartilhado de
  async que apenas PRECEDE o erro real no console.

## Como o arquivo está estruturado (onde procurar)
- Helpers `fillAgeAndSubmit` (~linha 43-48) e `fillEn` (~127-132): usam
  `fireEvent.change(age slider)` + `await userEvent.click(...)`.
- As play functions das 7 stories que falham chamam esses helpers.
- O arquivo tem ~490+ linhas; as linhas de falha no output (146, 202, 258, ...)
  são **colunas compiladas**, podem não mapear 1:1 para o código-fonte.

## Como diagnosticar corretamente (contexto limpo)
1. Garantir `pnpm build` OK e subir Storybook: `npx storybook dev -p 6006`.
2. Rodar APENAS o form:
   `STORIES_TEST_MODE=fake sh scripts/run-with-chromium.sh ./node_modules/.bin/test-storybook --url http://127.0.0.1:6006 --maxWorkers=1 --testTimeout=60000`
   e capturar o BLOCO DE ERRO COMPLETO de uma failing story (ex. Loading) — ler o
   texto EXATO do `Error:` abaixo do `● ... › play-test`.
3. O erro real é o que está depois do `asyncGeneratorStep` frame — procurar a
   mensagem (ex. "Unable to find element", "Element is not found", um `throw`,
   um `Console.error`, ou um `expect` que lança).
   **CAUSA RAIZ ** (2026-08-15): Não é um `throw` isolado — é
   `Found multiple elements with the text of: /idade/i`. Os helpers usavam
   `getByLabelText(/idade|age/i)`, mas essas regexes agora casam VÁRIOS
   elementos: o slider de idade (`aria-label="Idade"`) E outros rótulos que
   contêm a substring, ex. "Quantidade de cenas" (contém "idade") no campo
   de cenas, e "Language" (contém "age") no campo de idioma. Queries by-
   label demasiado frouxas → `getBy*`/`queryBy*` lançam em múltiplas ocorrências.
4. Corrigir pontualmente na play function/helper que lança. Não mexer em outras
   partes. Rodar de novo até `storybook:test` 100% verde (junto com o resto).

## Critérios de aceite (para encerrar)
- `pnpm storybook:test` → **Test Suites: 0 failed** (verde).
- Manter `story-reader.stories.tsx` fix (já commitado em `c08023a`).
- Não regredir os gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`.
- Push/commit da correção com Conventional Commit + gitmoji `:bug:`.

## NOTA de arquitetura (para não refazer)
- A Spec 009 NÃO introduziu regressão no Storybook (minha `story-request-app.stories.tsx`
  passa). A dívida é 100% pré-existente em `story-request-form.stories.tsx`.

## Resolução (aplicada em 2026-08-15)
- **Fix aplicado** em `story-request-form.stories.tsx` (helpers e play do `EnDefault`):
  trocar as queries frouxas por `getByRole("slider")` /
  `getByRole("slider", { name: /age/i })`. O slider de idade é o único `role="slider"`
  do form, então `getByRole("slider")` é único e independente de locale/texto.
  Mantido `queryByLabelText(/idade/i)` no `EnDefault` apenas como check de ausência
  de português (em EN não há multi-match para "idade").
- **Verificação**: `pnpm storybook:test` → **Test Suites: 15 passed, 71 tests passed**.
  Gates limpos: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.
- **Lição**: `getByLabelText(/.../i)` com regex é frágil quando outros rótulos
  contêm a substring. Preferir query por `role` (semântico/único) + `name` exato.
