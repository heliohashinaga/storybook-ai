# Implementation Plan: Adotar o design system e o frontend do story-blossom-room

**Branch**: [`007-adopt-blossom-design`](https://github.com/repos/storybook-ai/tree/007-adopt-blossom-design) | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-adopt-blossom-design/spec.md`

## Summary

Adotar a **identidade visual** e o **tratamento de front-end** de `story-blossom-room` (protótipo
visual do mesmo produto) sobre o app de produção `storybook-ai`, em dois eixos:

1. **Design system & front-end**: substituir a paleta hex atual por tokens semânticos **oklch**
   quentes (creme/coral/terracota + acento vivo, claro/escuro), tipografia display "Baloo 2" +
   "Nunito", raios/ sombras/ espaçamento por tokens (rounded, soft/lift shadows), e adaptar as
   telas de formulário, geração e leitor (seleção de tema em cards com emoji, seletor de cenas,
   topo com marca + idioma + tema, estágios de progresso, barra do leitor) mantendo a estrutura por
   features, a i18n por catálogos (next-intl) e o contrato `POST /api/stories` inalterado.

2. **Expansão de temas 3 → 6**: aumentar o conjunto de temas narrativos de
   `courage/friendship/kindness` para **6** (`+ curiosity/perseverance/empathy`), nos schemas
   client+server, no catálogo/localização (pt-BR/en), no planner (derivação de purpose) e no
   provider fake determinístico — sem introduzir identificadores, mantendo a mesma pipeline de
   segurança e o mesmo contrato anônimo.

A refatoração é visual/UX + catálogo: **nenhum** identificador é introduzido; as regras de
privacidade, acessibilidade, validações e o back-end de geração existentes são preservados.

### Decisões de clarificação (incorporadas)

- **Conjunto de temas (Q1-B)**: expor os **6 temas do protótipo** (Coragem, Amizade, Bondade,
  Curiosidade, Perseverança, Empatia) no formulário, exigindo suporte de schema, catálogo, planner
  e provider fake para os 3 novos.
- **Idade**: mantém-se o campo numérico atual do formulário (2–9) restilizado; o protótipo usa um
  slider, mas o input numérico já validado é a base segura — tratado como refinamento de UX, não
  contrato.

## Technical Context

**Language/Version**: TypeScript 6.x (strict) sobre Node.js 20+; Next.js 16 (App Router) + React 19.

**Primary Dependencies**: `next` (16), `react` (19), `zod` (validação de boundary), `next-intl`
(localização pt-BR/en), `@react-pdf/renderer` (lazy-import apenas no export), `tailwindcss` (4.x,
tokens semânticos), fontes `@next/font/google` (ou `next/font`) para **Baloo 2** (display) e
**Nunito** (corpo). Sem novas libs de UI — primitivas compartilhadas (`components/ui`) reaproveitam
a stack existente (shadcn-style manual).

**Storage**: N/A — nada persistente. A identidade visual vive em tokens (`globals.css` +
`tailwind.config.ts`); não há dado de usuário persistido e a escolha de tema visual é em-memória.

**Testing**: Vitest (unit/contrato/pipeline, fakes determinísticos + MSW), Playwright (E2E),
Storybook (stories + a11y), visual/performance separados. Nenhum teste chama AI real
(`STORIES_TEST_MODE=fake`); fixture do provider fake atualizada para cobrir os 6 temas.

**Target Platform**: Web (server-centralizado React/Next.js; renderizado no servidor).

**Project Type**: Web application (App Router, Server Components por default, `'use client'` apenas
onde interatividade exige).

**Performance Goals**: bundle inicial da rota ≤250 KiB gzip; navegação de cena ≤100 ms p75; a
identidade visual (fontes self-hosted + tokens) não deve inflar o bundle além do orçamento (labels
de fontes enxutos, pesos limitados); geração existente ≤120 s inalterada.

**Constraints**: `POST /api/stories` é o **único** entry-point server de geração; `Cache-Control:
no-store`; nenhum identificador direto em UI/API/logs/payloads (o `theme` permanece o nome
categórico anônimo); todas as strings via catálogos next-intl; tokens semânticos obrigatórios (nunca
hex/px arbitrários em componentes); AA contrast (≥4.5:1) em texto normal claro e escuro; foco
visível/keyboard e `prefers-reduced-motion` preservados; remoção de código morto/duplicado.

**Scale/Scope**: personal, não-comercial; volume baixo; até 5 cenas; foco em coerência visual,
acessibilidade, determinismo de testes e catálogo — não em throughput.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (Constitution 1.1.0) | Status | Justificativa |
|----------------------------|--------|---------------|
| **Code Quality**: TS strict, sem `any` em produção; lint=0 warnings; format/typecheck no gate | ✅ Passa | Extensões tipadas (Theme categorical union, tokens semânticos); catálogo derivado do schema sem drift; sem `any` novo. |
| **Testing**: cobertura ≥80% total; ≥90% safety/validation/orchestration; testes determinísticos | ✅ Passa | Schema/catálogo com 6 temas testados por contrato; fixture provider fake estendida; primitivas/stories com a11y; determinístico. |
| **UX & Accessibility**: AA contrast, foco visível/keyboard, `prefers-reduced-motion`, `aria-live`/`aria-busy` | ✅ Passa | Nova paleta oklch revalidada para AA (claro/escuro); seleção de tema em cards com `aria-pressed` + foco; progress/estágios com `aria-busy`/`aria-live`. |
| **Performance**: ≤120 s geração; ≤250 KiB bundle inicial; navegação ≤100 ms; lazy-import PDF | ✅ Passa | Tokens/fontes não engordam bundle além do orçamento; export PDF segue lazy (001); geração inalterada. |
| **Privacy/Anonymity (AGENTS.md)**: nenhum identificador; só faixa idade/tema/locale; server-only; `no-store` | ✅ Passa | Tema novo é categoria anônima no mesmo payload; nenhum campo novo de dado pessoal; emoji nos cards é apresentação, não identificador. |
| **Legal/Disclaimer**: manter avisos de conteúdo/responsabilidade/anonimato no README | ✅ Passa | Sem remoção/atenuação de avisos. |

*Resultado: nenhuma violação de gate; não há necessidade de Complexity Tracking.*

## Project Structure

### Documentation (this feature)

```text
specs/007-adopt-blossom-design/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — decisão de tokens/paleta, fontes e escopo de temas
├── data-model.md        # Phase 1 output — entidades: Theme union ampliada, tokens visuais, catálogo
├── quickstart.md        # Phase 1 output — guia de validação end-to-end
├── contracts/           # Phase 1 output — contrato de temas (schema/catálogo) e tokens visuais
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                     # adicionar fontes (Baloo 2 + Nunito) via next/font; header com marca + escolha idioma/tema
│   ├── page.tsx                       # shell da rota — herda nova identidade (sem lógica nova)
│   └── globals.css                    # REFATORAR tokens: palette hex → oklch quente; font-display; novos shadows/radius; dark
├── components/ui/                     # primitivos compartilhados — REESTILIZAR para linguagem do protótipo
│   ├── button.tsx                     #   raios maiores, shadow-lift/soft, hover elevado
│   ├── choice-card.tsx                #   suporte a emoji/ícone + estados selecionado (aria-pressed) na nova linguagem
│   ├── progress.tsx                   #   barra rounded, cor da barra, transição suave
│   ├── select.tsx                     #   (restilizar controles conforme necessário)
│   └── alert.tsx                      #   alinhar à nova paleta (mantendo variants semantic)
├── i18n/
│   └── locale-provider.tsx            # inalterado (controla idioma da UI)
├── features/
│   ├── story-request/
│   │   ├── client/
│   │   │   └── story-preferences-schema.ts   # themeValues: 3 → 6 (client boundary)
│   │   ├── components/
│   │   │   ├── story-request-form.tsx        # cards de tema com emoji (themeCatalog); seletor de cenas; botão primário
│   │   │   ├── story-generation-progress.tsx # estágios nomeados + progress ao estilo protótipo
│   │   │   └── story-request-app.tsx         # orquest. form → progress → leitor (restilo)
│   │   └── locales/
│   │       ├── pt-BR.json              # catalog.theme.* + themeDescription.* → 6 temas; strings visuais novas
│   │       └── en.json                 # idem (en)
│   ├── story-reader/
│   │   └── components/                 # reader + scene-view + scene-progress + story-history → estilo protótipo
│   ├── story-read-aloud/
│   │   └── components/narration-control.tsx  # botão play/stop (aria-pressed) → novo estilo
│   ├── story-export/
│   │   └── components/export-story-button.tsx # PDF no rodapé → novo estilo (lazy-import mantido)
│   └── theme/
│       └── components/theme-toggle.tsx # alternância claro/escuro → novo estilo (sem persistência)
├── lib/
│   └── story-catalog.ts               # themeCatalog → 6 temas (label + description, derivado do schema)
├── features/story-generation/server/   # EXPANSÃO DE TEMAS (back-end anônimo) — contrato preservado
│   ├── schemas.ts                     #   themeSchema: z.enum 3 → 6
│   ├── agents/planner.ts              #   purposeFor(): mapear os 3 novos temas a um purpose
│   ├── opencode-story-generation-provider.ts  #   copia `theme` ao input (já passa; verificar coerência)
│   └── fixed-dev-provider.ts          #   fixture determinística cobre 6 temas (fakes/visual/e2e)
└── ...server-only boundary via imports
```

**Structure Decision**: Estrutura unique-project (Next.js) já existente. A mudança concentra-se em:
**(a)** sistema de design em `src/app/globals.css` + `tailwind.config.ts` + `src/app/layout.tsx`
(fontes/header) — base consumida por todas as primitivas e features; **(b)** reestilização das
primitivas em `src/components/ui/` e dos componentes de `src/features/*` (sem mudar a estrutura por
feature nem o contrato); **(c)** expansão de temas em `story-preferences-schema.ts` (client),
`schemas.ts` (server), `story-catalog.ts`, catálogos next-intl e `planner.ts` + `fixed-dev-provider.ts`
(fakes). `POST /api/stories`, `GeneratedStory` e a fronteira de privacidade permanecem intactos.

## Complexity Tracking

> *Nenhuma violação de Constitution Check — tabela não necessária.*
