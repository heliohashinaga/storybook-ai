# Quickstart: Geração multi-provedor (validação)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `005-multi-provider-generation`

Guia de **validação** do roteamento dual por capacidade (`opencode-go`/`openrouter`). Não substitui o contrato; detalhes no [data-model.md](./data-model.md) e [contracts/provider-routing.openapi.yaml](./contracts/provider-routing.openapi.yaml).

## Pré-requisitos

- Node.js 22, pnpm 11.20.0 (via `corepack`/`packageManager`).
- Playwright/Chromium para `storybook:test`, `test:e2e`, `test:visual` (deps nativas via `sh scripts/setup-chromium-deps.sh` ou `playwright install --with-deps chromium`).
- `.env.local` (gitignored) com o **novo** esquema por capacidade — sem `OPENROUTER_*` legado:

```bash
# Provedores
OPENROUTER_API_KEY=sk-...      # chave do provedor OpenRouter
OPENCODE_GO_API_KEY=sk-...     # chave do provedor opencode-go

# Modelos por capacidade (convenção provedor/resto, FR-002)
TEXT_MODEL=opencode-go/qwen/qwen3.7-flash
IMAGE_MODEL=openrouter/qwen/qwen3.7-flash
MODERATION_MODEL=opencode-go/qwen/qwen3.7-flash

# TTS/leitura em voz (feature 004) — roteada como as demais via READER_MODEL
READER_MODEL=openrouter/hexgrad/kokoro-82m
AI_NARRATION_ENABLED=false

# Ambientes determinísticos
STORIES_TEST_MODE=fake   # roda sem chaves reais, com provedor fake
```

## Como rodar

```bash
pnpm install
pnpm format        # após qualquer arquivo novo/editado (gate format:check)
pnpm lint          # zero warnings
pnpm typecheck     # TS estrito, sem `any` novo em produção
```

| Comando | Valida | Resultado esperado |
| --- | --- | --- |
| `pnpm test` / `pnpm test:limited` | Unit/contrato/env + pipeline com `fetchImpl`/fakes | todo verde; inclui `provider-routing.test.ts`, `env.test.ts` (esquema novo) |
| `pnpm test:coverage` / `pnpm test:coverage:check` | cobertura (≥80% global; ≥90% safety/validation/orchestration) | gates ok |
| `pnpm storybook:test` | cada story (default/loading/error/edge) + a11y (WCAG A/AA) | 52/52 (baseline atual), a11y sem violações |
| `pnpm test:e2e` | rota `POST /api/stories` dual com fake provider (pt-BR + EN) | US1/US3, sem história parcial |
| `pnpm test:visual` | reader/vista (screenshots aprovados) | sem diff inintencional |
| `pnpm test:performance` | budgets (geração ≤120 s; JS inicial ≤250 KiB gzip) | budgets respeitados |
| `pnpm build` | production build | passa |

## Cenários de validação (US1/US3)

1. **Roteamento dual (US1, fake)**: `STORIES_TEST_MODE=fake` + `POST /api/stories` → a resposta contém todas as cenas **e** todas as ilustrações; nunca série parcial. Logs/payloads sem identificador direto.
2. **Env novo esquema (D5-C)**: sem `OPENROUTER_*` legado; `TEXT_MODEL=opencode-go/qwen/qwen3.7-flash`, `IMAGE_MODEL=openrouter/qwen/qwen3.7-flash` resolvem `provider-routing` (ver exemplos no contrato). Prefixo desconhecido → falha de validação no boot (nunca silencioso).
3. **Sem prefixo (erro de config no boot)**: `TEXT_MODEL=qwen/qwen3.7-flash` (sem `opencode-go/`) → **falha de validação no boot** (nunca silencioso); não há provider default por capacidade.
4. **Falha de provedor (US3)**: `IMAGE_MODEL` apontando provedor indisponível → erro tipado (`ProviderError`/`kind`) mapeado por HTTP; **nunca** história com conjunto parcial de ilustrações.
5. **Privacidade**: teste de invariante por capacidade — payload enviado a cada provedor contém apenas a capacidade anônima (ageBand/locale/theme/sceneCount), sem nome/idade exata; nada persistido.

## Critérios de conclusão (DoD)

- [ ] `lint`, `format:check`, `typecheck` verdes (rodados **após** a última edição).
- [ ] Testes verdes e cobertura ≥80% (≥90% safety/validation/orchestration).
- [ ] `storybook:test`, `test:e2e`, `test:visual`, `test:performance` verdes com fake provider.
- [ ] Nenhum identificador direto em payload/log/provider; sem persistência nova.
- [ ] OpenAPI de geração atualizado se contrato público mudar — **não muda**; `provider-routing.openapi.yaml` registra o contrato interno.
