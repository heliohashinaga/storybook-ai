# Especificação de Recurso: Núcleo Comum dos Adapters de Provider

**Feature Branch**: `008-refactor-provider-core`

**Created**: 2026-08-14

**Status**: Draft

**Input**: Descrição do usuário: "refatorar, gerar um plano" — com decisão de seguir o formato Spec Kit.

## Resumo

Refatoração **preservadora de comportamento** (sem mudança funcional ou de UX) da camada de
adapters de provider de geração de histórias (`src/features/story-generation/server/`). O objetivo é
eliminar a duplicação de código verificada entre:

1. `openrouter-story-generation-provider.ts` (350 linhas) e `opencode-story-generation-provider.ts`
   (231 linhas) — que compartilham helpers **byte-idênticos**: schemas Zod
   (`sceneCandidateSchema`, `storyCandidateSchema`, `moderationSchema`), parse de chat JSON,
   construção de prompts de sistema (`NARRATIVE_SYSTEM_PROMPT`, `narrativeUserPrompt`,
   `MODERATION_SYSTEM_PROMPT`), função de moderação e mapeamento de erro `toProviderError`.
2. `createOpenRouterIllustration` (dentro do provider openrouter) e `createOpenCodeIllustration`
   (`create-opencode-illustration.ts`) — que compartilham o transporte `/images` (corpo POST
   `{model, prompt, n:1, output_format:"webp", aspect_ratio:"1:1"}` e parsing de resposta
   `b64_json`/`url`/`media_type`) **byte-idêntico**, divergindo apenas no seam de codificação WebP.
3. `image-optimizer.ts` — módulo canônico testado (`optimizeImageBytes`, `defaultSharpEncoder`,
   guarda de tamanho) que está **órfão** (não é importado por nenhum código em `src/`), com
   lógica de guarda/resize que os adapters de imagem atuais reimplementam de forma ad-hoc.

A refatoração preserva os contratos públicos existentes (`createOpenRouterStoryProvider`,
`createOpenCodeStoryProvider`, `generate-story`, `provider-routing`, `generation-runtime`) e
**não altera** roteamento, env vars, prompts, limites de timeout/retry nem nenhum dado enviado a
provedores. Nenhum novo identificador é introduzido; a fronteira `server-only` é mantida.

## User Scenarios & Testing *(obrigatório)*

> NOTA: Como se trata de refatoração imperceptível ao usuário, os "user stories" abaixo são
> reformulados como **objetivos de qualidade verificáveis** do código, em vez de jornadas de usuário
> final. Cada um é independentemente testável e entrega valor mensurável de manutenção.

### User Story 1 — Núcleo único de fornecedor de texto/moderação (Priority: P1)

Extrair para um módulo compartilhado (`server/provider-core/`) os helpers responsáveis por texto e
moderação hoje duplicados entre os adapters OpenRouter e OpenCode: schemas Zod de candidatos,
parse de JSON de chat, prompts de sistema, função de moderação e mapeamento de erro.

**Why this priority**: É a maior fonte de duplicação (~estima-se 60–70% de linhas compartilhadas
entre os dois adapters). É a base P1 porque, sem ela, qualquer correção em prompts/schemas/moderação
precisa ser aplicada em dois lugares, o que já é terreno fértil para bug de divergência (os prompts
já apresentam risco de dessincronização). Extrair aqui destrava os demais objetivos.

**Independent Test**: os helpers extraídos são exercitados pelos testes existentes
(`opencode-story-generation-provider.test.ts`, `openrouter-story-generation-provider.test.ts`),
executados em `STORIES_TEST_MODE=fake` com fixtures determinísticas — sem chamada a IA real. O teste
passa para os dois adapters apenas se o comportamento de texto/moderação permanecer idêntico ao
baseline.

**Acceptance Scenarios**:

1. **Given** o código atual com os dois adapters, **When** executo os testes de unidade dos
   adapters pós-refatoração, **Then** todos passam sem alteração de fixtures de entrada/saída.
2. **Given** um helper compartilhado extraído, **When** procuro suas definições no diff, **Then**
   ele aparece em `server/provider-core/` e os dois adapters o importam (zero definição duplicada
   remanescente em `openrouter-*`/`opencode-*`).
3. **Given** a refatoração aplicada, **When** rodo `pnpm typecheck`, `pnpm lint` e
   `pnpm format:check`, **Then** passam sem avisos e sem drift.
4. **Given** a cobertura pós-refatoração, **When** rodo `pnpm test:coverage:check`, **Then**
   mantém ≥90% nas medidas de validação/safety/orquestração (constitution).

---

### User Story 2 — Transporte único de ilustração `/images` (Priority: P2)

Extrair o transporte `/images` compartilhado entre `createOpenRouterIllustration` e
`createOpenCodeIllustration` em um cliente núcleo de imagem, e consolidar o encoding/guarda de
tamanho WebP em `image-optimizer.ts`.

**Why this priority**: Menor que o US1 em volume, mas ainda alto risco de divergência porque o
corpo do POST e o parsing de resposta estão duplicados de forma byte-idêntica; qualquer ajuste de
formato de resposta ou de parâmetros de geração precisaria ser replicado em dois arquivos. Além
disso, elimina o acoplamento de imagem de dentro do adaptador OpenRouter (que hoje mistura texto,
moderação e imagem num único arquivo de 350 linhas).

**Independent Test**: os testes existentes `opencode-illustration.test.ts` e
`illustration-concurrency.test.ts` seguem passando com as mesmas respostas fake; `image-optimizer.test.ts`
permanece verde e agora cobre também o caminho do novo cliente núcleo.

**Acceptance Scenarios**:

1. **Given** os dois adapters de ilustração, **When** extraio o cliente `/images`, **Then** ambos
   passam a usá-lo, com o corpo do POST e o parsing de resposta definidos uma única vez.
2. **Given** o encoding WebP, **When** consolido em `image-optimizer.ts`, **Then** a guarda de
   tamanho `DEFAULT_MAX_DATA_URI_LENGTH` é aplicada no transporte núcleo e nenhum encoding ad-hoc
   duplicado permanece nos adapters.
3. **Given** a refatoração, **When** verifico o import, **Then** `image-optimizer.ts` deixa de ser
   órfão e é consumido pela camada de geração (ou, se descoberto redundante, é consolidado sem
   deixar código-morto — sem manter código não utilizado).

---

### User Story 3 — Higiene do consumidor de runtime + regras de qualidade (Priority: P3)

Atualizar `generation-runtime.ts` (único consumidor real dos seeds) para importar apenas o que
mudou, revisar o `fixed-dev-provider.ts` para reutilizar fixtures determinísticas compartilhadas,
e garantir que as regras de qualidade do repositório (lint/format/typecheck/cobertura) sejam
re-executadas após a última edição.

**Why this priority**: É o passo de "polimento" e validação de fechamento; entrega menor valor
isolado, mas garante que a refatoração não seja apenas uma mudança de "empurrar arquivos", e que o
`fixed-dev-provider.ts` (287 linhas) não seja deixado com duplicação nova.

**Independent Test**: execução completa do pipeline `pnpm test` + `pnpm lint` + `pnpm format:check`
+ `pnpm typecheck` + `pnpm test:coverage:check` com a árvore suja (uncommitted) — em orquestração
real `STORIES_TEST_MODE=fake`.

**Acceptance Scenarios**:

1. **Given** o backend de dev/provider fixo, **When** reviso `fixed-dev-provider.ts`, **Then**
   reutiliza as fixtures determinísticas compartilhadas (sem re-declarar as mesmas estruturas).
2. **Given** a árvore de trabalho com as alterações finais, **When** rodo os gates
   (lint/format/typecheck/coverage), **Then** todos passam na árvore suja — resultado
   pós-última-edição, não stale.
3. **Given** o feature completo, **When** atualizo `specs/008-refactor-provider-core/` e o
   `docs/adr/` se um contrato mudar, **Then** a documentação reflete o novo núcleo.

---

### Edge Cases

- **Prompt dessincronizado durante a extração**: como os dois `NARRATIVE_SYSTEM_PROMPT`/
  `MODERATION_SYSTEM_PROMPT` já existem duplicados, a extração deve **preservar exatamente** o texto
  atual de cada um (diff vazio antes de consolidar) — nunca "melhorar" o prompt no mesmo commit.
- **Divergência de seam de imagem**: OpenRouter injeta `imageEncoder` (via `toWebPBuffer`) enquanto
  OpenCode usa encoding interno com fallback de sharp. O núcleo deve aceitar um seam de encoder
  injetável, preservando ambos os comportamentos atuais.
- **Código órfão**: confirmado em `research.md` que `image-optimizer.ts` é órfão em produção
  (`optimizeImageBytes`/`DEFAULT_MAX_DATA_URI_LENGTH` nunca importados em `src/`). **Decisão
  fechada**: integrar ao `image-client.ts` — o novo cliente DEVE aplicá-lo no caminho real de
  geração (a guarda de 4 MiB hoje não roda em produção). Não manter órfão nem remover a guarda.
- **Front `build-story-pdf.tsx`** re-declara `WEBP_DATA_URI_PREFIX`; verificar se pode importar a
  constante do núcleo (sem puxar código server-only para o client pdf — avaliar re-export seguro fora
  de `server-only` se fizer sentido) ou manter separado por fronteira.
- **Nenhuma mudança de env/contrato**: não alterar `env.ts`, `provider-routing.ts` nem o
  `story-generation.openapi.yaml`; a refatoração não toca em APIs públicas.

## Requirements *(obrigatório)*

### Requisitos Funcionais

- **FR-001**: O sistema DEVE extrair os helpers compartilhados de texto/moderação
  (`sceneCandidateSchema`, `storyCandidateSchema`, `moderationSchema`, `parseChatJson`,
  `NARRATIVE_SYSTEM_PROMPT`, `narrativeUserPrompt`, `MODERATION_SYSTEM_PROMPT`, `moderate`,
  `toProviderError`) para `src/features/story-generation/server/provider-core/`, sem alterar a
  semântica.
- **FR-002**: Os adapters `openrouter-story-generation-provider.ts` e
  `opencode-story-generation-provider.ts` DEVEM importar os helpers do núcleo e reter apenas a
  parte específica de cada provider (config base URL/timeout, resolução de deps/env key, construção
  do cliente SDK, interface de deps).
- **FR-003**: O transporte `/images` DEVE ser extraído em um cliente núcleo de ilustração usado
  por `createOpenRouterIllustration` e `createOpenCodeIllustration`, com seam de encoder WebP
  injetável.
- **FR-004**: `image-optimizer.ts` DEVE ser integrado ao cliente núcleo de imagem
  (`image-client.ts`), que DEVE aplicar `optimizeImageBytes`/`defaultSharpEncoder` e a guarda
  `DEFAULT_MAX_DATA_URI_LENGTH` no caminho real de geração — fechando a lacuna atual em que a guarda
  só roda em testes (órfão).
- **FR-005**: Nenhum contrato público (interface `StoryGenerationProvider`, `generate-story`,
  `provider-routing`, env vars, prompts, timeouts, retries) DEVE mudar.
- **FR-006**: Nenhum identificador direto novo DEVE ser adicionado; a fronteira `server-only` DEVE
  ser mantida; `POST /api/stories` permanece a única entrada de servidor.
- **FR-007**: Todos os arquivos criados/editados DEVMÃO passar por `pnpm lint` (0 warnings),
  `pnpm format:check` (sem drift) e `pnpm typecheck` (sem `any` novo em produção), re-executados
  APÓS a última edição.

### Key Entities *(se o recurso envolver dados)*

- **ProviderCore (contêiner de módulos)**: conjunto de módulos `server-only` sob
  `provider-core/` contendo schemas, prompts únicos, parse de chat, moderação e mapeamento de erro —
  sem estado, sem dados persistentes.
- **ImageClient (cliente de transporte)**: função pura `postImages(req) => { bytes, mediaType }`
  que faz POST em `{baseUrl}/images`, com AbortController/timeout, parsing de `b64_json`/`url` e — via
  `image-optimizer` — encoding WebP + guarda de tamanho.
- **ProviderAdapter (openrouter/opencode)**: thin shell que injeta deps específicas no núcleo —
  já existe, apenas passa a reutilizar o núcleo.

## Success Criteria *(obrigatório)*

### Resultados Mensuráveis

- **SC-001**: Zero definição duplicada remanescente dos helpers listados em FR-001 (verificável
  por `grep` no diff — cada símbolo definido uma única vez em `provider-core/`).
- **SC-002**: `pnpm test` verde na árvore suja (não-deployed), com todas as fixtures de
  entrada/saída inalteradas entre antes e depois (baseline registrado em T002 para comparação).
- **SC-003**: `pnpm lint`, `pnpm format:check` e `pnpm typecheck` passam na árvore suja APÓS a
  última edição (sem resultado stale).
- **SC-004**: `pnpm test:coverage:check` mantém os gate atual: ≥80% geral e ≥90% em
  validação/safety/orquestração.
- **SC-005**: `openrouter-story-generation-provider.ts` reduz de 350 para ~80–100 linhas (removendo
  a imagem para `image-client.ts`) e `opencode-story-generation-provider.ts` de 231 para ~80–100 —
  verificado por `git diff --stat`/`wc -l` antes vs depois (registrado em T025), sem perda de
  cobertura.

## Assumptions

- Refatoração **preservadora de comportamento**: nenhuma mudança intencional de funcionalidade,
  prompt, timeout, retry, modelo de roteamento ou UX.
- `generation-runtime.ts` é o único consumidor real dos seeds (confirmado por grep) e não muda seu
  roteamento por provider.
- Tests nunca chamam IA real: apenas `STORIES_TEST_MODE=fake` com fixtures determinísticas.
- Os prompts duplicados atuais são considerados **o baseline canônico**; a extração os move sem
  editar conteúdo.
- `.specify/feature.json` deve apontar para `specs/008-refactor-provider-core` durante o
  desenvolvimento, e restaurar 007 no fim, se a convenção o exigir (confirmar com o workflow).
