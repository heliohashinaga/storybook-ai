# Reviews — Consolidação da Orquestração dos Adapters de Provider

**2026-08-17** — Início do recurso. Espec, plano e tarefas criados a partir da auditoria de código
(duplicação `generateStory`/`moderateText`/`moderateImage` entre `openrouter` e `opencode`).

## Decisões a registrar

- **D1**: Formato Spec Kit (decisão do usuário) — branch + spec `013-refactor-provider-orchestration`.
- **D2**: Escopo completo (US1 factory; US2 adapters finos; US3 paridade + gates). Feature
  **behavior-preserving** — nenhuma mudança de UI, contrato, env ou prompt.
- **D3**: A factory recebe o **client OpenAI pronto** (tipo `OpenAI`, do pacote `openai`) + modelos
  + `fetchImpl?`; a construção do client (`getClient()` com `baseUrl`/`defaultHeaders`/app-identity)
  permanece em cada adapter (Decisão-3 do `plan.md`).
- **D4**: Corpo da factory movido **verbatim** dos adapters — sem editar semântica/prompt/timeout/
  retry/erro (`diff` vazio antes de consolidar).
- **D5**: ADR-0010 já criado e commitado no setup (T032 = revisar, não criar — remediado no analyze).

## Confirmações pendentes durante a implementação

- [x] Restaurar `.specify/feature.json` para `012-fake-content-catalog` ao final conforme workflow
  (`T035`).
- [x] Prova de ausência de duplicação fora de `provider-core/` por grep (`T030`, SC-004).
- [x] Follow-up de imagem: se houver drift entre `createOpenRouterIllustration`/
  `create-opencode-illustration` e `provider-core/image-client.ts` e o diff **não** for trivial
  (mudança mecânica, ≤ ~15 linhas, sem alteração de comportamento, coberto por teste existente),
  registrar aqui como follow-up e **não** mesclar nesta feature (Decisão-4; `T022`).

## Follow-up registrado (Decisão-4 / T022)

- **Imagem não mesclada nesta feature**: `createOpenRouterIllustration` e
  `create-opencode-illustration` já reutilizam `provider-core/image-client.ts`
  (`postImages`/`toWebPDataUri`), mas as duas funções **não** são trivialmente mescláveis:
  o adapter OpenRouter expõe seams adicionais (`imageEncoder`/`sharp` default e
  `urlSafetyResolver` SSRF) e passa encoder a `toWebPDataUri`, enquanto o adapter OpenCode
  não passa encoder nem seam de SSRF. Mesclá-las alteraria o contrato/testes do adapter
  OpenCode (não trivial, > ~15 linhas, mudança de comportamento) — fora do escopo desta
  feature. Follow-up: consolidar as duas funções de ilustração num único primitivo em
  `provider-core` numa future spec.

## Review de Implementação

**2026-08-17** — Convergência da spec 013 (US1-US3 concluídos).

- **US1 (Factory, T010-T013)**: `provider-core/create-chat-provider.ts` criado verbatim, lazy
  `getClient`, exportado via barrel, teste novo (fail-before/pass-after) verde. ✔
- **US2 (Adapters finos, T020-T023)**: `openrouter` e `opencode` delegam a
  `createChatCompletionsProvider({ getClient, textModel, moderationModel })`; nenhum corpo de
  orquestração duplicado permanece; imports/helprs órfãos removidos; testes existentes dos dois
  adapters verdes **sem alteração de expectativa** (43/43 nos 4 arquivos relevantes). ✔
- **US3 (Paridade, T030-T035)**: grep prova ausência de duplicação — `parseChatJson` /
  `storyCandidateSchema.parse` ocorrem apenas em `provider-core/`; ADR-0010 revisado e alinhado ao
  contrato lazy-getter real; `spec.md`/`plan.md` já estavam em sincronia; gates finais pós-edição
  verdes (`lint` 0 warnings, `format:check`, `typecheck`, `test` 680/680); `feature.json`
  restaurado para `012-fake-content-catalog`. ✔
- **SC-001..SC-005**: todos atendidos (adapters finos; factory única em `provider-core`;
  behavior-preserving com teste dedicado; nenhuma duplicação fora de `provider-core`; gates
  verdes no diff final). ✔

**Follow-up registrado (T022 / Decisão-4)**: a consolidação das duas funções de ilustração
(`createOpenRouterIllustration` vs `create-opencode-illustration`) não é trivial (drift de seams
`imageEncoder`/`urlSafetyResolver` e encoder passado a `toWebPDataUri`) — fora do escopo desta
feature; registrar como future spec.
