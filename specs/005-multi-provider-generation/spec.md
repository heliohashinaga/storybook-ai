# Feature Specification: Geração multi-provedor (OpenCode + OpenRouter)

**Feature Branch**: `005-multi-provider-generation`

**Created**: 2026-08-20

**Status**: Draft

## Clarifications

### Session 2026-08-13

- Q: Qual é o identificador canônico do provedor que o roteamento deve retornar como saída (`RoutedConfig.provider`) — `opencode` ou `opencode-go`? → A: **`opencode-go`** (alinhado a `OPENCODE_GO_API_KEY`); `openrouter` segue o mesmo tratamento. Refinamento: **não há `defaultProvider`** — o provedor é definido **exclusivamente pelo prefixo** do valor do modelo; um valor sem prefixo é erro de configuração no boot (nunca silencioso).
- Q: Os provedores (`opencode-go`/`openrouter`) são vinculados a capacidades fixas? → A: **Não — são genéricos por capacidade**. Texto, moderação ou imagem podem ser servidos por **qualquer** um dos dois provedores, determinados pelo prefixo do respectivo `*_MODEL` (sem vínculo fixo capacidade→provedor). FR-001/US2/US3/D1/D3 atualizados.
- Q: Como a ilustração é gerada quando `IMAGE_MODEL` tem prefixo `opencode-go` (não OpenRouter)? → A: **Existe um adapter de ilustração por provedor**. Se `IMAGE_MODEL` usa prefixo `openrouter/...`, `createOpenRouterIllustration`; se `opencode-go/...`, `createOpenCodeIllustration` (novo; mesmo contrato `IllustrationGenerator`, via `https://opencode.ai/zen/go/v1` + `Bearer OPENCODE_GO_API_KEY`). Documentado em plan (estrutura) + tasks (T011b) + data-model (`image`).

**Input**: Reestruturar o adapter de geração de histórias para **dois provedores simultâneos** por roteamento de capacidade: **OpenCode** para texto/moderação, **OpenRouter** para imagem. (O TTS/voice é tratado pela feature `004-ai-natural-tts` e assume **OpenRouter por hora**, não OpenCode.) O `.env.example` deve passar a usar um esquema de env por capacidade (sem prefixo único `OPENROUTER_`), com a chave e o modelo de cada provedor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar uma história usando dois provedores ao mesmo tempo (Priority: P1)

O sistema deve gerar uma história (texto narrado modelo OpenCode; ilustrações via imagem OpenRouter) em uma única chamada, roteando cada capacidade ao provedor correto; o usuário não percebe roteamento — recebe a história completa. A operação usa as chaves de ambos os provedores (`OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`) e os modelos por capacidade (`TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`), sem exigir nenhuma ação do usuário.

**Why this priority**: é a mudança estrutural central — sem o roteamento dual, não há feature. Deve vir primeiro e ser completamente testável (provider fake).

**Independent Test**: um único fluxo E2E/determinístico com fakes — postar `/api/stories`; verificar que (a) o texto/modação usam o provedor OpenCode (fake), (b) a imagem usa o provedor OpenRouter (fake), e (c) a resposta contém história completa (todas as cenas + ilustrações). Testável sem rede/TTS real.

**Acceptance Scenarios**:

1. **Given** `TEXT_MODEL=opencode-go/qwen/qwen3.7-flash`, `IMAGE_MODEL=openrouter/qwen/qwen3.7-flash` **When** o sistema gera uma história **Then** o texto/modação vão ao OpenCode e a imagem ao OpenRouter, com a resposta completa servida.
2. **Given** um dos provedores indisponível (por ex., OpenRouter falha para imagem) **When** a geração roda **Then** um erro de provedor é mapeado (não `throw` duro, erro tipado) e a resposta falha graciosamente, sem história parcial.
3. **Given** as chaves de ambos os provedores **When** o sistema valida o ambiente **Then** reconhece e usa cada chave para o provedor correto (nenhuma key é usada no provedor errado).

---

### User Story 2 - Configurar os provedores via env por capacidade (Priority: P2)

O operador deve poder configurar, no `.env`, a chave e o modelo de cada provedor de forma independente: `OPENROUTER_API_KEY`/`OPENCODE_GO_API_KEY` e `TEXT_MODEL`/`IMAGE_MODEL`/`MODERATION_MODEL` (novo esquema sem o prefixo único `OPENROUTER_`). O roteamento deriva o provedor de cada capacidade a partir do modelo configurado.

**Why this priority**: sem isso, o operador não consegue escolher/rotar provedores; é a peça que habilita a operação dual. Mas o comportamento já depende do US1, então vem em seguida.

**Independent Test**: teste unitário de contrato/env — carrega um `.env` fictício com o novo esquema; valida que cada capacidade resolve para o provedor e modelo certos; validação Zod do novo schema (presente/ausência das chaves).

**Acceptance Scenarios**:

1. **Given** um `.env` com `TEXT_MODEL=opencode-go/...`, `IMAGE_MODEL=openrouter/...` **When** o adapter lê a config **Then** texto→`opencode-go`, imagem→`openrouter`, moderação→ conforme `MODERATION_MODEL`, com as chaves corretas. *(exemplo: o prefixo de cada `*_MODEL` define o provedor daquela capacidade — qualquer capacidade pode ser servida por `opencode-go` ou `openrouter`.)*
2. **Given** ausência de uma chave obrigatória para um provedor em uso **Then** a validação de ambiente falha com erro claro (sem vazar a key).
3. **Given** o esquema antigo (`OPENROUTER_TEXT_MODEL` etc.) presente **Then** o sistema não o usa (migração para o novo esquema) — documentado como breaking change controlado.

---

### User Story 3 - Manter a experiência anônima com dois provedores (Priority: P2)

O roteamento dual não pode quebrar o contrato anônimo: **cada provedor recebe apenas o payload da(s) capacidade(s) que serve**, sem identificador; nenhuma chave é exposta ao cliente; zero persistência adicional. **Cada capacidade pode ser servida por qualquer um dos provedores** (`opencode-go` ou `openrouter`), determinada pelo prefixo do respectivo `*_MODEL` — não há vínculo fixo capacidade→provedor. O texto da cena (ou os prompts de imagem) pode ir a qualquer provedor, mas sempre sem identificador.

**Why this priority**: é um invariante não-negociável; garantir que a mudança de provedores não vaze dados. Vem junto/depois dos US1/US2.

**Independent Test**: testes de privacidade — para cada capacidade, inspeciona o payload enviado ao respectivo provedor (fake) e confirma ausência de identificador; bloqueia rede a não-local; verifica que nenhuma key está no bundle/cliente.

**Acceptance Scenarios**:

1. **Given** uma geração em andamento **When** cada capacidade é roteada ao provedor indicado pelo prefixo do seu `*_MODEL` (ex.: texto→`opencode-go`, imagem→`openrouter`, ou o inverso, conforme config) **Then** nenhum identificador aparece em nenhum payload/log de provedor.
2. **Given** o app servindo **Then** nenhuma API key aparece no bundle/cliente (server-only).
3. **Given** a resposta **Then** nada é persistido além do contrato existente (sem novo storage).

---

### Edge Cases

- **Provedor que não oferece capacidade**: o roteamento é **sempre por prefixo** (D2) — não há fallback/re-seleção para outro provedor. Se um `*_MODEL` for roteado a um provedor que não suporta aquela capacidade (ex.: imagem apontada a um provedor sem suporte a imagem), o sistema DEVE falhar com erro de configuração tipado no boot (nunca forçar a capacidade a outro provedor nem executar silenciosamente).
- **Chave ausente por capacidade**: capacidade ativa sem sua chave ⇒ erro de validação de env claro (não silencioso).
- **Valor de modelo com prefixo ausente**: roteamento DEVE exigir o prefixo do provedor e falhar com erro de configuração tipado no boot (nunca silencioso); **não há provider default por capacidade**.
- **Falha parcial de provedor**: um provedor (ex. imagem) falha enquanto o outro (texto) funciona ⇒ erro tipado e sem história parcial (invariante do projeto: série ilustrações nunca parcial).
- **Rate limiting / custo por capacidade**: o rate limit de geração limita **chamadas do usuário do app** (quantas gerações de história por IP por janela) — bucket por IP com hash + salt rotativo, **não** por provedor/modelo; o IP **nunca é retido em claro nem enviado ao provedor** (evita enquadrar IP como dado pessoal). Ao exceder o limite, responder erro tipado/HTTP mapeado (ex.: `429`, sem estouro ou erro duro). Default: `STORY_RATE_LIMIT_MAX_REQUESTS=10`, `STORY_RATE_LIMIT_WINDOW_MS=60000` (10 req/60 s) por IP. A narração TTS (feature 004) tem **limite próprio** (`TTS_RATE_LIMIT_MAX_REQUESTS=30`/`TTS_RATE_LIMIT_WINDOW_MS=60000`), separado porque navegar/narrar várias cenas seguidas é fluxo normal de leitura. A preocupação de **custo por capacidade** (modelo caro vs barato) é ortogonal e tratada no roteamento (spec/plan D3), não nestes edge cases.
- **Backward-compatibilidade de env**: migração do esquema `OPENROUTER_*` para o novo — resolver com um período de suporte/deprecação ou errata explícita no `.env.example` (decisão de clarificação D5 abaixo).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE gerar uma história em uma única chamada, roteando **cada capacidade (texto, moderação e imagem) ao provedor definido pelo prefixo do respectivo `*_MODEL`** — `opencode-go` ou `openrouter` podem servir qualquer capacidade (sem vínculo fixo capacidade→provedor) — preservando o fluxo atual (todas as cenas + ilustrações, sem história parcial).
- **FR-002**: O sistema DEVE ler a config por capacidade: `OPENROUTER_API_KEY` (OpenRouter) e `OPENCODE_GO_API_KEY` (OpenCode) para chaves, e `TEXT_MODEL`/`IMAGE_MODEL`/`MODERATION_MODEL` para modelos. **O provedor de cada capacidade é derivado do valor do modelo pela convenção `provedor/resto`**: o primeiro segmento antes da 1ª `/` identifica o provedor (ex.: `opencode-go/qwen/qwen3.7-flash` → provedor `opencode-go`, modelo `qwen/qwen3.7-flash`; `openrouter/qwen/...` → provedor `openrouter`). **Um valor de modelo sem prefixo de provedor é erro de configuração** (validação Zod no boot, nunca silencioso); não há provider default por capacidade.
- **FR-003**: O sistema DEVE validar o ambiente (Zod) com o novo schema; a ausência de uma chave obrigatória para uma capacidade ativa falha com erro claro (sem vazar a key) via `getEnv()`.
- **FR-004**: O sistema DEVE preservar o contrato anônimo: cada provedor recebe apenas o payload da sua capacidade, sem identificador; nenhuma chave no cliente (server-only); zero persistência adicional.
- **FR-005**: O sistema DEVE tratar **erro de provedor por capacidade** de forma tipada (ex.: `ProviderError` com `kind`), mapeando falha sem `throw` duro e sem devolver história parcial — especialmente nunca uma série de ilustrações parcial.
- **FR-006**: O sistema DEVE manter o seletor de teste `STORIES_TEST_MODE` (ausente = providers reais; `fake` = fakes determinísticos) funcionando, para não regredir a suíte de testes.
- **FR-007**: O sistema DEVE manter os budgets de performance vigentes (geração ≤120s, JS inicial ≤250KiB, etc.) — o roteamento dual não degrada.
- **FR-008**: O sistema DEVE migrar para o **novo esquema de env e remover o esquema antigo** (`OPENROUTER_*`) — decisão D5-C: **somente novo esquema** (`OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`), sem compatibilidade com o antigo; a migração é documentada no `.env.example` (breaking change controlado).

*(Decisões de clarificação D1–D4 documentadas como defaults nas Premissas; D5 resolvido - D5-C.)*

>**Clarificação (2026-08-13)**: o identificador canônico do provedor retornado pelo roteamento é **`opencode-go`** (não `opencode`). **Não há `defaultProvider`/fallback por capacidade**: o provedor é derivado exclusivamente do prefixo do valor do modelo; valor sem prefixo ⇒ erro de configuração no boot. Ajustar as menções a `opencode`/`OpenCode` como valor de saída e às regras de default nos artefatos (spec, data-model, tasks, plan).

### Key Entities *(include if feature involves data)*

- **Capability** (mapeamento de capacidade→provedor derivado da config): texto/moderação/imagem podem ser servidos por `opencode-go` **ou** `openrouter`, determinados pelo prefixo do respectivo `*_MODEL` (sem vínculo fixo capacidade→provedor); [speech→TTS_MODEL]. Modelado no `data-model.md` como `Capability` + `RoutedConfig` (resultado não persistido da resolução por capacidade).
- **EnvConfig (servidor)**: `OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`, `STORIES_TEST_MODE` — lidas/validadas via `getEnv()` (Zod). Sem chaves no cliente.
- **RoutedConfig** *(resultado de roteamento para diagnóstico/teste)*: para cada capacidade, o provedor+modelo+`apiKeyEnv` resolvido — modelado em `data-model.md` (`opencode-go`/`openrouter`; sem `defaultProvider`). *(antes referido como "ProviderRoutingResult"; canônica agora é `RoutedConfig`.)*
- **Sem novas entidades de dados persistentes** — as histórias e ilustrações seguem o contrato atual; apenas o mecanismo de roteamento muda.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma única chamada de geração produz história completa usando **texto→OpenCode e imagem→OpenRouter** (verificado por fakes nos testes e por observação de tráfego em teste de integração determinístico) — sem que o usuário faça nada.
- **SC-002**: Config por capacidade verificável: dado um `.env` fictício, cada capacidade resolve ao provedor/modelo correto; validação de chave ausente falha com erro claro (teste de contrato/env).
- **SC-003**: **Anonimato mantido** — para cada capacidade, o payload ao provedor (fake) não contém identificador; nenhuma chave no bundle/cliente; sem novo storage (testes de privacidade).
- **SC-004**: **Sem regressão de testes** — toda a suíte existente (unit/contrato/e2e/visual/perf) permanece verde com o `STORIES_TEST_MODE`/fakes; nenhuma configuração de teste quebrada.
- **SC-005**: Budgets de performance vigentes mantidos (geração ≤120s; JS inicial ≤250KiB gzip; LCP/nav ≤ budget) — roteamento dual não degrada.
- **SC-006**: Sem história parcial: qualquer falha de um provedor (capacidade) resulta em erro tipado/graceful (nunca série de ilustrações parcial), coberto por testes.
- **SC-007**: Migração avisada: o esquema antigo (`OPENROUTER_*`) é removido imediatamente — decisão D5-C, **somente novo esquema, sem período de depreciação** — e o `.env.example` documenta o novo padrão (breaking change controlado).

## Assumptions

- **D1**: Moderação vai ao provedor indicado pelo prefixo de `MODERATION_MODEL` (pode ser `opencode-go` ou `openrouter`), independente do provedor do texto.
- **D2**: **Roteamento por prefixo `provedor/resto` no valor do modelo** — o primeiro segmento antes da 1ª `/` é o provedor, o resto é o caminho do modelo (parser determinístico, coberto por teste de contrato). **Sem valor default por capacidade**: um `*_MODEL` sem prefixo de provedor é erro de configuração no boot (nunca silencioso).
- **D3**: **Cada coexistência de dois provedores é genérica por capacidade**: texto, moderação e imagem podem ser servidos por `opencode-go` ou `openrouter`, conforme o prefixo do respectivo `*_MODEL`. **Provider id canônico para saída de roteamento: `opencode-go` e `openrouter`.**
- **D4 (default)**: Os **testes/fixtures existentes** do adapter de geração são adaptados como parte (adicionar fake do OpenCode, manter fake do OpenRouter; atualizar contrato/env). `STORIES_TEST_MODE` continua como seletor de teste.
- **D5 (resolvido)**: **Somente novo esquema (C)** — remover `OPENROUTER_*` imediatamente, sem fallback; o `.env.example` atualizado documenta o novo padrão; breaking change controlado (projeto pessoal, sem dependentes externos).
- **Sem mudança na UX** do usuário final (histórias e fluxo iguais); a reestruturação é de infra/provedor.
- **Server-only**: chaves/provedores ficam no adapter `server-only`; nunca no cliente.
