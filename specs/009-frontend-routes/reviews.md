# Reviews — Spec 009 Frontend Routes

Registro de decisões e estações de revisão da feature. Consistente com
`checklists/requirements.md` e `checklists/ux.md` (fontes de verdade de aceite).

## Estações

### ✅ D1 · `?story=` adiado (spec §11)
- Seleção multihistória **não** aparece na URL nesta entrega; `?story=` é
  rejeitado/adiado para spec §11.
- `/reader` sem `?story=` suportado; conta ativa via `StorySessionContext`.

### ✅ D2 · Sem rota `/export`
- Export de PDF permanece um botão inline no `/reader`
  (`ExportStoryButton`, `@react-pdf/renderer` lazy, fora do bundle inicial).
- Validado no build: rota inicial = **166.1 KiB gzip** (≤250 KiB ✅); o chunk do
  PDF (~474 KiB gz) **não** está entre os scripts da rota `/`.

### ✅ D3 · Fonte única de modo = rota
- `usePathname()` deriva `form`|`reader`; `StoryRequestApp` não recebe prop
  `mode`; event bus (`home-request-event.ts`) removido; `top-nav` navega por
  `router.push("/form")` com `aria-current="page"`.

### ✅ Revisão de gates (re-execução pós-última edição — 2026-08)
- `lint` 0 warnings · `format:check` limpo · `typecheck` green ·
  `test` 649/649 (cobertura 99.03% stmt / 91.45% branch) · `build` green.
- `storybook:test`: **71/71 play-tests**, zero violações a11y. A dívida
  pré-existente (`story-request-form.stories.tsx`, 7 play-tests) foi **paga**
  ao alinhar o ecossistema Storybook em 10.5.8 (`f558d98` — regressão do bump
  de SCA do PR #3 corrigida).
- `test:e2e`: 25 passam; as **5 falhas são pré-existentes de baseline** e não
  relacionadas à 009 (confirmado por stash/no-stash no PR #4):
  - 2 `tests/performance/story-generation-budget.spec.ts` — budgets de LCP/
    geração (host local);
  - 2 `tests/visual/reader.spec.ts` — seletor `getByLabel(/idade/i)` não
    encontra o campo (locale visual vs default `en`);
  - 1 `tests/visual/smoke.spec.ts` — asserção `html[lang='pt-BR']` mas o E2E
    server usa default `en`.

## Pendências (follow-up)
- **Gates de baseline (não bloqueiam a 009):** corrigir os 2 reader-visual e
  1 smoke (locators/locale) e avaliar os 2 perf-budget em CI (host adequado).
- **Spec §11:** `?story=` (deep-link multihistória) quando evoluir.