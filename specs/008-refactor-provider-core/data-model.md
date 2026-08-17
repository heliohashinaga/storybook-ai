# Data Model — Núcleo Comum dos Adapters de Provider

**Phase 1 output** | 2026-08-14

**Nota**: Refatoração preservadora de comportamento — **nenhum tipo de contrato de dados muda**.
Este documento descreve, em alto nível, as entidades de código (não dados persistentes) que serão
movidas/extraídas. Não há armazenamento, log ou payload novo.

## Entidades de código (núcleo extraído em `provider-core/`)

- **ProviderCore**: conjunto de módulos `server-only` sem estado. Contém os helpers compartilhados
  (schemas Zod, prompts, parse de chat, moderação, erro).
- **ImageImagesClient**: função pura de transporte `postImages(request) => Promise<{ bytes, mediaType }>`
  que faz POST em `{baseUrl}/images`. Não persiste nada; retorna bytes em memória.

## Tipos base (fonte de verdade — NÃO movidos)

Mantidos em `src/features/story-generation/server/story-generation-provider.ts` (não são
duplicados; não entram no escopo):
- `ProviderStoryInput`
- `GeneratedStoryCandidate`
- `ModerationDecision`
- `StoryGenerationProvider`
- `ProviderError` (classe de erro base; sub-utilizada por `toProviderError`)
- `StoryProviderOptions` / `IllustrationProviderOptions` (usados em `generation-runtime.ts`)

## Schemas Zod extraídos (para `provider-core/schemas.ts`)

- `sceneCandidateSchema` — estrutura de uma cena candidata
- `storyCandidateSchema` — estrutura da história completa (`{ scenes: [...].min(1) }`)
- `moderationSchema` — estrutura da decisão de moderação

Nenhum desses é um contrato de rede/API pública; são validação de boundary interna entre a saída do
provedor e o orquestrador.

## Dependências entre módulos (após refatoração)

```text
adapter openrouter ─┐
                    ├─→ provider-core/{schemas,prompts,chat-json,moderation,provider-errors}
adapter opencode  ──┘

adapter openrouter / create-opencode-illustration
                    ├─→ provider-core/image-client ─→ image-optimizer (operador sharp + guarda)
                    └─→ provider-errors

generation-runtime → adapters (thin shells) [roteamento por provider inalterado]
```

## Invariantes

- Nenhuma persistência, cookie, storage ou cache.
- Nenhum identificador direto da criança (idade exata só em memória; servidor recebe apenas
  `ageBand`).
- Todos os módulos núcleo são importados sob fronteira `server-only`.
