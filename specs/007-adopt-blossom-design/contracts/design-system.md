# Design System — Identidade visual portada do story-blossom-room

**Tipo**: Contrato/estudo de identidade visual (fonte de verdade para o implement do spec 007).
**Fonte**: `story-blossom-room` (`src/styles.css` + padrões de uso em `src/routes/index.tsx`).
**Relacionado**: `research.md` (§1/§2/§5), `data-model.md` (§2), `tasks.md` (Phase 2, US1/US3/US5/US6).

Este documento **extrai e fixa os valores concretos** do protótipo para que a implementação em
`storybook-ai` não precise reinventar as decisões. Aplica-se a `globals.css`/`tailwind.config.ts`
(Nexo do spec), às primitivas `components/ui` e às features `story-request`/`story-reader`/
`story-read-aloud`/`story-export`/`theme`.

> **Uma regra inegociável (Constitution/AGENTS.md)**: componentes referenciam **apenas tokens
> semânticos** — nunca hex/quaisquer literais. Abaixo, o mapeamento token → valor serve p/ registrar
> os tokens; o código usa os nomes semânticos (`bg-primary`, `text-muted-foreground`, `rounded-3xl`,
> `shadow-lift`, etc.).

---

## 1. Princípios da identidade

- **Acolhedor e lúdico, porém legível**: paleta quente (creme/coral/terracota) com acento fresco de
  teal para contraste pontual; contraste AA (≥4.5:1) obrigatório em texto normal, claro e escuro.
- **Organicidade cuidadosa**: raios amplos (cards `rounded-4xl` no contexto de painel) e sombras
  suaves criam profundidade "de papel" sem competir com o texto.
- **Família tipográfica dual**: display redonda (`Baloo 2`) para títulos/nomes, corpo legível
  (`Nunito`) para leitura longa.
- **Moção de propósito**: transições curtas (hover `-translate-y-0.5`, `transition-all`) para
  affordance; nada que impeça `prefers-reduced-motion`.
- **Anônimo desde o molho**: nenhum identificador; emoji/ícones são apresentação, nunca dado.

---

## 2. Cores semânticas (oklch) — valores extraídos do protótipo

Formato **obrigatório**: `oklch`. Valores de `:root` (claro) e `.dark`.

### 2.1 Paleta claro (`:root`)

| Token semântico | Valor oklch | Papel |
|-----------------|-------------|-------|
| `--background` | `oklch(0.977 0.014 84)` | fundo creme claro |
| `--foreground` | `oklch(0.27 0.04 45)` | texto principal (terracota escuro) |
| `--card` | `oklch(0.995 0.006 84)` | superfície de card |
| `--card-foreground` | `oklch(0.27 0.04 45)` | texto sobre card |
| `--popover` | `oklch(0.995 0.006 84)` | popover/overlay |
| `--popover-foreground` | `oklch(0.27 0.04 45)` | texto sobre popover |
| `--primary` | `oklch(0.58 0.17 32)` | coral/terracota (CTA, ênfase forte) |
| `--primary-foreground` | `oklch(0.99 0.008 84)` | texto/pico sobre primary (quase-branco quente) |
| `--secondary` | `oklch(0.94 0.03 80)` | superfície secundária (chips, fundos suaves) |
| `--secondary-foreground` | `oklch(0.33 0.05 45)` | texto sobre secondary |
| `--muted` | `oklch(0.945 0.022 82)` | fundo muted |
| `--muted-foreground` | `oklch(0.46 0.035 55)` | texto secundário/caption |
| `--accent` | `oklch(0.72 0.12 175)` | **teal** (acento fresco, p.ex. estágios concluídos) |
| `--accent-foreground` | `oklch(0.22 0.04 180)` | texto sobre accent |
| `--destructive` | `oklch(0.55 0.2 27)` | erro/desconstrutivo |
| `--destructive-foreground` | `oklch(0.99 0.005 84)` | texto sobre destructive |
| `--border` | `oklch(0.89 0.025 78)` | bordas de composição |
| `--input` | `oklch(0.89 0.025 78)` | borda de inputs |
| `--ring` | `oklch(0.58 0.17 32)` | anel de foco (`:focus-visible`) |

### 2.2 Paleta escura (`.dark`)

| Token | Valor oklch | Nota de AA |
|-------|-------------|------------|
| `--background` | `oklch(0.21 0.022 55)` | marrom-escuro quente |
| `--foreground` | `oklch(0.95 0.015 84)` | texto claro quente |
| `--card` | `oklch(0.26 0.026 55)` | card escuro |
| `--card-foreground` | `oklch(0.95 0.015 84)` | |
| `--popover` | `oklch(0.26 0.026 55)` | |
| `--popover-foreground` | `oklch(0.95 0.015 84)` | |
| `--primary` | `oklch(0.76 0.14 45)` | coral mais claro no dark p/ AA |
| `--primary-foreground` | `oklch(0.21 0.03 45)` | texto escuro sobre primary claro |
| `--secondary` | `oklch(0.32 0.03 55)` | |
| `--secondary-foreground` | `oklch(0.95 0.015 84)` | |
| `--muted` | `oklch(0.31 0.026 55)` | |
| `--muted-foreground` | `oklch(0.79 0.025 80)` | |
| `--accent` | `oklch(0.78 0.11 175)` | teal mais claro no dark |
| `--accent-foreground` | `oklch(0.2 0.03 180)` | |
| `--destructive` | `oklch(0.7 0.18 25)` | |
| `--destructive-foreground` | `oklch(0.16 0.02 45)` | |
| `--border` | `oklch(0.38 0.03 55)` | |
| `--input` | `oklch(0.38 0.03 55)` | |
| `--ring` | `oklch(0.76 0.14 45)` | |

> **Mapeamento p/ o app atual (storybook-ai)**: o app usa `--accent` (hoje roxo `#5b21b6`) como o
> **primário** da UI (p.ex. `Button primary → bg-accent`). O protótipo separa `primary` (coral) de
> `accent` (teal). Decisão: **adotar a taxonomia do protótipo** (`primary`=coral, `secondary`, `muted`,
> `accent`=teal) e remapear as referências existentes do `accent`-primário para `primary`. Registrar a
> equivalência em `tasks.md` US6 (T047/T048) e referenciar este contrato. AA deve ser revalidado.

---

## 3. Tipografia (famílias e uso)

| Token | Família | Papel | Pesos usados no protótipo |
|-------|---------|-------|---------------------------|
| `--font-display` | `"Baloo 2", ui-rounded, system-ui, sans-serif` | `h1–h3`, nomes, números, badges | 700/800 (bold/extrabold) |
| `--font-sans` | `"Nunito", ui-sans-serif, system-ui, sans-serif` | corpo, rótulos, botões | 400/700 |

Aplicação base (`styles.css`): `body {font-family:var(--font-sans)}`; `h1,h2,h3 {font-family:
var(--font-display)}`. No `storybook-ai`, carregar via `next/font` (self-hosted) — ver `research.md` §2.

### Escala de textos usada no protótipo (referência de densidade)

| Papel | Escala Tailwind | Família/tratamento |
|-------|-----------------|--------------------|
| Título de tela (form) | `text-4xl font-extrabold tracking-tight sm:text-5xl` | display |
| Título de card de tema | `font-display text-xl font-bold` | display |
| Legendas de seção | `font-display text-lg font-bold` | display |
| Título de cena (reader) | `text-3xl font-extrabold tracking-tight` | display |
| Corpo de cena | `text-lg leading-relaxed text-foreground/90` | sans |
| Texto leve/muted | `text-sm text-muted-foreground` | sans |
| Micro (tagline) | `text-xs text-muted-foreground` | sans |
| Nº de estágio (badge) | `text-xs font-bold` | sans |

---

## 4. Raio (escala derivada de `--radius: 1.25rem`)

| Token | Valor |
|-------|-------|
| `--radius-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `var(--radius)` (= 1.25rem) |
| `--radius-xl` | `calc(var(--radius) + 4px)` |
| `--radius-2xl` | `calc(var(--radius) + 8px)` |
| `--radius-3xl` | `calc(var(--radius) + 12px)` |
| `--radius-4xl` | `calc(var(--radius) + 16px)` |

Uso usual no protótipo:
- **Painéis grandes** (geração, card de cena, barra lateral): `rounded-4xl`.
- **Cards de tema**: `rounded-3xl`.
- **Controles em linha** (botão prev/next/ler, inputs, tags): `rounded-2xl`/`rounded-xl`.
- **Badges minúsculos / dots**: `rounded-full`.
- **Logo/Toggle ao redor do topo**: `rounded-2xl`.

---

## 5. Sombras

| Token | Valor |
|-------|-------|
| `--shadow-soft` | `0 2px 10px -4px oklch(0.4 0.06 45 / 0.18)` (claro) / `0 2px 10px -4px oklch(0 0 0 / 0.5)` (escuro) |
| `--shadow-lift` | `0 18px 40px -18px oklch(0.4 0.08 45 / 0.35)` (claro) / `0 18px 40px -18px oklch(0 0 0 / 0.6)` (escuro) |

Uso no protótipo:
- **`shadow-soft`**: cards em repouso (tema não-selecionado, barra lateral, painel de tradução).
- **`shadow-lift`**: painéis de destaque (tela de geração, card de cena no reader), card de tema
  **selecionado**, logo da marca.

---

## 6. Foco & acessibilidade

- Base (`styles.css`, `@layer base`): `:focus-visible { outline:3px solid var(--color-ring);
  outline-offset:2px }`; e `* { border-color: var(--color-border) }`.
- Componentes selecionáveis (card de tema, toggle dark, lang, ler-acima) usam **`aria-pressed`** +
  estado visual claro (borda primária + `shadow-lift`).
- Estados de carregamento/gerro: `aria-busy="true"` + `aria-live="polite"` na tela de geração;
  `aria-disabled`/`disabled:opacity-40` nos botões de borda.
- Contraste: revalidar AA na paleta nova (claro e escuro) — `background`/`foreground`,
  `card`/`card-foreground`, `muted-foreground` sobre `background`, `secondary-foreground`.

---

## 7. Padrões de componentes (aplicados nas telas)

Derivados de `routes/index.tsx`; cada um reimplementado nas primitivas/features de `storybook-ai`,
preservando states/stories (ver `tasks.md`).

### 7.1 Top bar (marca + idioma + tema)
```
header max-w-5xl grid-cols-[1fr_auto] gap-3 px-4 py-5
├─ botão home: size-11 rounded-2xl bg-primary text-primary-foreground shadow-soft
│     ícone BookOpenText size-6  +  nome (font-display text-lg bold) + tagline (text-xs muted)
└─ grupo: LangToggle (rounded-2xl border bg-card p-1; opção ativa bg-primary text-primary-foreground)
          + toggle dark (size-11 rounded-2xl border bg-card; ícone Sun/Moon size-5, aria-pressed)
```
→ tasks US6 (T046/T047) + US5 (T043).

### 7.2 Card de tema (formulário)
```
button rounded-3xl border-2 bg-card p-5 text-left transition-all hover:-translate-y-0.5
  aria-pressed={on}
  on:   border-primary shadow-lift
  off:  border-border shadow-soft hover:border-primary/50
├─ emoji text-3xl (aria-hidden)
├─ nome  font-display text-xl font-bold
├─ desc  text-sm text-muted-foreground
└─ barra `h-1.5 w-10 rounded-full` bg-primary (on) | bg-border (off)
```
Grid de temas: `grid gap-4 sm:grid-cols-3`. Emoji por tema (tabela §8).
→ tasks US1 (T025/T026).

### 7.3 Tela de geração (progresso)
```
section mx-auto max-w-xl rounded-4xl border border-border bg-card p-8 text-center shadow-lift
  aria-busy="true" aria-live="polite"
├─ ícone: size-24 rounded-full bg-secondary + Loader2 size-10 animate-spin text-primary
├─ título text-2xl font-bold ; hint text-sm text-muted-foreground
├─ barra: h-3 rounded-full bg-secondary, fill h-full rounded-full bg-primary transition-all
│     width % = ((stage+1)/3)*100
├─ estágios (ol): badge size-7 rounded-full text-xs font-bold
│     concluído: bg-accent text-accent-foreground "✓" | atual: bg-primary text-primary-foreground
│     futuro: bg-secondary text-muted-foreground
└─ aviso bloqueio: p mt-6 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground
```
→ tasks US2 (T031).

### 7.4 Leitor (carta de cena + progresso + controles)
```
article rounded-4xl border border-border bg-card shadow-lift overflow-hidden
├─ imagem aspecto[4/3] bg-secondary + badge tema `rounded-full bg-card/90 px-3 py-1 text-xs font-bold backdrop-blur`
├─ corpo p-6 sm:p-8
│   ├─ linha superior: "Cena X de Y" text-sm font-bold text-muted-foreground + dots (h-2 rounded-full;
│   │     atual w-8 bg-primary ; demais w-2 bg-border)
│   ├─ h1 text-3xl font-extrabold tracking-tight  ;  corpo text-lg leading-relaxed
│   └─ controles (min-h-12 rounded-2xl font-bold, disabled:opacity-40):
│       Prev: border bg-card hover:bg-secondary            |  Ler: bg-secondary hover:brightness-95 (aria-pressed)
│       Next: bg-primary text-primary-foreground hover:brightness-105
├─ rodapé (border-t bg-secondary/60): "nova história" text-sm bold muted; "Baixar PDF" min-h-11
│     rounded-2xl border bg-card text-sm bold
└─ barra lateral `rounded-4xl border bg-card p-4 shadow-soft` (histórias da sessão, thumb size-12
      rounded-xl, item ativo border-primary bg-secondary + aria-current)
```
→ tasks US3 (T036-T039) + US5 (modo escuro).

---

## 8. Emoji por tema (apresentação, não identificador)

| Chave (categoria anônima) | Emoji | Ícone Lucide p/ núcleo |
|---------------------------|-------|------------------------|
| `coragem` | 🦁 | Sparkles |
| `amizade` | 🦊 | HeartHandshake |
| `bondade` | 🌷 | Heart |
| `curiosidade` | 🔭 | Sparkles |
| `perseveranca` | 🐢 | Sparkles |
| `empatia` | 🫧 | HeartHandshake |

> O emoji é **decorativo** (`aria-hidden`); o nome/descrição localizada do catálogo é o conteúdo.
> Nada aqui é dado pessoal.

---

## 9. Layout & densidade

- **Container de conteúdo**: `max-w-5xl` (app) com `px-4 sm:px-6`; formulário usa `space-y-8` e
  blocos `max-w-xl` para seções internas.
- **Grid do leitor**: `grid gap-6 lg:grid-cols-[1fr_16rem]` (conteúdo + barra lateral de histórias).
- **Formulário**: fieldset de temas `grid gap-4 sm:grid-cols-3`; controles em `max-w-xl`.
- **Mobile-first**: layouts colapsam para 1 coluna; densidade de toque `min-h-11/12`.

---

## 10. Moção (transições)

- `transition-all` nos cards de tema; hover `hover:-translate-y-0.5` (affordance).
- `transition-colors` em controles/links e `transition-all` (dots).
- Barra de progresso: `transition-all duration-700` (avanço suave entre estágios).
- Respeitar `prefers-reduced-motion` (reduzir translate/opacity de transição conforme constitution).

---

## 11. Checklist de aplicação (para o implement)

- [ ] `globals.css`/`tailwind.config.ts`: registrar Cores (§2), Fontes (§3), Raios (§4), Sombras
      (§5), Foco (§6) — todos em **oklch** e **tokens semânticos**.
- [ ] Remapear `accent`-primário antigo → `primary` (corai), mover teal para `accent` (§2 nota),
      revalidar AA claro+escuro.
- [ ] `next/font`: Baloo 2 (display) + Nunito (sans) — self-hosted (research §2).
- [ ] Reimplementar Top bar (§7.1), Theme card (§7.2), Geração (§7.3), Leitor (§7.4) nas features,
      com emojis (§8) e densidade (§9/§10).
- [ ] Todos os componentes só usam tokens; nenhum literal de cor/raio/sombra em código.
- [ ] Emoji `aria-hidden`; `aria-pressed`, `aria-busy`, `aria-live`, foco visível intactos.
- [ ] Modo escuro (§2.2) ativo em formulário, geração e leitor, sem persistência.
- [ ] Gates: `lint`/`format:check`/`typecheck`/`storybook:test`/`test:visual`/`test:performance`.
