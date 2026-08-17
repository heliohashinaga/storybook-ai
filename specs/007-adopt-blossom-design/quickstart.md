# Quickstart — Validação da identidade visual e da expansão de temas

**Phase 1 output** — guia de validação acionável. Detalhes de implementação ficam em `tasks.md`;
contratos e entidades em `contracts/design-tokens-and-themes.md`, `contracts/design-system.md` e `data-model.md` (não duplicados
aqui).

## Pré-requisitos

- Node.js 20+ + pnpm (`corepack`), deps instaladas (`pnpm install`).
- Opcional: deps nativas de Chromium para testes de navegador (AGENTS.md → `.playwright-deps`).
- **Nunca** credenciais reais em `.env.local` versionada; provas via fakes determinísticos.

## Modo de teste (sem AI real)

```bash
STORIES_TEST_MODE=fake pnpm dev     # adaptadores fake determinísticos (fixed-dev providor/TTS)
```

É o único modo usado em `pnpm test`/E2E/visual; nenhum provedor real é chamado.

## Cenários de validação acionáveis

### 1. Identidade visual aplicada em todas as telas (SC-001/SC-002)

```bash
pnpm dev                                            # modo fake recomendado
pnpm exec test-storybook ...                        # via pnpm storybook:test
pnpm test:visual                                    # regressão visual (base atualizada da nova paleta)
```

**Esperado**:
- Formulário, geração e leitor (claro + escuro) usam a paleta quente oklch, tipografia Baloo 2/Nunito
  e cards arredondados com sombras soft/lift — sem valores hex/px arbitrários em componentes (só
  tokens).
- Texto normal mantém **AA ≥4.5:1** em claro e escuro (verificado em stories de a11y).
- Foco visível, navegação por teclado e `prefers-reduced-motion` preservados.

### 2. Seleção de tema em cards com os 6 temas (US4 / FR-008 / SC-007)

```bash
# no app fake, abrir formulário: os 6 cards (emoji + nome + descrição) aparecem localizados
pnpm exec vitest run src/features/story-request src/lib/story-catalog
```

**Esperado**: os 6 temas (Coragem, Amizade, Bondade, Curiosidade, Perseverança, Empatia) aparecem
como cards com emoji, nome e descrição em pt-BR e en; estado selecionado claro e acessível
(`aria-pressed`); o catálogo derivado nunca diverge do schema.

### 3. Os 3 novos temas geram histórias sem erro (FR-009)

```bash
# contrato/e2e com provider fake: selecionar curiosity/perseverance/empathy → história gerada
pnpm exec vitest run src/features/story-generation/server/schemas src/app/api/stories
```

**Esperado**: `POST /api/stories` aceita `theme: curiosity|perseverance|empathy` e retorna
`200 GeneratedStory` coerente; o servidor rejeita um tema fora dos 6 (400 `invalidInput`); a
payload contém apenas `ageBand/locale/theme/sceneCount` — nenhum identificador.

### 4. Segurança dos 3 novos temas (FR-009 / SC-007)

```bash
pnpm exec vitest run src/features/story-generation/server/agents/moderator src/features/story-generation/server/safety-pipeline
```

**Esperado**: candidato inseguro em qualquer tema (incluindo os novos) é bloqueado pelo moderador,
regenerado 1x com restrições mais fortes e, se persistir, devolve erro seguro genérico localizado;
nada inseguro é retornado/logado.

### 5. Regressão funcional (SC-005) e performance (SC-006)

```bash
pnpm lint && pnpm format:check && pnpm typecheck      # gates após a última edição
pnpm test                                             # unit/contrato/pipeline (fakes)
pnpm storybook:test                                   # stories default/edge/error + a11y
pnpm test:performance                                  # budgets (≤250 KiB JS inicial; export PDF lazy)
```

**Esperado**: sintaxe/lint/format/type limpos sem `any` novo; behavior existente (cenas 3–5, leitura
em voz alta, PDF, alternância de histórias, modo escuro) não regride; bundle inicial dentro do
orçamento; a importação pesada de export PDF permanece atrasada.

## Notas

- Nenhum cenário chama AI real; tudo determinístico (fakes + `STORIES_TEST_MODE=fake`).
- A nova paleta é a linha de base aprovada da regressão visual (o churn de cor é esperado e
  aprovado como base nova, não como diff indesejado — SC-001).
- Detalhes de implementação (mapas de tokens, `tasks.md` por arquivo) seguem em `tasks.md` e
  `contracts/design-tokens-and-themes.md` e `contracts/design-system.md`.
