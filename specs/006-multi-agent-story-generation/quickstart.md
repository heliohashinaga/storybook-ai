# Quickstart — Validação end-to-end do pipeline multi-agente

**Phase 1 output** — guia de validação. Detalhes de implementação estão em `tasks.md` e em
`contracts/agent-pipeline.md` / `data-model.md` (não duplicados aqui).

## Pré-requisitos

- Node.js 20+ + pnpm (`corepack`).
- Repo clonado em `006-multi-agent-story-generation` com deps instaladas (`pnpm install`).
- Opcional: dependências nativas de Chromium para testes de navegador
  (ver AGENTS.md → `.playwright-deps` / scripts).
- **Never** credenciais reais em `.env.local` versionada; provas via fakes determinísticos.

## Modo de teste (sem AI real)

```bash
STORIES_TEST_MODE=fake pnpm dev     # ou variável via .env.local de dev, nunca commitada
```

Nesse modo o `generation-runtime` usa **adaptadores fake determinísticos** (fixed-dev e TTS fake),
sem chamar nenhum provedor de IA. É o único modo usado em `pnpm test`/E2E.

## Cenários de validação acionáveis

### 1. Pipeline multi-agente funciona (US1) — provar que cada role executa e o resultado é completo

```bash
STORIES_TEST_MODE=fake pnpm test -- story-generation/server/agents
# ou, no app:
# POST /api/stories com {ageBand, locale, theme} e número de cenas (3..5)
pnpm exec vitest run --pool threads --maxWorkers 2 2>/dev/null   # se forks worker falhar (host limitado)
```

**Esperado**: Planner→Writer→Reviewer→Illustrator executam em ordem; resultado é um
`GeneratedStory` completo (narrativa + todas as ilustrações em cada cena); cada agente produziu sua
saída (outline, narrativa, aprovação, prompts/imagens). Nunca `GeneratedStory` parcial no sucesso.

### 2. Reader entrega áudio sob demanda (SC-009/SC-010) — provar payload sem áudio e áudio via endpoint

```bash
# com AI_NARRATION_ENABLED=true e STORIES_TEST_MODE=fake:
# 1) POST /api/stories → verificar que GeneratedStory NÃO contém blob/base64 de áudio
# 2) POST /api/narrate {texto, locale} → obter áudio por cena (reuso do endpoint existente; a chamada
#    passa o texto localizado da cena — não há nova rota dedicada; ver FR-005-b)
pnpm exec vitest run src/features/story-read-aloud
```

**Esperado**: `GeneratedStory` sem áudio embutido (SC-006/SC-010); cada cena pode obter narração via
`/api/narrate`; com `AI_NARRATION_ENABLED=false` cai para fallback Web Speech/desligado do
`004-ai-natural-tts`. Narração parcial nunca é "sucesso" no contexto da história.

### 3. Reviewer é gate autoritativo (US2) — segurança/anonimato

```bash
# Fakes configurados: writer devolve candidato inseguro → bloqueado; regenera 1x; 2ª insegura → erro seguro
pnpm exec vitest run src/features/story-generation/server/safety-pipeline   # + agentes/reviewer
```

**Esperado**: nada inseguro retorna/loga; regeneração única com restrições mais fortes; erro seguro,
genérico e localizado se persistir; nenhum identificador direto em payload/logs/provider fakes
(testados por invariante de privacidade).

### 4. Retry e paralelização (FR-006-b / US4) — latência e robustez

```bash
pnpm exec vitest run src/features/story-generation/server/agents/coordinator
# com instrumentação de tempo do fake: confirmar dependências e ≤120s ponta-a-ponta
```

**Esperado**: falha transiente vira retry (default `maxAttempts=2`); esgotado → erro tipado por
estágio; Illustrator ∥ Reader só após aprovação; serial baseline garantido; dentro do budget.

### 5. Regressão do contrato externo (SC-006)

```bash
pnpm test          # suite completa (unit/contrato/pipeline) — fixtures existentes de GeneratedStory passam
pnpm lint && pnpm format:check && pnpm typecheck
```

**Esperado**: nenhum teste, fixture ou leitor de exportação existente regride; `POST /api/stories`
continua `no-store` e é o único entry-point de geração.

## Rodando a suite de qualidade completa

```bash
pnpm test            # Vitest (fakes)  — mas se falhar por worker, use pnpm test:limited
pnpm lint            # 0 warnings
pnpm format:check    # sem drift (rode pnpm format se editar arquivos)
pnpm typecheck       # strict TS, sem `any` novo
pnpm storybook:test  # stories default/loading/error/edge + a11y (Chromium deps)
pnpm test:visual && pnpm test:performance   # regressão visual e budgets
```

## Critério de aceite mínimo (Definição de Pronto)

- Todos os cenários 1–5 passam com fakes.
- Gates de qualidade (`lint`/`format:check`/`typecheck`) re-rodados APÓS a última edição.
- Cobertura ≥80% total, ≥90% safety/validation/orchestration.
- Nenhum identificador direto em payload/logs/storage/reinfra de teste.
- Contrato externo inalterado; stories + a11y passam; Storybook bate com o app.
