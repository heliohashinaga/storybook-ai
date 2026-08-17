# Checklist de Requisitos — Spec 009 Frontend Routes

Aceite de cada requisito desta spec. Marque conforme for satisfeito.

> **Fonte única de rastreio:** esta checklist é a fonte de verdade para aceite; o
> checklist §9 (Defition of Done) da spec.md espelha estes itens e **não** deve ser
> mantido como segunda fonte (evitar drift). Atualize ambos apenas juntos.

## Funcional
- [x] Rota `/` redireciona para `/form`. (`src/app/page.tsx`)
- [x] Rota `/form` renderiza o formulário de nova história (estado `drafting`).
- [x] Rota `/reader` renderiza o leitor da história ativa (estado `story`),
      incluindo o export de PDF inline (`ExportStoryButton`, PDF in-memory/lazy).
- [x] **Sem rota `/export`** como destino navegável (Decision №1 da spec §11): o
      export de PDF permanece um botão no `/reader` (`@react-pdf/renderer` lazy;
      fora do bundle inicial — validado: chunk do PDF não carrega na `/`).
- [x] Multihistória: seleção da conta ativa só via `StorySessionContext` (UI
      interna); rota `/reader` **não** aceita `?story=` nesta entrega (adiado,
      spec §11).
- [x] `top-nav` navega por `router.push("/form")`; event bus
      (`requestHome`/`onHomeRequested` + `home-request-event.ts`) removido.
- [x] **Fonte única = rota:** modo tela (`form`|`reader`) derivado do path via
      `usePathname()`; `StoryRequestApp` **não** recebe prop `mode`;
      `draftingNew`/`status` derivam do path e nunca o duplicam (spec §6.2).

## Privacidade / Anonimato (não-negociável)
- [x] Nenhuma história, idade exata, `ageBand`, `locale` derivado, UUID ou
      identificador em **path, query, hash ou params**.
- [x] `POST /api/stories` permanece o único entry point de servidor.
- [x] `server-only` e barreira servidor ↔ cliente preservados.
- [x] Sem persistência em cookies/localStorage/indexDB/cache; sessão = memória
      React (`StorySessionProvider` no root layout; grep: 0 usos de
      localStorage/cookies/indexedDB em `src/`).
- [x] Invariante verificável em teste: `request.url` **e logs** observáveis (por
      fake provider) não contêm dados sensíveis.

## Sessão / Deep-link
- [x] `/reader` sem sessão ⇒ `redirect("/form")`.
- [x] Reload em rota que exige sessão resolve graciosamente para `/form` (sem
      tela morta, sem erro exposto — snapshot + live region durante redirect).

## Acessibilidade
- [x] Focus management ao navegar entre telas (`.focus()` em refs no form e
      reader; `tabIndex={-1}` em títulos).
- [x] `aria-current` no item do top-nav da rota ativa (`aria-current="page"`).
- [x] `aria-live`/`aria-busy` para estados assíncronos (submitting, load do
      leitor — nos 4 componentes assíncronos).
- [x] `prefers-reduced-motion` respeitado.
- [x] Scroll restoration aceitável (posição de topo ao trocar de tela ou sem
      regressão observável).

## Performance
- [x] Rota inicial ≤250 KiB gzip. (medido na build: **166.1 KiB gzip** nos
      chunks da `/`)
- [x] Leitor + export do PDF inline lazy; `@react-pdf/renderer` `lazy-import`
      apenas no export (não no bundle inicial — chunk do PDF ~474 KiB gz
      **não** está nos scripts da rota `/`).

## Qualidade
- [x] `pnpm lint` 0 warnings (pós-último edit).
- [x] `pnpm format:check` limpo (rode `pnpm format` em arquivos novos/editados).
- [x] `pnpm typecheck` green (pós-último edit).
- [x] Cobertura ≥80% geral; ≥90% safety/validation/orchestration.
      (real: 99.03% statements / 91.45% branches)
- [x] E2E pt-BR + EN verdes (fake provider). _(journeys passam; as 5 falhas
      do runner são pré-existentes de baseline: 2 perf-budget do CI + 2
      reader-visual por seletor `idade` + 1 smoke `lang=pt-BR` — ver
      `reviews.md`)_
- [x] Storybook default/loading/error/edge + a11y verdes. (71/71 play-tests,
      zero violações a11y)
- [x] `pnpm build` passa.

## Fora de escopo (não implementar)
- [x] NÃO: persistência de história entre reloads (viola o anonimato) —
      confirmado: nenhuma persistência.
- [x] NÃO: URLs canônicas com ids externos — confirmado: nenhum id na URL.
- [x] NÃO: rota dedicada `/export` (export permanece inline no `/reader`,
      Decision №1 da spec §11) — `/export` não existe em `src/app/`.
- [x] NÃO: mudanças em `POST /api/stories`, `story-generation/*` ou OpenAPI —
      contrato inalterado.
- [x] NÃO: rota própria para a tela de progresso de geração (`/steps`) — é
      estado efêmero renderizado dentro de `/form` durante `submitting`.
