# Implementation Plan: Sistema multi-agente de geração de histórias

**Branch**: [`006-multi-agent-story-generation`](https://github.com/repos/storybook-ai/tree/006-multi-agent-story-generation) | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-multi-agent-story-generation/spec.md`

## Summary

Transformar a geração de histórias infantis de uma única chamada monolítica de provedor em um
**pipeline multi-agente coordenado**, onde cada **agente executa de fato as ações da sua role**:
**Coordinator** (orquestra estágios, aplica retry bounded/configurável e monta o resultado final),
**Planner** (define a estrutura de cenas), **Writer** (escreve a narrativa ajustada à faixa etária e
tom), **Moderator** (gate autoritativo de segurança/tom/adequação etária), **Illustrator** (gera
prompts de imagem em inglês e gatilha as ilustrações de cada cena) e **Reader** (lê o texto da cena
em voz alta, gerando áudio narrativo sob demanda).

O pipeline substitui a chamada monolítica em `src/features/story-generation/server/generate-story.ts`,
**mantendo intactos o contrato `POST /api/stories`, o modelo `GeneratedStory`, a fronteira de
privacidade/anônimo e o comportamento do frontend** — os estágios são decompostos internamente, mas
a assinatura e o shape da resposta permanecem idênticos. A role **Reader** mapeia o áudio sob demanda
já entregue pela feature `story-read-aloud` (endpoint `POST /api/narrate`) — não é criado novo payload
de áudio em `GeneratedStory`.

### Decisões de clarificação (incorporadas)

- **Áudio do Reader sob demanda**: gerado server-side, buscado por cena via endpoint dedicado
  (reuso do padrão `story-read-aloud`/`004-ai-natural-tts`); `GeneratedStory` sem áudio embutido.
- **Retry policy**: padrão **até 2 tentativas (1 retry)** por estágio transiente, com o **máximo
  configurável via config**, dentro do budget de latência ≤120 s.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Node.js 20+; Next.js 16 (App Router) + React 19.

**Primary Dependencies**: `next` (16), `react` (19), `zod` (validação de boundary), `next-intl`
(localização pt-BR/en), `@react-pdf/renderer` (lazy-import apenas no export), `openai` (adaptadores
de provedor), `sharp` (otimização de imagem, server-only). Orquestração por **funções tipadas em
processo** (decisão do spike de research.md), sem framework externo de orquestração (evita dependência
e mantém agentes individualmente testáveis).

**Storage**: N/A — nada persistente. História, áudio e estado vivem em memória transitória por pedido;
nenhum identificador direto é armazenado. Cache de áudio/ilustração, se existir, é não-persistente e
escopado à feature `004`/`005` (decisão de design em `research.md`).

**Testing**: Vitest (unit/contrato/pipeline, fakes determinísticos + MSW), Playwright (E2E), Storybook
(stories + a11y), visual/performance separados. Nenhum teste chama AI real (`STORIES_TEST_MODE=fake`).

**Target Platform**: Web (server-centralizado React/Next.js; renderizado no servidor).

**Project Type**: Web application (App Router, Server Components por default, `'use client'` apenas
onde interatividade exige).

**Performance Goals**: geração completa (story + safety + N imagens, N=3..5) ≤120 s ponta-a-ponta;
navegação de cena ≤100 ms p75; bundle inicial da rota ≤250 KiB gzip.

**Constraints**: `POST /api/stories` é o **único** entry-point server de geração (regra de anonimato);
`Cache-Control: no-store`; nenhum identificador direto em UI/API/logs/payloads; provador de segurança
(Moderator) é gate autoritativo antes de qualquer retorno; conjunto parcial de ilustrações/narração
nunca é "sucesso"; todas as strings pelos catálogos next-intl.

**Scale/Scope**: personal, não-comercial; volume baixo de usuários; até 5 cenas por história; foco em
correção, segurança e testabilidade por agente, não em throughput.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (Constitution 1.1.0) | Status | Justificativa |
|----------------------------|--------|---------------|
| **Code Quality**: TypeScript strict, sem `any` em produção; lint=0 warnings; format/typecheck no gate | ✅ Passa | Pipeline tipado; cada agente é uma função/estrato tipado; sem `any` novo justificado. |
| **Testing**: cobertura ≥80% total; ≥90% safety/validation/orchestration; testes determinísticos (fakes, sem wall-clock/rede) | ✅ Passa | Por-agente testável isoladamente; Moderator e Coordinator em ≥90%; fakes determinísticos. |
| **UX & Accessibility**: AA contrast, foco visível/keyboard, `prefers-reduced-motion`, `aria-live`/`aria-busy` para async | ✅ Passa | Leitor e narração (Reader) preservam estados acessíveis; UI inalterada no contrato. |
| **Performance**: ≤120 s geração; ≤250 KiB bundle inicial; navegação ≤100 ms; lazy-import PDF | ✅ Passa | Pipeline respeita budget; áudio sob demanda não engorda bundle inicial; serial baseline garantido. |
| **Privacy/Anonymity (AGENTS.md)**: nenhum identificador direto; só faixa idade/tema/locale; servidor-only adapters; `no-store` | ✅ Passa | Cada agente recebe só dados anonimizados; adaptadores de provedor restritos a server. |
| **Legal/Disclaimer**: manter avisos de conteúdo gerado/responsabilidade/anonimato no README | ✅ Passa | Sem remoção/atenuação de avisos. |

*Resultado: nenhuma violação de gate; não há necessidade de Complexity Tracking.*

## Project Structure

### Documentation (this feature)

```text
specs/006-multi-agent-story-generation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — spike de orquestração & padrões por role
├── data-model.md        # Phase 1 output — entidades do pipeline (Outcome, AgentResult, Veredicto)
├── quickstart.md        # Phase 1 output — guia de validação end-to-end
├── contracts/           # Phase 1 output — contrato do pipeline/agentes
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── stories/route.ts          # ÚNICO entry-point de geração — delegar ao novo pipeline
│   │   └── narrate/route.ts          # Reader: áudio sob demanda (já existente em story-read-aloud)
│   └── ...                           # rotas de UI (leitor, form) — inalteradas no contrato
├── features/
│   ├── story-generation/
│   │   ├── client/                   # form/leitor — inalterado
│   │   ├── server/
│   │   │   ├── agents/               # NOVO — pipeline multi-agente
│   │   │   │   ├── coordinator.ts    #   orquestra Planner→Writer→Moderator→(Illustrator|Reader); retry; montagem
│   │   │   │   ├── planner.ts        #   outline de cenas (faixa variável 3..5)
│   │   │   │   ├── writer.ts         #   narrativa por faixa etária/tom
│   │   │   │   ├── moderator.ts       #   gate autoritativo de segurança/tom/adequação; regenerar 1x
│   │   │   │   ├── illustrator.ts    #   prompts de imagem em inglês; gatilho de ilustrações por cena
│   │   │   │   ├── reader.ts         #   encaminha texto p/ áudio sob demanda (story-read-aloud)
│   │   │   │   ├── agent-result.ts   #   tipos comuns (AgentResult, erro tipado por estágio)
│   │   │   │   └── retry.ts          #   política bounded/configurável (default 2 tentativas)
│   │   │   ├── generate-story.ts     #   REFACTOR: orquestra o Coordinator (substitui chamada monolítica)
│   │   │   ├── generation-runtime.ts #   clock/injeção para determinismo e medição de budget
│   │   │   ├── provider-routing.ts   #   roteamento por capacidade (005) — Planner/Writer/Illustrator
│   │   │   ├── safety-pipeline.ts    #   (mantém regras base; Moderator expõe o gate)
│   │   │   ├── story-generation-provider.ts  # boundary — assinatura preservada
│   │   │   └── ...                   # adaptadores existentes (OpenRouter/OpenCode/fixed) — preservados
│   │   └── locales/                  # pt-BR / en
│   ├── story-read-aloud/             # Reader nativo — TTS existente (endpoint /api/narrate)
│   │   └── server/                   # tts-runtime, tts-provider, fixed/openrouter — preservados
│   └── story-reader/                 # player de leitura em voz alta (client) — inalterado
├── components/ui/                    # primitivos compartilhados — inalterados
├── lib/                              # helpers — inalterados
└── ...server-only boundary via imports
```

**Structure Decision**: Estrutura unique-projeto (Next.js) já existente. A mudança concentra-se em
`s/features/story-generation/server/agents/` (novo subpacote de agentes) + refactor de
`generate-story.ts`; a role **Reader** reutiliza `story-read-aloud` (endpoint `/api/narrate` já
existente), sem novo payload em `GeneratedStory`. Contrato de frontend/API e a fronteira de
privacidade permanecem intactos.

## Complexity Tracking

> *Nenhuma violação de Constitution Check — tabela não necessária.*
