# ADR 0010 — Factory única de orquestração para os adapters de geração

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-17
- Contextos relacionados: spec `013-refactor-provider-orchestration`; ADR 0008 (extração de
  núcleo comum dos adapters); specs `005-multi-provider-generation` e `006-multi-agent-story-generation`.

> O ADR é **Accepted** e precede a implementação da spec 013. Consolida a orquestração dos
> adapters OpenAI-compatíveis sem mudança de comportamento, fechando a duplicação deixada pelo
> ADR 0008.

## Contexto

O `008-refactor-provider-core` (ADR 0008) extraiu para `provider-core/` as **primitivas de baixo
nível** compartilhadas pelos adapters de geração: schemas Zod (`storyCandidateSchema` etc.),
`parseChatJson`, prompts de sistema, `moderate()` e `toProviderError`. Com isso, os dois adapters
OpenAI-compatíveis — `openrouter-story-generation-provider.ts` e
`opencode-story-generation-provider.ts` — passaram a importar dessas primitivas.

Porém, a **camada de orquestração** ficou de fora daquele escopo. Os métodos
`generateStory()`, `moderateText()` e `moderateImage()` permanecem, hoje, **idênticos byte a
byte** nos dois adapters:

- `generateStory()` — `client.chat.completions.create` com `response_format: json_object` +
  prompt narrativo → `parseChatJson` → `storyCandidateSchema.parse` → mesmo catch de
  `ZodError`/`ProviderError` → `toProviderError`.
- `moderateText()` / `moderateImage()` — delegações idênticas para `moderate(client,
moderationModel, …)`.

O `provider-routing.ts` escolhe o adapter por prefixo de modelo em runtime, então essa
duplicação é **invisível até divergir silenciosamente** (ex.: alterar um timeout/retry/prompt em
um adapter e esquecer o outro).

## Decisão

1. **Criar uma factory única de orquestração em `provider-core`** —
   `createChatCompletionsProvider(deps)` — que encapsula `generateStory`, `moderateText` e
   `moderateImage`. A factory recebe o client OpenAI **já construído** pelo adapter + os modelos
   (`textModel`, `moderationModel`) + `fetchImpl` opcional (para testes determinísticos) e devolve
   um objeto que implementa as capacidades text+moderation de `StoryGenerationProvider`.

2. **Adapters viram shell fino de configuração.** `openrouter` e `opencode` mantêm apenas
   `resolveDeps()`, `getClient()` (baseUrl/modelos/`defaultHeaders`) e a **composição**:
   `createChatCompletionsProvider({ client, textModel, moderationModel, fetchImpl })`. Nenhum corpo
   de orquestração permanece neles.

3. **Comportamento preservado ao extremo.** O corpo da factory é movido **verbatim** dos adapters —
   sem mudar prompt, modelo, timeout, retry, `response_format`, tratamento de erro ou capacidades.
   Nenhuma mudança de interface pública (`StoryGenerationProvider`), de `provider-routing.ts`, de
   contrato OpenAPI ou de env.

4. **Imagem / TTS ficam de fora desta feature.** A geração de ilustrações (openrouter `/images`
   vs opencode) e os providers de TTS seguem de fora do escopo; se houver drift, registrar como
   follow-up, não mesclar automaticamente.

## Consequências

**Positivas:**

- A orquestração existe **uma vez só**; alterações de timeout/retry/prompt/erro têm um único lugar.
- Adapters enxutos, fáceis de adicionar (novo provider = novo `getClient` + composição).
- Refactor **behavior-preserving**, coberto pelos testes existentes dos dois adapters
  (baseline verde sem alterar expectativas).

**Negativas / trade-offs:**

- A factory recebe o client já construído; a lógica de `getClient()` (defaultHeaders específicos)
  permanece por adapter — duplicação mínima e intencional, pois é a parte genuinamente específica.

**Neutras / custos:**

- Um módulo novo em `provider-core/` e exposição via barrel; ADR registrado para consulta futura.
- Exige que os gates (`lint`/`format:check`/`typecheck`/`test`) sejam rodados no diff final.

## Alternativas consideradas

- **Não fazer nada** (manter a duplicação): mais barato hoje, porém multiplica o risco de
  divergência silenciosa de comportamento entre providers — rejeitado.
- **Factory com prompt/schema por parâmetro**: mais flexível, porém adiciona superfície de API e
  risco de drift; a feature é behavior-preserving e os prompts já são iguais — rejeitado por ora
  (registrar como follow-up se um dia divergirem).
