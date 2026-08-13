# Quickstart & Validation Guide: Melhorias de UX

Este guia valida as melhorias de experiência end-to-end sobre o fluxo existente (form → geração → leitura → exportação), em pt-BR e English, com o provider determinístico (sem IA live).

## Pré-requisitos

- `pnpm install`
- `.env.local` com `STORIES_TEST_MODE=fake` para execução determinística (gitignored).
- Chromium nativo: `pnpm exec playwright install --with-deps chromium` (ou `sh scripts/setup-chromium-deps.sh`).

## Setup

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## Validação end-to-end das melhorias

### 1. Escolha visual de tema (P1)

```bash
pnpm dev            # ou pnpm test:e2e
```

**Cenário**: em `/`, cada tema (Coragem/Amizade/Bondade em pt-BR; Courage/Friendship/Kindness em EN) aparece como seleção visual com rótulo e descrição no idioma ativo. Seleção envia somente `ageBand`/`locale`/`theme`.

**Esperado**: rótulos/descrições localizados; payload anônimo; sem campo de nome.

> **Interação em testes (E2E/Storybook)**: o tema é um grupo de `ChoiceCard` (botões `aria-pressed` em um `fieldset`), não mais um `<select>`. Locators devem clicar no card pelo nome acessível (ex.: `getByRole('button', { name: /^Coragem/i })`) em vez de `selectOption`. (Os testes E2E de 001→003 foram atualizados neste padrão; manter ao alterar.)

### 2. Leitura em voz alta (P1)

Abra uma história gerada e acione o controle de leitura da cena.

**Esperado**: a cena é lida no idioma ativo; um controle mostra o estado (pronto/lendo); trocar de cena interrompe a fala anterior; nenhuma rede envolvida (conteúdo não sai do dispositivo).

### 3. Indicador de progresso de cena (P2)

Em uma história (3, 4 ou 5 cenas), navegue entre as cenas.

**Esperado**: um indicador visual mostra a posição atual (ex.: 1/3, 2/4, 3/5) refletindo o **total real de cenas (3–5 variável)** (Clarification 2026-08-12) e acompanha a navegação; estático (sem animação) respeitando `prefers-reduced-motion`; coerente com o texto "Cena X de Y".

### 4. Feedback de exportação de PDF (P2)

Acione "Baixar como PDF" numa história.

**Esperado**: estado "Gerando PDF…" durante o processo; em falha, mensagem compreensível localizada com opção de nova tentativa; em sucesso, download disparado com as ilustrações (PNG).

### 5. Modo escuro (P2)

Alterne a preferência de cor do sistema (claro/escuro) e/ou use o alternador manual.

**Esperado**: a UI troca de tema seguindo o sistema, preservando contraste AA e sem coletar dados. Há também um **alternador manual transitório na sessão** (sem persistência): ao recarregar, a preferência volta a seguir o sistema (Clarification 2026-08-12).

### Qualidade automatizada

```bash
pnpm storybook:test      # a11y por story (wcag A/AA) + estados default/edge/error
pnpm test                # unit/integration determinísticos
pnpm test:coverage       # gates de cobertura
pnpm test:e2e            # jornadas pt-BR + EN (provider fake)
pnpm test:visual         # regressão visual (sem diff não-intencional)
pnpm test:performance    # budgets (JS ≤250 KiB, LCP ≤2.5s, nav ≤100ms, geração ≤120s)
```

## Contrato & dados

- **Contratos**: sem novas APIs externas — apenas contratos de UI (estados acessíveis); ver `data-model.md`.
- **Dados**: nenhuma entidade persistida; tudo em memória/sessão/preferência do sistema; ver `data-model.md`.

## Assinatura do invariante (FR-UX-999)

Todas as melhorias mantêm: anonimato (sem nome/idade exata/identificador), acessibilidade AA, foco voltado, `prefers-reduced-motion` e budgets de performance. Nenhum teste referencia dados de criança ou chama IA live.
