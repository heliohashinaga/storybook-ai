# Data Model: Geração multi-provedor (roteamento por capacidade)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `005-multi-provider-generation`

Documenta as **entidades lógicas** (não persistidas; sem novo storage) do roteamento dual. Nenhuma entidade nova sobrevive fora de memória — preserva o invariante de zero-persistência/anônimo.

---

## Entidade 1: `Capability`

Capacidade de geração gerenciada pelo roteador. Enumerada e finita.

| Campo | Tipo | Obrigatório | Descrição / validação |
| --- | --- | --- | --- |
| `kind` | `'text' \| 'moderation' \| 'image'` | sim | A capacidade roteada pela geração. |
| `envModelVar` | `string` | sim | Nome da variável de env usada junto a esta capacidade: `TEXT_MODEL`, `MODERATION_MODEL`, `IMAGE_MODEL`. |

**Regras derivadas do spec (FR-002/FR-008)**:
- `Capability` é resolvida por *runtime*, nunca persistida.
- Roteamento por capacidade define qual `Capability` cada provedor atende; uma mesma chamada `POST /api/stories` usa as três, cada uma roteada ao provedor correto (US1).

---

## Entidade 2: `RoutedConfig`

Resultado da resolução do roteador por capacidade — o que o runtime usa para selecionar o provedor concreto.

| Campo | Tipo | Obrigatório | Descrição / validação |
| --- | --- | --- | --- |
| `capability` | `Capability['kind']` | sim | Capacidade em questão. |
| `provider` | `'opencode-go' \| 'openrouter'` | sim | Provedor resolvido. |
| `model` | `string` | sim | Modelo efetivamente usado (após remover prefixo de provedor, se houver). |
| `apiKeyEnv` | `'OPENCODE_GO_API_KEY' \| 'OPENROUTER_API_KEY'` | sim | Chave de API correspondente ao provedor resolvido. |

**Regras de derivação** (convenção FR-002/D2 — primeiro segmento antes da 1ª `/`):
- `TEXT_MODEL=opencode-go/qwen/qwen3.7-flash` → `{ provider: 'opencode-go', model: 'qwen/qwen3.7-flash' }`
- `IMAGE_MODEL=openrouter/qwen/qwen3.7-flash` → `{ provider: 'openrouter', model: 'qwen/qwen3.7-flash' }`
- `TEXT_MODEL=qwen/qwen3.7-flash` (sem prefixo) → **erro de configuração no boot** (validação Zod); não há `defaultProvider`.
- Prefixo reconhecido: `opencode-go` → `opencode-go`; `openrouter` → `openrouter`. Prefixo desconhecido ou ausente → erro de configuração tipado no boot (validação Zod do env), nunca silencioso.

---

## Entidade 3: `MultiProviderRuntime`

O componente consumido pela rota `POST /api/stories` — acopla os provedores por capacidade.

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `text` | `StoryGenerationProvider` | sim | Provedor de texto (definido pelo prefixo de `TEXT_MODEL`). |
| `moderation` | `StoryGenerationProvider` (modo moderação) | sim | Provedor de moderação (definido pelo prefixo de `MODERATION_MODEL`). |
| `image` | `IllustrationGenerator` (caminho atual) | sim | Provedor de ilustração (definido pelo prefixo de `IMAGE_MODEL`; hoje `createOpenRouterIllustration` + `image-optimizer`). |
| `rateLimiter` | `RateLimiter` | sim | Rate limiting compartilhado (default 10 req/60 s; `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`). |

**Regras / invariantes**:
- Falha de qualquer capacidade é convertida em `ProviderError` com `kind` (`unavailable | timeout | invalid_structured_output`) para mapeamento HTTP (manter contrato atual).
- **Nunca** série de ilustrações parcial: se a moderação falha, nada de história; se uma ilustração falha, a geração completa é abortada e devolvida como erro genérico localizado (manter pipeline existente `generate-story`/`safety-pipeline`).
- Anonimato por capacidade: cada provedor recebe apenas o payload anônimo da sua capacidade (sem identificador). Verificado por teste de privacidade.

---

## State / transições

Não há *state machine* nova de domínio. Transições relevantes já existentes no pipeline (`generate-story` / `safety-pipeline`):
- `text` → moderado → `image` (por cena, com concurrency bounded EC5/ADR-0005).
- Roteamento é uma **decisão de montagem** no boot do runtime, não uma transição em runtime.

---

## Persistência

Nenhuma. `Capability`, `RoutedConfig` e `MultiProviderRuntime` são estruturas em memória/servidor. Sem cookies, localStorage, indexDB, cache de história, nem storage de ilustrações (data URI transitória). Sem campo de identificador direto — apenas `ageBand`, `locale`, `theme`, `sceneCount` (esquema anônimo vigente).

---

## Contrato de interface

O público `POST /api/stories` (**request/response**) está documentado em `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml` e **não muda** (o roteamento é server-internal). O contrato afetado é o **lado servidor** (`StoryGenerationProvider` + resolução por capacidade); ver detalhes no roteador em `provider-routing.ts` e no OpenAPI de geração se houver mudança no mapeamento de erro (a ser confirmado na implementação).
