# Tasks: Geração multi-provedor (roteamento por capacidade)

> Organizado por **user story** (US), do spec `005-multi-provider-generation/spec.md`. Segue o formato-obrigatório do checklist do template. Customizado pela convenção `*_MODEL` (`provedor/resto`) e pelos arquivos reais do repositório.

## Convenções

- **Formato**: `- [ ] [TaskID] [P?] [Story?] Descrição com caminho de arquivo`.
- **Story labels**: `[US1]`, `[US2]`, `[US3]` — apenas em fases de user story (Setup/Foundational/Polish: sem label).
- **Test-first**: o constitution/AGENTS exigem provar a razão do fail antes de implementar — cada task de código traz uma task de teste que falha primeiro.
- **Path base**: `src/features/story-generation/server/`, `src/lib/`, `tests/`.

---

## Phase 1 — Setup

- [x] T001 Atualizar `specs/005-multi-provider-generation/quickstart.md` com o esquema novo de env por capacidade (sem `OPENROUTER_*` legado) e os comandos de validação.
- [x] T002 [P] Confirmar no `.github/workflows/ci.yml` que `STORIES_TEST_MODE=fake` permanece no job `browser` (E2E/Storybook/visual/performance rodam determinísticos com fake provider).

---

## Phase 2 — Foundational (bloqueia todas as user stories)

> Env novo e roteador por capacidade são pré-requisitos que desbloqueiam US1/US2/US3.

- [x] T003 [P] Escrever teste `tests/unit/env.test.ts` para o novo esquema por capacidade (valida que `OPENROUTER_*` legado não é aceito; `OPENCODE_GO_API_KEY`/`TEXT_MODEL`/`IMAGE_MODEL`/`MODERATION_MODEL` obrigatórios; `STORIES_TEST_MODE` opcional) — deve falhar enquanto o schema atual ainda usa `OPENROUTER_*`.
- [x] T004 Escrever teste `tests/unit/provider-routing.test.ts` para o roteador por capacidade (exemplos de aceitação do spec: `opencode-go/qwen/qwen3.7-flash` → `opencode-go`; `openrouter/qwen/qwen3.7-flash` → `openrouter`; sem prefixo → erro de config no boot; prefixo desconhecido → erro de config no boot).
- [x] T005 Atualizar o schema Zod de env por capacidade em `src/lib/env.ts` (remover `OPENROUTER_TEXT_MODEL`/`OPENROUTER_IMAGE_MODEL`/`OPENROUTER_MODERATION_MODEL`; adicionar `OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`) — implementa o teste T003.
- [x] T006 Atualizar `src/lib/env.ts`/`.env.example` para refletir exatamente o schema novo (sinonímia com quickstart.md; sem `OPENROUTER_*` legado). **Confirmar que todos os consumidores do schema antigo foram migrados** — `grep` por `OPENROUTER_TEXT_MODEL`/`OPENROUTER_IMAGE_MODEL`/`OPENROUTER_MODERATION_MODEL`/`OPENROUTER_API_KEY`/`OPENROUTER_MODERATION_MODEL` nos módulos `story-generation/server` e `story-read-aloud/server` (incl. `openrouter-story-generation-provider.ts`, `generation-runtime.ts`, `tts-runtime.ts`) e ajustar para as novas vars por capacidade; nenhum resquício do esquema legado pode permanecer (FR-008).
- [x] T007 Criar o módulo puro de roteamento `src/features/story-generation/server/provider-routing.ts` (resolver `{ provider, model, apiKeyEnv }` por capacidade via primeiro segmento de `*_MODEL`; sem prefixo ou prefixo desconhecido → erro tipado no boot, sem `defaultProvider`) — implementa o teste T004.

---

## Phase 3 — User Story 1 (P1): Roteamento dual em chamada única

> **Goal**: `POST /api/stories` roteia cada capacidade (texto/moderação/imagem) ao provedor indicado pelo prefixo do respectivo `*_MODEL` (`opencode-go` ou `openrouter`), entregando história completa (todas as cenas + ilustrações) em uma chamada.
> **Teste independente**: E2E com fake provider determinístico — verifica que cada capacidade usou o provedor correspondente ao seu `*_MODEL` (ex.: texto/moderação→`opencode-go`, imagem→`openrouter`, mas qualquer combinação é válida por prefixo) e que a resposta contém todas as cenas e ilustrações.

- [x] T008 [P] [US1] Escrever teste `tests/unit/opencode-story-generation-provider.test.ts` para o provedor OpenCode (texto e moderação) usando `fetchImpl` determinístico — falha enquanto o provider não existe. **Cobrir explicitamente o caminho de moderação** (veredito bloqueado/aprovado, ex. `safe`/`flagged`) de forma distinta da geração de texto (FR-001/FR-005).
- [x] T009 [P] [US1] Escrever teste de contrato `tests/contract/provider-routing.openapi.test.ts` validando o contrato de roteamento por capacidade definido em `contracts/provider-routing.openapi.yaml` (o contrato público `story-generation.openapi.yaml` permanece inalterado; roteamento é interno ao servidor).
- [x] T010 [P] [US1] Criar `src/features/story-generation/server/opencode-story-generation-provider.ts` (texto + moderação via OpenAI-compatible `https://opencode.ai/zen/go/v1`, `Bearer OPENCODE_GO_API_KEY`, `fetchImpl` injetável; transcreve o padrão do OpenRouterStoryProvider) — implementa T008.
- [ ] T011 [P] [US1] Ajustar `src/features/story-generation/server/openrouter-story-generation-provider.ts` para servir **qualquer capacidade roteada a ele** (texto/moderação ou imagem) conforme o prefixo do `*_MODEL` (mantendo o caminho de imagem + `image-optimizer` lazy `sharp`, sem mudar o contrato de ilustração).
- [x] T011b [P] [US1] Criar o adapter de ilustração para OpenCode `src/features/story-generation/server/create-opencode-illustration.ts` (mesmo contrato `IllustrationGenerator` de `createOpenRouterIllustration`, mas via `https://opencode.ai/zen/go/v1` + `Bearer OPENCODE_GO_API_KEY`, `fetchImpl` injetável) — usado quando `IMAGE_MODEL` tem prefixo `opencode-go/...`.
- [x] T011c [P] [US1] Escrever teste unit determinístico `tests/unit/opencode-illustration.test.ts` para `createOpenCodeIllustration` (com `fetchImpl` fake: sucesso, imagem inválida, falha de provider → erro tipado; mesmo contrato do router) — falha enquanto o adapter não existe (test-first, Princípio II).
- [ ] T012 [US1] Atualizar `src/features/story-generation/server/generation-runtime.ts` para montar o runtime dual (US1) via `provider-routing.ts`: cada capacidade roteada ao provedor do prefixo do seu `*_MODEL` (ex.: texto→`opencode-go`, moderação→`openrouter`, imagem→`opencode-go` — qualquer combinação válida), preservando `STORIES_TEST_MODE=fake` → `createFixedDevProvider()`. **IMPORTANTE**: o roteador exige prefixo de provedor em cada `*_MODEL` (sem `defaultProvider`); `apiKeyEnv` é derivado do **prefixo** (prefixo `openrouter`→`OPENROUTER_API_KEY`; `opencode-go`→`OPENCODE_GO_API_KEY`), não da capacidade.
- [ ] T013 [US1] Escrever teste E2E `tests/e2e/generate-pt-br.spec.ts` (ou novo `tests/e2e/generate-dual-provider.spec.ts`) com fakes: POST `/api/stories` → cada capacidade roteada ao provedor do seu `*_MODEL` (ex.: texto/moderação em fake `opencode-go`, imagem em fake `openrouter`), resposta com todas as cenas + ilustrações. **Cobrir também o caso inverso** (`IMAGE_MODEL=opencode-go/...` → imagem via `createOpenCodeIllustration`) para exercitar o T011b/T011c.
- [ ] T014 [US1] Rodar E2E com `STORIES_TEST_MODE=fake` e confirmar que nenhuma chamada real a todos os providers acontece (fakes determinísticos; budgets vigentes).
- [ ] T014b [US1] Escrever teste determinístico de caminho de falha para **SC-006 (sem história parcial)**: fake em que o provedor de imagem (`IMAGE_MODEL` → OpenRouter) falha (ex. `unavailable`) **enquanto** o texto/modação (OpenCode) têm sucesso — confirmar que a resposta é erro tipado/`ProviderError`/HTTP mapeado e **nunca** uma história com conjunto parcial de ilustrações (falha ao reproduzir a invariante de no-partial-story).

---

## Phase 4 — User Story 2 (P2): Configuração dos provedores por env

> **Goal**: definir/validar cada provedor via env por capacidade, com validação no boot (sem `defaultProvider`; prefixo obrigatório em cada `*_MODEL`).
> **Teste independente**: unit test de env + router para o esquema por capacidade.
> **Nota**: boa parte do esquema já foi movida nas tasks foundational (T003–T006); esta fase garante cobertura de aceitação US2 e a remoção controlada do legado.

- [ ] T015 [US2] Escrever teste unit de aceitação `tests/unit/env.test.ts` **focado no caminho de erro de boot** de US2 (o schema válido já é coberto em T003): `TEXT_MODEL=opencode-go/qwen/qwen3.7-flash`, `IMAGE_MODEL=openrouter/qwen/qwen3.7-flash` válidos referenciando T003; sem prefixo → erro de config no boot (nunca silencioso); prefixo desconhecido → erro de config no boot (nunca silencioso); **provedor conhecido mas sem suporte à capacidade roteada (ex.: `IMAGE_MODEL` → provedor sem imagem) → erro de config tipado no boot** (edge case "Provedor que não oferece capacidade", SC-002).
- [ ] T016 [US2] Ratificar no `src/lib/env.ts` a remoção definitiva do esquema `OPENROUTER_*` legado (D5-C — somente novo esquema) e rodar `pnpm test` para o conjunto de env; ajustar qualquer fixture que ainda setasse o padrão antigo.
- [ ] T017 [US2] Documentar a configuração por capacidade em `quickstart.md` (comentário env) e confirmar que `.env.example` não deixa resquício de `OPENROUTER_*` legado.

---

## Phase 5 — User Story 3 (P2): Experiência anônima com dois provedores

> **Goal**: dois provedores simultâneos sem expor identificador; cada provedor recebe apenas o payload anônimo da sua capacidade.
> **Teste independente**: teste de invariante de privacidade + E2E anônimo.

- [ ] T018 [P] [US3] Escrever teste de privacidade por capacidade `tests/unit/provider-privacy.test.ts` (ou estender `tests/unit/provider-fixtures.test.ts`): payload de cada capacidade não contém nome/idade exata/identificador; apenas `ageBand`, `locale`, `theme`, `sceneCount`.
- [ ] T019 [P] [US3] Estender `tests/e2e/anonymous-session-and-export.spec.ts` para cobrir o fluxo dual: rota `POST /api/stories` com fakes, sem identificador em payload/log/provider; sem persistência nova.
- [ ] T020 [P] [US3] Ratificar server-only com critério verificável (gate explícito, não apenas opinião): (1) `opencode-story-generation-provider.ts` e as novas peças de roteamento (`provider-routing.ts`, `generation-runtime.ts`) usam `import 'server-only'`; (2) o **build/typecheck falha** se alguém importar esses módulos de um contexto client (cobrir com teste/assert no CI gate); (3) nenhum log imprime payload/provider/chave.

---

## Phase 6 — Polish & Cross-Cutting Concerns

- [ ] T021 [P] Rodar `pnpm lint` (0 warnings) e corrigir qualquer drift em `src/` e `tests/`.
- [ ] T022 [P] Rodar `pnpm format` em **todos** os arquivos novos/editados (plan/research/data-model/quickstart/contracts incl. YAML) e `pnpm format:check`.
- [ ] T023 [P] Rodar `pnpm typecheck` (TS estrito; nenhum `any` novo em produção) e corrigir.
- [ ] T024 [P] Rodar `pnpm test:coverage` / `pnpm test:coverage:check` (≥80% global; ≥90% safety/validation/orchestration; inclui o novo roteador).
- [ ] T025 [P] Rodar `pnpm storybook:test`, `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:performance` com `STORIES_TEST_MODE=fake` (todas as stories — hoje 52 — + a11y WCAG A/AA; budgets 120 s/250 KiB).
- [ ] T026 Rodar `pnpm build` (production build passa) e atualizar o OpenAPI público de geração se o contrato mudar — expectativa: **sem mudança** (roteamento é server-internal; `provider-routing.openapi.yaml` registra o contrato interno).
- [ ] T028 Escrever teste determinístico de rate limiting cobrindo o edge case "Rate limiting / custo por capacidade" (FR-005/SC-002): forçar `STORY_RATE_LIMIT_MAX_REQUESTS=1` (+ janela mínima via `STORY_RATE_LIMIT_WINDOW_MS`) e verificar que uma segunda requisição ao roteador dual (fake provider, `STORIES_TEST_MODE=fake`) responde erro tipado `rate_limited` mapeado para HTTP 429 (retryable, sem estourar/erro duro) — novo arquivo de teste independente, sem depender de provedor real (ex.: estender `tests/story-generation/generation-runtime.rate-limit.test.ts`). Também cobrir o limite de narração TTS (feature 004): com `TTS_RATE_LIMIT_MAX_REQUESTS=1`, uma segunda chamada a `POST /api/narrate` responde 429 `narration_rate_limited`.
- [ ] T027 Rodar novamente `pnpm lint` + `pnpm format:check` + `pnpm typecheck` **após a última edição** (gate de CI, resultados stale não valem).

---

## Dependências (ordem de conclusão das histórias)

```text
Phase 2 (foundational: env + routing)  ──►  US1 (P1): dual runtime + OpenCode + imagens OpenRouter
        │
        ▼
US2 (P2) ● config por env            (parcialmente coberta na foundational; termina com env tests)
US3 (P2) ● privacidade/anônimo       (independente; inicia paralelo a US1 una vez foundational pronta)
```

- **Setup** → **Foundational** (bloqueia todas).
- **US1** requer foundational (T003–T007).
- **US2** requer foundational (T005–T006).
- **US3** requer foundational (env/privacy Fixtures) e pode rodar paralelo a US1/US2 (só usa fakes + invariant checks).
- **Polish** sempre por último (após a última edição).

## Execução em paralelo (por história)

- **US1**: T008/T009/T010/T011 são `[P]` (arquivos distintos: testes Opencode, contrato, provider Opencode, provider OpenRouter) — podem rodar juntos antes de T012/T013.
- **US3**: T018/T019/T020 `[P]` → paralelizáveis entre si e frente a parte de US1.
- **Polish**: T021–T025 `[P]` agrupáveis, mais T026/T027 em sequência final.

## Estratégia de implementação (MVP)

- **MVP = US1 (P1)** + suporte fundamental (Phase 2). Entrega o valor central — roteamento dual funcional, testável sem provedor real — primeiro.
- **US2 (P2)** e **US3 (P2)** depois, como incrementos independentes e testáveis.
- Entrega incremental: cada user story é um incremento verde e independentemente testável; nenhuma tarefa depende de provedor AI real (fakes determinísticos).

## Validação de completude

- Cada user story tem tasks de código **e** de teste (test-first do constitution).
- US1 testável de forma independente via E2E fake (T013); US2 via env unit (T015); US3 via invariant privacy (T018) + E2E anônimo (T019).
- Caminhos de arquivo explícitos em todas as tasks.
- Zero mudança de contrato público esperada (só `provider-routing.openapi.yaml`, interno).
