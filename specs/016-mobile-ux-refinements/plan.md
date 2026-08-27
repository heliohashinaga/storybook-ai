# Implementation Plan: Mobile UX Refinements

**Branch**: `016-mobile-ux-refinements` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-mobile-ux-refinements/spec.md` (input do
usuário: "melhorar experiência mobile: tem uns textos que quebram, botões muito grandes").

## Summary

Refinamento **puramente de apresentação** para melhorar a experiência em telas pequenas em três
superfícies do app (formulário de pedido/temas, login e reader). Objetivos observáveis: nenhum
texto localizado (descrições de tema, nome de idioma, unidade de cenas) estoura o contêiner ou
quebra em meio de palavra no mobile; controles (botões de cenas, cartões de tema, idioma, OAuth,
CTA) mantêm o alvo acessível `≥44px` mas com densidade visual proporcional (sem dominar a tela);
título da história no reader quebra em até 2 linhas em vez de ser cortado. Sem mudanças de
conteúdo, dados, API ou superfície de privacidade; reuso de tokens/primitivas e dos catálogos
next-intl existentes. Requer re-aprovação intencional dos baselines visuais afetados.

## Technical Context

**Language/Version**: TypeScript strict; Next.js 16 (App Router); React 19; Tailwind v4
(`@tailwindcss/postcss` + `@config`), design tokens (semânticos: cor, espaço, tipografia,
raio, sombra, movimento).

**Primary Dependencies**: Nenhuma dependência nova. Primitivas existentes (`ChoiceCard`,
`OAuthProviderButton`, botões do design system) e tokens (`text-title`, escala de espaçamento
`xs..xl`, `truncate`/`line-clamp`). `next-intl` para strings localizadas (pt-BR + en).

**Storage**: N/A — sem dados novos, sem persistência, sem cookie novo. A rota demo permanece
cookie-less; superfície de privacidade inalterada.

**Testing**: Vitest (unit/component), Storybook test-runner (stories + a11y/contraste), Playwright
(e2e + visual `tests/visual/`). Nenhuma chamada real a serviço externo em testes (fakes/MSW).

**Target Platform**: Web (browser). Foco em viewports de pequena largura (≈ ≤640px), celulares em
retrato 320–428px; sem regressão em desktop.

**Project Type**: Web application (App Router; RSC por padrão, `'use client'` só onde há
interatividade).

**Performance Goals**: mudança visual apenas — sem JS novo no bundle do caminho crítico, sem
_layout thrash_ (medir hidden-overflow/medidas preservadas), budgets de rota inalterados.

**Constraints**:
- UI somente via tokens/primitivas (nunca hex/px ad-hoc) — Princípio III.
- A11y baseline: alvos de toque/teclado `≥44px`; foco visível; teclado; `aria-live`;
  `prefers-reduced-motion`; contraste AA — alvos NÃO devem cair abaixo do mínimo acessível.
- Strings sempre pelos catálogos next-intl (pt-BR + en); nada hardcoded novo.
- Storybook = app: estados default/edge/error e a11y; comportamento idêntico ao real (Princípio III).
- Privacy/servidor intactos: `POST /api/stories` único endpoint, `no-store`; nada disso muda aqui.
- Baselines visuais afetados (`tests/visual/reader.spec.ts` etc.) devem ser re-aprovados de forma
  **intencional** e commitados junto.

**Scale/Scope**: app pessoal/não comercial; 3 superfícies (form/request, login, reader);
refinamento de apresentação; escopo fechado em textos + controles + título do reader.

## Constitution Check

*GATE: avaliado antes da pesquisa (Phase 0) e re-avaliado após o design (Phase 1).*

| Princípio | Verificação desta feature | Estado |
|-----------|---------------------------|--------|
| **I. Code Quality** | Sem `any`; lint/format limpos; mudanças pequenas e focadas; tokens/primitivas, sem valores ad-hoc; remoção de código morto; stories atualizadas quando UI muda. | ✅ Sem violações |
| **II. Testing Standards** | Test-first; cobertura unitária/component para os componentes alterados; stories default/edge/error; determinístico; nomes por comportamento. | ✅ Sem violações |
| **III. UX Consistency** | Primitivas + tokens compartilhados; stories refletem o app; a11y (teclado/foco/semântica); terminologia consistente; Storybook = app. | ✅ Sem violações |
| **IV. Performance** | Sem regressão de bundle (mudança visual); sem re-renders evitáveis nem long tasks no caminho crítico. | ✅ Sem violações |

Nenhuma violação exige justificativa → Complexity Tracking não se aplica.

## Project Structure

### Documentação desta feature

```text
specs/016-mobile-ux-refinements/
├── plan.md              # Este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (sem entidades de dados — ver arquivo)
├── quickstart.md        # Phase 1 (guia de validação)
├── contracts/           # Phase 1 (sem mudança de interface externa — nota)
└── tasks.md             # (/speckit-tasks — não criado aqui)
```

### Código-fonte (raiz do repositório)

```text
src/
├── app/                          # rotas (layout raiz, page.tsx login, demo, (playground))
├── components/ui/                # primitivas compartilhadas (ChoiceCard, …)
├── features/
│   ├── story-request/components/ # formulário: theme-selector, story-request-form (locale, cenas, CTA)
│   ├── auth/components/          # login-screen-view, oauth-provider-button
│   ├── story-reader/components/  # story-reader, scene-progress, choice-card (uso)
│   └── shell/components/         # top-nav, site-footer
├── i18n/                         # config.ts (merge), locale-provider, catálogos
tests/
├── unit/                         # vitest (componentes alterados)
├── e2e/                          # playwright
└── visual/                       # playwright screenshots (reader.spec.ts, smoke)
```

**Structure Decision**: mantém-se a estrutura por feature já existente; nenhuma reorganização.
Os ajustes incidem nas classes Tailwind/tokens dos componentes listados e nas suas stories/tests
co-localizados — sem novos módulos de topo.

## Complexity Tracking

Não aplicável — sem violações de constitution a justificar.

## Re-avaliação pós-design (Phase 1)

Após gerar `research.md`, `data-model.md`, `contracts/README.md` e `quickstart.md`, o Constitution
Check acima foi **reavaliado** — nenhuma violação nova. As decisões (R-01..R-06) respeitam as
primitivas/tokens (III), preservam a a11y `≥44px` e teclado (III), não introduzem JS novo (IV) e
mantêm o escopo de apresentação com stories/testes (II). Gates permanecem verdes; Complexity
Tracking continua não aplicável.

## Artefatos gerados

- `research.md` — resolves R-01..R-06 (Phase 0)
- `data-model.md` — sem entidades de dados (apresentação apenas)
- `contracts/README.md` — nenhuma mudança de interface externa
- `quickstart.md` — guia de validação end-to-end
