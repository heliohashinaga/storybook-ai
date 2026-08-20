# Quickstart / Validação: Mobile UX Refinements

**Branch**: `016-mobile-ux-refinements` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

Guia para **validar end-to-end** que a feature atende aos outcomes da spec. Não contém
implementação nem suítes completas — para detalhes, ver [plan.md](plan.md), [research.md](research.md)
e `tasks.md` (na fase de implementação).

## Pré-requisitos

- `pnpm install` já executado (hooks/pre-commit instalados).
- Nenhum serviço de IA real: testes usam fakes/MSW. Nenhum `.env.local`/credencial commitada.

## Cenários validáveis (mapeamento spec)

| # | Cenário | Referência spec | Como validar |
|---|---------|-----------------|--------------|
| 1 | Sem overflow horizontal nem texto cortado a 320px/360px | FR-001, SC-001 | Viewport estreito no Storybook/app; nenhuma rolagem horizontal nem corte |
| 2 | Strings longas (tema, idioma, unidade) quebram limpo, pt-BR + en | FR-002, SC-002 | Inspecionar tema/idioma/cenas nas duas línguas em 360px |
| 3 | Título do reader legível (até 2 linhas), sem corte | FR-003, SC-004 | História com título longo no reader em mobile |
| 4 | Controles proporcionais mantendo alvo acessível `≥44px` | FR-004, SC-003 | Inspecionar tamanhos de alvo dos controles no mobile |
| 5 | Teclado/foco/semântica intactos; nada exclusivo de toque | FR-005 | Navegação por teclado + foco visível nos controles alterados |
| 6 | Storybook = app; default/edge/error | FR-006, Prínc. III | `storybook:test` verde; stories dos componentes alterados |
| 7 | Sem strings novas hardcoded; catálogos existentes | FR-007 | `grep`/pré-foco da code review |

## Comandos de validação

```bash
# Qualidade estática (pre-commit também roda):
pnpm lint            # 0 warnings
pnpm format:check    # sem drift (roda pnpm format ao editar arquivos)
pnpm typecheck       # TypeScript strict

# Testes:
pnpm test            # Vitest: unit + component + contract (fakes only)
pnpm storybook:test  # stories default/loading/error/edge + a11y

# Build + visual (baselines):
pnpm build
pnpm test:visual     # com baselines atualizados intencionalmente (--update-snapshots p/ diffs de intenção)
pnpm test:e2e        # Playwright pt-BR + EN, provider fake
```

## Matriz de dispositivos / viewport (mobile)

Validação de layout em telas pequenas via projetos do Playwright (opt-in, feature 016):

| Largura×Altura (px) | Projeto | Engine | Representa |
|---------------------|---------|--------|------------|
| 320×568 | `mobile-small` | Chromium | piso — SC-001/002 (feature 016) |
| 390×844 | `mobile-main` | Chromium | iPhone 13–16 / Android moderno |
| 430×932 | `mobile-large` | Chromium | Pro Max / grande |
| 768×1024 | `tablet-portrait` | Chromium | iPad retrato |
| 390×664 | `mobile-main-webkit` | WebKit | iOS Safari (390) |
| 375×667 | `mobile-small-webkit` | WebKit | iOS Safari (SE) |

Como rodar (a matriz é escopada a `tests/visual/**`):

```bash
# Chrome em 320/390/430/768 (visual/layout) — build de produção via pretest:visual:
E2E_MOBILE=1 pnpm test:visual

# + WebKit (engine do Safari) — instalar o navegador uma vez:
pnpm exec playwright install webkit
E2E_MOBILE=1 E2E_WEBKIT=1 pnpm test:visual

# Criar/atualizar os baselines visuais da matriz (após mudança intencional):
E2E_MOBILE=1 sh scripts/run-with-chromium.sh pnpm exec playwright test tests/visual --update-snapshots
```

> `E2E_MOBILE` é **opt-in**: sem ele a suíte roda somente no desktop Chromium (verde como
desde sempre). Os projetos WebKit só entram quando `E2E_WEBKIT=1` também está setado.

## Resultado esperado

- Nenhum texto volta a estourar/cortar em mobile (FR-001..003; SC-001,002,004).
- Controles mantêm alvo acessível e proporção no mobile sem regressão em desktop (FR-004; SC-003).
- A11y/stories/unit verdes; baselines visuais atualizados de forma intencional e commitados
  (SC-005).
- Sem mudança em API, privacidade, cookies ou bundle de rotas (Technical Context / contracts).

> Detalhes de contratos: esta feature não altera interface externa — ver `contracts/README.md`.
