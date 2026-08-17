# Implementation Plan: Estágios da tela de progresso alinhados ao pipeline multi-agente

**Branch**: `011-progress-stages-alignment` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-progress-stages-alignment/spec.md`

## Summary

A tela de progresso (`StoryGenerationProgress`, §7.3 do spec 001) exibe 3 estágios na ordem
**Writing → Illustrating → Reviewing**, herdada do protótipo blossom (spec 007) — fixada **antes**
do pipeline multi-agente (spec 006). O pipeline real é **Planner → Writer → Moderator → Illustrator**
(`coordinator.ts`): falta o passo de planejamento e a ilustração aparece antes da revisão de
segurança (quando o Illustrator é o **último** estágio, após a aprovação do Moderator).

A correção é **data-driven** e localizada: reordenar/recompor `GENERATION_STAGES` no componente
(`stagePlanning → stageWriting → stageReviewing → stageIllustrating`), adicionar a label
`stagePlanning` em `pt-BR`/`en`, e atualizar stories/tests que fixam a matemática de 3 estágios
(percentuais da barra, boundaries de `getGenerationStage`, `aria-valuemax`, contagem de badges).
Sem mudança em contrato HTTP, backend, privacidade, estados especiais (`timeout`, `safety-retry`,
`provider-failure`) nem timing real de geração — o progresso continua determinístico
(`elapsedSeconds` injetado, fatias iguais de 8 s; último passo inicia em 24 s, abaixo do cue de
timeout em 30 s).

### Decisões de clarificação (incorporadas)

- **Ordem canônica** = `coordinator.ts`/spec 006: Planner → Writer → Moderator → Illustrator. O
  Moderator é o gate sobre a narrativa do Writer (regenera 1× e falha); a ilustração vem por último.
- **Reader fora da tela**: áudio sob demanda via `POST /api/narrate`; não compõe o progresso.
- **Progresso cosmético**: sem telemetria de estágios do servidor; fatias iguais por
  `elapsedSeconds` (o fake mode usa `stepDurationSeconds={3}`, totalizando 12 s com 4 passos).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Node.js 22; Next.js 16 (App Router) + React 19.

**Primary Dependencies**: `next-intl` (catálogos `pt-BR`/`en` — alteração restrita a
`story.progress`), `react` + `next` (componente cliente `'use client'`), `vitest` + Testing Library
(teste unit), Storybook (stories + a11y). Nenhuma dependência nova.

**Storage**: N/A — nada persistente; a mudança não toca payloads, rotas ou cache.

**Testing**: Vitest (unit + contrato i18n) com fakes determinísticos; `storybook:test` para a11y das
stories; gates finais `lint`/`format:check`/`typecheck`/`build`. Nenhum teste chama AI real.

**Target Platform**: Web (client React; componente de status da geração).

**Project Type**: Web application (App Router, Server Components por default; este componente é
`'use client'` porque já era).

**Performance Goals**: sem impacto — nenhum bundle/caminho crítico muda (mesmo componente, 4 labels;
sem novos imports). Budgets existentes (≤250 KiB bundle inicial; geração ≤120 s) não são afetados.

**Constraints**: `POST /api/stories` é o único entry-point server — **inalterado**; `Cache-Control:
no-store` inalterado; nenhum identificador direto em UI/API/logs; todas as strings pelos catálogos
next-intl (novo label obrigatório `stagePlanning` nos dois idiomas); invariantes de privacidade e
segurança (Moderator gate) intactas.

**Scale/Scope**: personal, não-comercial; mudança de exibição + i18n + testes, sem mudança de
backend. Escopo limitado aos 6 arquivos listados na seção Project Structure.

## Constitution Check

*GATE: Must pass before implementation. Re-check after the last edit.*

| Gate (Constitution 1.1.0 / AGENTS.md) | Status | Justificativa |
|----------------------------------------|--------|---------------|
| **Code Quality**: TypeScript strict, sem `any`; lint=0 warnings; format/typecheck no gate | ✅ Passa | Componente data-driven; mudança de array + i18n: sem novos tipos, sem `any`. |
| **Testing**: cobertura ≥80% total (≥90% safety/validation/orchestration não afetada); testes determinísticos | ✅ Passa | Testes atualizados para 4 estágios seguem determinísticos (fakes, sem wall-clock); nenhum teste de safety/orchestration é tocado. |
| **UX & Accessibility**: AA contrast, foco/keyboard, `prefers-reduced-motion`, `aria-live`/`aria-busy` | ✅ Passa | `aria-valuemax` re-deriva (3); badges/labels localizados; `aria-current="step"` mantido; stories + a11y passarão. |
| **Performance**: ≤120 s geração; ≤250 KiB bundle; navegação ≤100 ms | ✅ Passa | Nenhum import novo; mesmo componente; 1 label adicional por catálogo. |
| **Privacy/Anonymity (AGENTS.md)**: nenhum identificador direto; server-only adapters; `no-store` | ✅ Passa | Nenhuma mudança em payloads/rotas/backend; tela continua sem receber conteúdo da história. |
| **Legal/Disclaimer**: manter avisos no README | ✅ Passa | Sem toque em README/avisos. |

*Resultado: nenhuma violação de gate; não há necessidade de Complexity Tracking.*

## Project Structure

### Documentation (this feature)

```text
specs/011-progress-stages-alignment/
├── spec.md              # Created (fase /speckit-specify) — ordem canônica, US, FRs, critérios
├── plan.md              # This file (fase /speckit-plan)
└── tasks.md             # Fase /speckit-tasks (next step)
```

Geração de `research.md`/`data-model.md`/`contracts/` **não se aplica**: a mudança não envolve spike,
modelo de dados ou contrato (o desalinhamento UI×pipeline já está documentado no 006/007; o spec 011
consolida). `quickstart.md` opcional após a implementação (script de verificação rápida).

### Source Code (repository root)

```text
src/features/story-request/
├── components/
│   ├── story-generation-progress.tsx     # ALTERAR — GENERATION_STAGES reordenado (4 passos) + JSDoc/timings
│   └── story-generation-progress.stories.tsx  # ALTERAR — 4 stories (Planning/Writing/Reviewing/Illustrating)
├── locales/
│   ├── pt-BR.json                        # ALTERAR — adicionar story.progress.stagePlanning
│   └── en.json                           # ALTERAR — idem (novo label em inglês)

tests/unit/
├── story-generation-progress.test.tsx    # ALTERAR — matemática 4 estágios, badges, ARIA, percentuais
└── i18n-config.test.ts                   # ALTERAR — assert de stagePlanning (contrato i18n)

# INALTERADOS (fora de escopo)
src/features/story-generation/server/**    # backend/pipeline — intocado
src/app/api/**                             # rotas — intocadas
specs/006-multi-agent-story-generation/    # fonte da ordem canônica (referência, não editar)
specs/007-adopt-blossom-design/            # registro histórico do protótipo (não reescrever)
```

**Structure Decision**: Estrutura unique-project existente mantida. A mudança fica restrita a
`src/features/story-request/` (componente + locales + stories) e `tests/unit/` (2 arquivos). O
componente continua data-driven: adicionar passo futuro = 1 entrada em `GENERATION_STAGES` + 1 chave
i18n — nenhuma lógica de ordenação hardcoded.

## Implementation Approach

TDD por AGENTS.md (test-first). A ordem abaixo garante "red → green" por camada, com o componente
como única fonte da ordem canônica.

1. **Testes de contrato/matemática primeiro (red)**: atualizar `getGenerationStage` (boundaries
   0/8/16/24 s, clamp 24+), `barPercent` (0/25/50/75, done=100), badges (4 itens), ARIA
   (`aria-valuemax=3`) e contrato i18n (`stagePlanning` string) — confirmar que falham com a ordem
   atual.
2. **i18n (green parcial)**: adicionar `stagePlanning` em `pt-BR.json` ("Estruturando sua
   história…") e `en.json` ("Structuring your story…").
3. **Componente (green)**: `GENERATION_STAGES =
   ["stagePlanning","stageWriting","stageReviewing","stageIllustrating"]`; atualizar JSDoc
   (ordem de avanço, "2×8 = 16 s" → "3×8 = 24 s", "three steps" → "four" na doc do prop
   `stepDurationSeconds`). `MAX_STAGE`, ARIA, título adaptativo, barra e `ol` re-derivam sozinhos.
4. **Stories (green)**: 4 stories alinhadas — Planning (0 s), Writing (`STEP_DURATION_SECONDS`),
   Reviewing (`2 * STEP_DURATION_SECONDS`), Illustrating (`LAST_STAGE_AT_SECONDS` = 24 s) +
   comentários de barra atualizados (0/25/50/75). Estados especiais (Timeout/SafetyRetry/
   ProviderFailure) inalterados.
5. **Gates finais (após a ÚLTIMA edição)**: `pnpm lint`, `pnpm format:check` (rodar `pnpm format`
   nos arquivos novos/editados), `pnpm typecheck`, `pnpm test`, `pnpm build`; opcional
   `pnpm storybook:test` (a11y das 4 stories). Resultados obtidos antes da última edição são
   **stale** e não contam.

## Complexity Tracking

> *Nenhuma violação de Constitution Check — tabela não necessária.*