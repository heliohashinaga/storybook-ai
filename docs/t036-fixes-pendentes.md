# T036 + Fixes pendentes — Resolvido

> **Status**: ✅ **implementado e verificado** (registro histórico). Os 3 fixes
> abaixo foram aplicados em `main`; os gates (lint, typecheck, format, unit,
> coverage, E2E pt-BR/EN/T036, Storybook + a11y) passaram. A task T036 foi
> marcada `[x]` em `tasks.md`.

## Contexto

A T036 ("jornada E2E de navegação por teclado do leitor") estava marcada como
`[ ]` (não concluída) em `specs/001-personalized-story-generation/tasks.md`.

Ao conectá-la ao app, foram revelados **2 problemas reais** além da própria
spec não commitada. Este documento registra o diagnóstico e a resolução de cada
um.

---

## Fix 1 — Bug de layout no design system: `max-w-md` colapsa para 16px

**Sintoma**: toda a página renderiza com largura ~48px; os parágrafos do corpo
ficam com `width: 0`; o Playwright os reporta como `hidden` em `toBeVisible()`.

**Causa raiz** (verificado no CSS built antes e depois do fix):

```css
/* Antes — o utilitário resolvia para o token de espaçamento: */
.max-w-md {
  max-width: var(--space-md);
} /* 16px, deveria ser ~448px (container-md) */

/* Depois — cadeia correta: */
.max-w-md {
  max-width: var(--max-width-md);
}
--max-width-md: var(--container-md) /* @theme bridge, globals.css */ --container-md: 28rem
  /* token semântico em :root */;
```

O motivo é sutil: no Tailwind v4, `max-w-*` resolve valores nomeados na ordem
`--max-width` → `--spacing` → `--container`. Como o config legacy estende a
escala de espaçamento com chave `md` (`--space-md`), o namespace `spacing`
**sombreia** o `container` — por isso `max-w-md` virava 16px mesmo com um token
de container definido. O config legacy não alcança o primeiro namespace
(`--max-width`), então o bridge foi feito via `@theme` em `globals.css`.

**Impacto**: bug pré-existente que afeta a app inteira, não só o T036. Não foi
detectado antes porque os testes pt-BR/EN usam `innerText()`/`getAttribute('alt')`
(que funcionam mesmo com layout colapsado); só o T036 usa `toBeVisible()`, que
exige bounding box real.

**Resolução**:

1. Token semântico `--container-md: 28rem` adicionado ao `:root` em
   `src/app/globals.css` (junto da escala de espaçamento).
2. Bridge v4-native em `globals.css`: `@theme { --max-width-md: var(--container-md); }`
   com comentário explicando a ordem de resolução e o sombreamento.
3. `tailwind.config.ts` ganhou nota no header explicando por que `max-w-*`
   nomeado **não** é configurado lá (o compat legacy não alcança `--max-width`).
4. Componentes continuam consumindo só tokens (`max-w-md`), sem `max-w-[...]`
   ad-hoc (regra do design-system: tokens only).
5. Confirmado no CSS built + suíte completa verde.

---

## Fix 2 — Testes E2E pt-BR/EN desatualizados (expectativa de layout)

**Sintoma**: após conectar o `StoryReader`, `tests/e2e/generate-pt-br.spec.ts` e
`tests/e2e/generate-english.spec.ts` passaram a **falhar**.

**Causa**: esses testes foram escritos contra a **lista plana das 3 cenas**
(esperavam `img count 3` + um `<section>` com todas as cenas), mas o `StoryReader`
(por design, T040) mostra **1 cena por vez** com navegação prev/next + contador.

**Resolução**:

1. `generate-pt-br.spec.ts`: loop por cena com `img count 1`, contador
   `"Cena X de 3"`, alt text localizado por cena, checagem de marcadores/identificadores
   por cena, e bound (botão "next" disabled na última cena).
2. `generate-english.spec.ts`: mesmo padrão, mas com o detalhe de que o **chrome
   do reader (região, botões, contador) é pt-BR por design** (UI pinada em
   `pt-BR` no layout; o `locale` do form controla só o idioma da história — US4).
   Os seletores de chrome são **agnósticos de idioma** (`/Sua história|Your story/`,
   `/Próxima cena|Next scene/`, contador via regex `(Cena|Scene) X (de|of) 3`);
   as asserções de conteúdo (texto, alt, ausência de diacríticos, `\bstar\b`) são
   em inglês, vindas do provider fake.
3. **Contrato de privacidade preservado** em ambos: payload só
   `ageBand`/`locale`/`theme`, `no-store`, sem identificadores.
4. O mesmo desalinhamento existia no tier unit: `tests/unit/story-request-app.test.tsx`
   esperava 3 imgs — atualizado para o comportamento 1-cena-por-vez (com navegação
   e bound), mantendo as asserções de payload.

---

## Fix 3 — Spec T036 não commitada + restos do trabalho

**Estado inicial**:

- `tests/e2e/story-reader-navigation.spec.ts` estava **untracked** (nunca
  commitada). A task T036 seguia `[ ]`.
- O `StoryReader` já existia e foi **conectado ao app** em
  `src/features/story-request/components/story-request-app.tsx` (substituindo a
  lista plana), mas a fiação ficou sem commit.

**Resolução**:

1. T036 verde (navegação por setas ←/→, foco no `h2`, contador, bounds,
   resume em memória, privacy no reload) junto com a suíte E2E completa.
2. Task T036 marcada `[x]` em `tasks.md` (linha da task; a linha 283 é a tabela
   de referência, sem checkbox).
3. Coberturas verificadas: 94.7% stmts / 96.6% lines (≥80% geral; metas de
   safety/validation/orchestration ≥90% mantidas).

---

## Nota ambiental (máquina)

O desenvolvimento ocorre numa máquina com **múltiplas sessões pi ativas e load
elevado** (ex.: load 9–29 numa de 8 núcleos). Isso causa:

- `Timeout waiting for worker` no Vitest (pools forks) → usar
  `pnpm test:limited` (já documentado no AGENTS.md).
- Timeout de **launch do Chromium** (180s) no Playwright → rerun com a máquina
  mais livre, ou `--workers 1`.

Para validação confiável, rodar os E2E em momento de carga baixa
(`uptime` ≤ ~2) e de preferência com `--maxWorkers 1`.

---

## Checklist de conclusão

- [x] Fix 1: token de container `max-w-md` (bridge `@theme` em globals.css) → app largura normal
- [x] Fix 2: atualizar `generate-pt-br` + `generate-english` + unit test (1 cena por vez)
- [x] Fix 3: T036 verde, commit da spec + fiação, `[x]` na task
- [x] typecheck / lint / format limpos
- [x] build passa
- [x] E2E pt-BR + EN + T036 passam (5/5)
- [x] coverage ≥ metas (94.7% stmts, 96.6% lines)
- [x] Storybook (stories + a11y) passa (28/28, sem violações)
