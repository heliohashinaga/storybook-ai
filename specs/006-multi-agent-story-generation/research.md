# Research: Sistema multi-agente de geração de histórias

**Phase 0 output** — resolve os `NEEDS CLARIFICATION`/trade-offs do Technical Context e
fundamenta o design em `data-model.md`, `contracts/` e `quickstart.md`.

## 1. Mecanismo de orquestração (spike)

**Unknown**: Como encadear Coordinator → Planner → Writer → Reviewer → Illustrator → Reader de modo
que cada agente seja individualmente testável e a falha seja tipada?

**Decision**: Orquestração via **funções tipadas em processo** (`coordinator.ts` orquestra agentes
como funções assíncronas puras), sem framework externo de orquestração/agentes. Não há máquina de
estado genérica nem runtime de agentes.

**Rationale**:
- Mantém a fronteira `server-only` existente (adaptadores já são funções tipadas).
- Cada agente é uma função determinística testável isoladamente (SC-007) com fakes injetados via
  provider boundary (`StoryGenerationProvider` existente).
- Evita dependência nova (bundler/CLI de orquestração) que inflaria o bundle/custo e complicaria o
  `POST /api/stories`.
- O retry bounded (default 2 tentativas, configurável) é implementado como um helper `retry.ts`
  reutilizável, não embutido em cada agente.

**Alternatives considered**:
1. *Framework de orquestração de agentes* (ex.: biblioteca de graph/agents): poderosa, porém
   adiciona dependência e acoplamento; overkill para 6 funções coordenadas num request HTTP.
2. *Máquina de estados (State Machine)*: útil para fluxos longos/async, porém o pipeline é linear e
   síncrono por pedido — adiciona complexidade sem ganho.
3. *Cadeia de middlewares/pipes genéricos*: esconde o fluxo e dificulta teste por estágio.

## 2. Paralelização segura (US4)

**Unknown**: Quais estágios podem ser paralelos sem quebrar dependências, dentro do budget ≤120 s?

**Decision**: A linha crítica **Planner → Writer → Reviewer → (Illustrator | Reader)** permanece
serial. A única paralelização segura é **ilustrações múltiplas** (N cenas por vez, depois de o
Reviewer aprovar todas) e, se configurado, **Illustrator ∥ Reader** após a aprovação das cenas —
apenas quando independentes e dentro do budget.

**Rationale**: Reviewer DEVE ver a saída do Writer; Illustrator e Reader NUNCA antecedem a aprovação
da cena (FR-006 / US2). Gerar imagens em paralelo (até 5) reduz latência sem violar dependências.

**Alternatives considered**: paralelizar Writer por cena (risco de incoerência de voz), paralelizar
Reviewer de ilustração (não é gate de narrativa) — rejeitadas por complexidade/risco.

## 3. Mapeamento da role Reader sobre TTS existente

**Unknown**: Como integrar a leitura em voz alta sem criar novo contrato de áudio.

**Decision**: A role **Reader** encaminha o texto localizado de cada cena ao já existente
`story-read-aloud` (`app/api/narrate/route.ts` + `tts-runtime`), que gera áudio **sob demanda** e o
serve por cena. Nenhum áudio é embutido em `GeneratedStory` (SC-006/SC-010). Se `AI_NARRATION_ENABLED`
estiver desligado, cai para a voz Web Speech/fallback do `004-ai-natural-tts` (ou desabilitado).

**Rationale**: Reutiliza a fronteira `tts-provider.ts` validada, evita novo endpoint de geração e
mantém o bundle inicial pequeno (player lazy-loaded via `use-read-aloud`).

**Alternatives considered**: gerar áudio no `POST /api/stories` e embutir (quebra SC-006 e infla o
payload); endpoint novo dedicado de áudio por cena na mesma rota de geração (redundante com
`/api/narrate`).

## 4. Retry policy (FR-006-b) — spike de configuração

**Unknown**: Como tornar o máximo de tentativas configurável sem expor ao usuário.

**Decision**: `retry.ts` expõe `runWithRetry(fn, { maxAttempts })` com `maxAttempts` **default 2**
(1 retry), lido de **env/config server-only** (ex.: `STORY_MAX_AGENT_ATTEMPTS`, sem valor default
público). Falha transiente → retry; persistente → erro tipado por estágio. Nunca história parcial.

**Rationale**: Alinha à política "regenerar uma vez" do Reviewer (FR-004) e mantém o budget ≤120 s
(testado em `quickstart.md`).

## 5. Observabilidade por estágio (postergada para o plano)

**Unknown**: Sinais de progresso/status por agente.

**Decision**: Adicionar identificador de estágio no **erro tipado** (`agent-result.ts`) e, quando
ativo, incrementar métricas/estrutura de diagnóstico em memória por pedido — sem expor ao frontend.
Não há pipeline assíncrono/job; o `POST /api/stories` continua síncrono e `no-store`.

**Rationale**: Atende à rastreabilidade de falha (reliability) sem mudar o contrato nem adicionar
polling. Detalhes de métricas ficam em `tasks.md`.

## 6. Volume/escala

**Unknown**: Dados/volume do pipeline.

**Decision**: Sem persistência; cada pedido é transitório. Cache não-persistente aceitável para
ilustração/áudio já otimizados nas features 004/005; nenhum identificador direto em cache.

**Rationale**: personal, não-comercial; foco em correção/segurança/testabilidade, não throughput.

## 7. Localização e prompts de imagem (FR-003/FR-005/SC-008)

**Decision**: Narrativa/UI/alt-text seguem `locale` (pt-BR default, en) via next-intl; **prompts de
imagem** gerados pelo Illustrator são **sempre em inglês**, independente do locale. Ajuste de
vocabulário à faixa etária (`2-4 | 5-7 | 8-9`) é responsabilidade do Writer, validada pelo Reviewer.
