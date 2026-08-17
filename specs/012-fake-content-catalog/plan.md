# Implementation Plan: Catálogo fake de histórias e ilustrações gerado pelo provider real

**Branch**: `012-fake-content-catalog` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-fake-content-catalog/spec.md`

## Summary

O modo fake (`STORIES_TEST_MODE=fake`) hoje devolve histórias genéricas (mesma ossatura
"estrelinha + conchinha" para os 6 temas) e **uma única** ilustração 64×64 WebP repetida em toda
cena. Esta feature captura **uma vez** o conteúdo real (providers do env: DeepSeek p/ textos,
seedream p/ imagens), comprime as ilustrações com sharp e grava um **catálogo determinístico** em
fixtures; o runtime fake passa a resolver `(locale, theme, sceneCount)` nesse catálogo com
**fallback** para a fixture virtual `generic` e o builder genérico manual (política tolerante —
zero regressão na suíte existente).

**Decisões de clarificação (confirmadas na sessão)**:

- **Grid**: 36 (6 temas × 2 locais × 3/4/5 cenas) + 6 genéricas de fallback (`generic`).
- **Ilustrações**: capturar com seedream e re-comprimir (512×512 WebP q70, budget/cena 60 KB,
  orçamento total 8 MB).
- **Custo/risco**: ~42 chamadas de texto + ~162 imagens, ~15–40 min (paralelismo ~3), peso
  ~3–6 MB no repo. CI não roda captura; fixtures commitadas.
- **Novos temas (política tolerante)**: fallback **neutro de qualidade** — tema fora do catálogo
  resolve para a fixture `generic`; se ausente/corrompida, builder genérico manual (substitui o
  `?? THEME_PT.courage` atual); adicionar tema ao enum/form nunca exibe conteúdo de outro tema;
  captura seletiva via `--themes` é opcional.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Node.js 22; Next.js 16 (App Router) + React 19;
runtime server-only (`server-only` import) — o fake e o script nunca tocam o client.

**Primary Dependencies**: `openai`/`openrouter` (providers reais já wireados em
`generation-runtime.ts`), `sharp` (já é dependência — compressão WebP), `zod` (validação do shape
das fixtures no teste). Nenhuma dependência nova.

**Storage**: fixtures estáticas em `tests/fixtures/story-generation/fake-content/*.json` (lidas via
`fs` puro, determinísticas). Nenhum storage durável de runtime; nenhuma rota HTTP muda.

**Testing**: Vitest (unit: catálogo, fallback, anonimato, budget, paridade; contrato i18n
intocado) + suíte existente (650 testes) e `storybook:test` como regressão. Nenhum teste chama AI
real — fixtures commitadas fornecem o conteúdo.

**Target Platform**: servidor Node (providers + fake); Web client indiferente (a mudança é
server-only).

**Project Type**: Web application (App Router); tooling de dev ops (script de captura) no mesmo
repo como `scripts/`.

**Performance Goals**: a captura não roda no fluxo de produção; o fake permanece determinístico e
**sem rede**. Tamanho: orçamento total de fixtures ≤ 8 MB (default) para não inflar checkout/CI;
leitura das fixtures é single-pass e cacheável em módulo (nada por request).

**Constraints**: rotas HTTP (`/api/stories`, `/api/narrate`), contrato OpenAPI, payloads, timing
real de geração e estados de progresso **intocados**; nenhum identificador direto (invariante);
Captura nunca persiste output reprovado pelo Moderator (spec 006 US2); CI nunca captura.

**Scale/Scope**: pessoal, não-comercial; escopo serivor (script + fixtures + fake provider) e
testes; zero mudança de UI/bundle client.

## Constitution Check

*GATE: Must pass before implementation. Re-check after the last edit.*

| Gate (Constitution 1.1.0 / AGENTS.md) | Status | Justificativa |
|----------------------------------------|--------|---------------|
| **Code Quality**: TS strict, sem `any`; lint=0; format/typecheck no gate | ✅ Passa | Script + lookups tipados; fixtures com Zod; sem `any`. |
| **Testing**: ≥80% total; ≥90% safety/validation/orchestration (intactos) | ✅ Passa | Testes novos (catálogo/fallback/anonimato/budget/paridade) somam cobertura; nenhum teste de safety é alterado. |
| **UX & Accessibility**: AA, a11y, reduced-motion, aria-live | ✅ Passa | Nenhuma mudança de UI; Storybook mantém comportamento (conteúdo fake só muda sob o grid, com fallback). |
| **Performance**: ≤120 s geração real; ≤250 KiB bundle; navegação ≤100 ms | ✅ Passa | Fake continua offline/determinístico; zero impacto em bundle/página (server-only). |
| **Privacy/Anonymity**: nenhum identificador; server-only adapters; `no-store` | ✅ Passa | Captura anônima por construção + teste de anonimato nas fixtures; nada sai do servidor. |
| **Legal/Disclaimer**: manter avisos README | ✅ Passa | Sem toque em README/disclaimer; conteúdo de exemplo anônimo. |

*Resultado: nenhuma violação de gate; sem necessidade de Complexity Tracking.*

## Project Structure

### Documentation (this feature)

```text
specs/012-fake-content-catalog/
├── spec.md              # Created (fase /speckit-specify) — grid, US, FRs, critérios
├── plan.md              # This file (fase /speckit-plan)
└── tasks.md             # Fase /speckit-tasks
```

`quickstart.md` será adicionado após a implementação (como rodar dry-run e captura); não há
`data-model.md`/`contracts/` (sem modelo de dados novo nem mudança de contrato).

### Source Code (repository root)

```text
scripts/
└── generate-fake-content.ts        # NOVO — captura dev server-only (flags: --dry-run, --limit,
                                    #          --locales, --themes, --counts; budget env)

tests/fixtures/story-generation/
├── fake-content/                    # NOVO — catálogo {theme}-{locale}-{sceneCount}.json
│   └── README.md                    # NOVO — formato do fixture + como re-capturar
└── provider-fixtures.ts             # referencia catálogo (sem mudança obrigatória)

src/features/story-generation/server/
├── fixed-dev-provider.ts            # ALTERAR — lookup (locale,theme,sceneCount) + fallback
                                    #           (FR-004); ilustração por cena (FR-005)
└── fake-content-catalog.ts          # NOVO — loader tipado das fixtures (Zod) + cache módulo

tests/
└── unit/
    └── fake-content-catalog.test.tsx # NOVO — variedade, paridade, anonimato, fallback,
                                      #        budget, determinismo

# INALTERADOS (fora de escopo)
src/app/api/**                       # rotas — intocadas
generation-runtime.ts                # seleção fake/produção — intocada (lookup fica no provider)
src/features/story-generation/server/agents/**  # pipeline — intocado
src/features/story-request/**        # UI/progresso — intocada
specs/011-progress-stages-alignment/ # feature anterior — intocada
```

**Structure Decision**: o loader (`fake-content-catalog.ts`) centraliza leitura+validação Zod das
fixtures (uma vez por processo, cache de módulo); `fixed-dev-provider.ts` apenas resolve; o script
de captura não depende de UI/_http_ (usa o runtime real diretamente). Fallback por contrato:
qualquer erro de resolução ⇒ caminho atual (builder/`FIXED_ILLUSTRATION_DATA_URI`).

## Implementation Approach

Ordem de execução (com gate de confirmação do usuário antes da captura paga):

1. **Fase 0 — Ferramenta (sem rede)**: scaffold `scripts/generate-fake-content.ts` com grid
   default, flags e `--dry-run` (imprime plano + orçamento estimado, valida shape do runtime real
   via zod _sem_ chamar provider). Roda `--dry-run` e confere saída.
2. **Fase 1 — Captura (env real confirmado na clarificação)**: rodar o script com o grid
   42 completo (36 do enum + 6 genéricas). Garantias no script: Moderator real valida cada narrativa (rejeição ⇒ descarta +
   contabiliza; recidiva ⇒ falha com resumo); anonimato verificado antes de gravar; WebP
   re-comprimida (512×512 q70) e auditada (budget/cena + total). Também roda com paralelismo ~3 e
   timeouts do env (`MODEL_TIMEOUT_MS`).
3. **Fase 2 — Integração**: `fake-content-catalog.ts` (loader + Zod + cache) e lookup no
   `fixed-dev-provider.ts` (história e ilustração por cena), ambos com fallback **neutro**
   (tema fora do catálogo → fixture `generic` → builder genérico manual, substituindo o
   `?? THEME_PT[\"courage\"]`/`?? THEME_EN[\"courage\"]` atual).
4. **Fase 3 — Testes**: unit do catálogo (US1–US4) + regressão da suíte completa.
5. **Fase 4 — Gates finais (após a ÚLTIMA edição)**: `pnpm lint`, `pnpm format:check` (format nos
   arquivos novos/editados, incl. `.md` do spec), `pnpm typecheck`, `pnpm test`, `pnpm build`.
   Resultados anteriores são **stale** e não contam.

## Complexity Tracking

> *Nenhuma violação de Constitution Check — tabela não necessária.*