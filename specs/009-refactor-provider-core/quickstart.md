# Quickstart — Núcleo Comum dos Adapters de Provider

**Phase 2/delivery output** | 2026-08-14

## O que esta feature faz

Refatoração **preservadora de comportamento** (`server-only`) que extrai o núcleo comum dos
adapters de geração de histórias. Não muda nenhuma funcionalidade, env, contrato, prompt ou UX.

## Onde fica o código

- Núcleo extraído: `src/features/story-generation/server/provider-core/`
  - `schemas.ts` — `sceneCandidateSchema`, `storyCandidateSchema`, `moderationSchema`
  - `prompts.ts` — `NARRATIVE_SYSTEM_PROMPT`, `narrativeUserPrompt`, `MODERATION_SYSTEM_PROMPT`
  - `chat-json.ts` — `parseChatJson`
  - `moderation.ts` — `moderate(...)`
  - `provider-errors.ts` — `toProviderError`
  - `image-client.ts` — transporte `{baseUrl}/images`
  - `index.ts` — barrel `server-only`
- Adaptadores thin shell: `openrouter-story-generation-provider.ts`, `opencode-story-generation-provider.ts`, `create-opencode-illustration.ts`
- Encoder/guarda canônico WebP: `image-optimizer.ts` (passa a ser consumido pelo `image-client.ts`)

## Como validar

Da raiz do repositório (nenhuma IA real; fixtures determinísticas + fakes):

```bash
# Gate de teste completo (unit/contract/pipeline)
pnpm test

# Atualizar tipagem/estilo sempre que tocar em arquivo
pnpm typecheck
pnpm lint            # 0 warnings
pnpm format:check    # sem drift (roda pnpm format se necessário)

# Cobertura (≥80% geral, ≥90% validação/safety/orquestração)
pnpm test:coverage:check

# Build release
pnpm build
```

> **IMPORTANTE**: rode `lint`/`format:check`/`typecheck` APÓS a última edição (nunca usar resultado
> stale). O hook pré-commit (`scripts/pre-commit`) executa os três automaticamente.

## Critérios de aceite (detalhe no `spec.md`)

- Zero definição duplicada dos helpers em `provider-core/` (SC-001).
- Testes existentes verdes com fixtures inalteradas (SC-002).
- Gates verdes na árvore suja pós-última-edição (SC-003, SC-004).
- `openrouter-story-generation-provider.ts` → ~80–100 linhas; idem opencode (SC-005).

## Fora de escopo

- Nenhuma mudança em `env.ts`, `provider-routing.ts`, `story-generation.openapi.yaml`,
  `generation-runtime.ts` (roteamento), UI/Storybook/E2E/visual.
- Nenhum novo identificador; nenhuma persistência.
