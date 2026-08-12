# Quickstart & Validation Guide: Gerar mais cenas (contagem variável 3–5)

Guia de validação end-to-end da contagem variável de cenas (3/4/5) sobre o fluxo existente
(form → geração → leitura → exportação), em pt-BR e English, com o provider determinístico (sem IA
live).

## Pré-requisitos

- `pnpm install`
- `.env.local` com `STORIES_PROVIDER=fake` para execução determinística (gitignored).
- Chromium nativo: `pnpm exec playwright install --with-deps chromium` (ou
  `sh scripts/setup-chromium-deps.sh`).

## Setup

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## Referências de comprimento por faixa etária

Pesquisa de mercado (ver `research.md`): para este produto, **1 cena ≈ 1 spread/ilustração** de
livro ilustrado, não 1 página impressa. A faixa **3–5 cenas** é coerente — os menores (2–4) leem
histórias curtas (3 cenas, ~4–12 min), enquanto 5–7 e 8–12 sustentam 4–5 cenas confortavelmente
(~10–15 min). Valores acima de 5 ficam fora de escopo.

## Validação end-to-end da contagem de cenas

### 1. Seleção de contagem no formulário (P1)

```bash
pnpm dev            # ou pnpm test:e2e
```

**Cenário**: em `/`, o responsável escolhe **3, 4 ou 5** cenas (padrão **3** pré-selecionado),
com rótulo localizado ("Quantas cenas?" / "How many scenes?"). Gera uma história.

**Esperado**: a seleção envia `ageBand`/`locale`/`theme`/`sceneCount` (inteiro anônimo); o payload
continua **sem nome/idade exata**; a história retornada tem exatamente o número escolhido de cenas.

### 2. Leitura "Cena X de Y" refletindo a contagem real

Abra uma história gerada com 4 ou 5 cenas.

**Esperado**: o leitor exibe "Cena X de Y" com **Y real** (4/5) e permite navegar por todas as
cenas (setas/teclas); nenhuma contagem fixa "3"; foco voltado à nova cena na navegação.

### 3. Exportação de PDF sem truncamento

Gere histórias de 3, 4 e 5 cenas e acione "Baixar como PDF" em cada uma.

**Esperado**: o PDF inclui **todas** as cenas na ordem (número de páginas = número de cenas); nada
é cortado em 3; ilustrações convertidas (PNG) por página.

### 4. Dimensionamento de tempo (FR-008) e nenhuma resposta parcial

Histórias de 5 cenas (caso mais lento) são geradas **dentro do teto** (≤120s) e nunca devolvem um
conjunto parcial (SC-001, FR-005, SC-004).

**Esperado**: se uma cena falhar, a geração inteira falha com erro localizado/retryable — nunca um
"sucesso" com menos cenas do que o solicitado.

### 5. Retrocompatibilidade (FR-003)

Envie uma requisição **sem** `sceneCount` (cliente v1).

**Esperado**: comportamento idêntico ao v1 — o servidor assume **3** cenas (contrato).

### Qualidade automatizada

```bash
pnpm storybook:test      # a11y por story (wcag A/AA) + estados default/edge/error
pnpm test                # unit/integration determinísticos (contagens 3/4/5)
pnpm test:coverage       # gates de cobertura
pnpm test:e2e            # jornadas pt-BR + EN (provider fake)
pnpm test:visual         # regressão visual (sem diff não-intencional)
pnpm test:performance    # budgets (JS ≤250 KiB, LCP ≤2.5s, nav ≤100ms, geração ≤120s @ 5 cenas)
```

## Contrato & dados

- **Contrato**: `contracts/story-generation.openapi.yaml` — campo `sceneCount` (3–5, default 3,
  optional na requisição); resposta com 3–5 cenas; `Cache-Control: no-store`.
- **Dados**: nenhuma entidade persistida; `sceneCount` é um inteiro anônimo em memória/sessão; ver
  `data-model.md`.

## Assinatura do invariante (FR-009 / SC-006)

A feature mantém: anonimato (sem nome/idade exata/identificador — `sceneCount` é só um inteiro
anônimo), acessibilidade AA, foco voltado, `prefers-reduced-motion`, `Cache-Control: no-store` e
budgets de performance dimensionados por contagem. Nenhum teste referencia dados de criança ou
chama IA live.
