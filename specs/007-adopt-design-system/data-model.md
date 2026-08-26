# Data Model: Design system e frontend do protótipo

**Phase 1 output** — entidades relevantes para a entrega: o conjunto de temas expandido (dado
anônimo) e os tokens de identidade visual (contrato de apresentação). Nenhum dado de usuário
persistente; tudo é em-memória/ derivado.

## 1. Tema de história (`Theme`) — ampliado 3 → 6

Categoria narrativa anônima escolhida pelo responsável. **Não é um dado pessoal**: é uma `enum`
categórica, o mesmo campo `theme` já enviado ao `POST /api/stories`.

| Atributo | Tipo | Notas |
|----------|------|-------|
| `value` | `Theme` (`string` literal union) | um dos 6 valores: `courage`, `friendship`, `kindness`, `curiosity`, `perseverance`, `empathy` |
| `label` | `string` (localizada) | nome de exibição via catálogo next-intl (`catalog.theme.*`) |
| `description` | `string` (localizada) | frase curta de apresentação (`catalog.themeDescription.*`) |
| `emoji` | `string` | emoji de apresentação no card (ex.: 🦁 🦊 🌷 🔭 🐢 🫧) — puramente visual, não identificador |

**Fontes tipadas (single source of truth, derivada)**, em ordem de autoridade:
- `themeValues` em `story-preferences-schema.ts` (client boundary).
- `themeSchema` (`z.enum`) em `schemas.ts` (server re-validation).
- `themeCatalog` em `story-catalog.ts` (derivado de `themeValues` — label + description).

**Mapeamento de intenção (pipeline)** — `purposeFor()` em `planner.ts` deriva um `movement` a cada
`Theme` (usado como hint de intenção por cena):

| `Theme` | `movement` (purpose) |
|---------|----------------------|
| `courage` | `bravery` |
| `friendship` | `friendship` |
| `kindness` | `kindness` |
| `curiosity` | `curiosity` |
| `perseverance` | `perseverance` |
| `empathy` | `empathy` |

**Regras de validação**:
- O servidor DEVE rejeitar qualquer `theme` fora dos 6 (`z.enum`) com erro `invalidInput`
  (mesmo fluxo atual).
- Nenhum `theme` novo acrescenta campo de dado pessoal; a payload continua `{ageBand, locale,
  theme, sceneCount}` anônima.
- O moderador de conteúdo é **agnóstico de tema** (content-based), portanto os 3 novos passam pela
  mesma pipeline de segurança sem ramificação extra.

**Transições de estado**: nenhuma — tema é valor fixo por pedido, não há máquina de estado.

## 2. Tokens de identidade visual (Design Tokens)

Contrato de apresentação consumido por todas as primitivas; definido em `globals.css` (`:root`,
`@media (prefers-color-scheme: dark)`, `:root.dark`, `:root.light`) e registrado no
`tailwind.config.ts` (`@theme` bridge). **Componentes referenciam apenas tokens semânticos.**

### 2.1 Cores (semânticas, oklch — quentes)

| Token | Uso | Racional
|-------|-----|--------|
| `--color-background` | fundo da página (creme claro / marrom-escuro em dark) | hospitalidade, AC |
| `--color-surface` | cards/painéis | contraste com fundo |
| `--color-text` / `--color-text-subtle` | texto normal/subtle | AA ≥4.5:1 |
| `--color-accent` / `--color-accent-hover` | coral/terracota vivo + hover | identidade do protótipo |
| `--color-secondary` / `--color-secondary-foreground` | superfícies secundárias (novo, do protótipo) | chips/pills |
| `--color-muted` / `--color-muted-foreground` | áreas muted (novo) | hierarquia |
| `--color-primary` / `--color-primary-foreground` | elemento primário (CTA) (novo) | equivalência funcional da `accent` atual |
| `--color-focus` | anel de foco | mapeia para o `ring` do protótipo |
| `--color-success/warning/danger` | estados semânticos | preservados |
| `--color-border` / `--color-input` | bordas/inputs | novo (do protótipo) |
| `--color-ring` | focus-visible | novo (do protótipo) |

> Nota de mapeamento: o design system atual usa `--color-accent` (purple) como o **primário** da UI
> (ex.: `Button primary → bg-accent`). O protótipo usa `--color-primary`. Para evitar ruptura total,
> o plano (research.md §1) **preserva a taxonomia semântica vigente** (`accent` continua sendo o
> primário; `text-subtle` etc.) e apenas troca os **valores** para oklch quente, adicionando tokens
> novos (`secondary`, `muted`, `primary` opcional) conforme necessário. A consolidação
> `accent`→`primary` é decisão de implementação, registrada como decisão de mapeamento neste
> contrato (§2) e em `tasks.md` (US6), sem quebrar AA.

### 2.2 Tipografia

| Token | Fonte | Uso |
|-------|-------|-----|
| `--font-display` | `"Baloo 2"` | `h1–h3`, títulos de card, numerais de cena |
| `--font-sans` | `"Nunito"` | corpo, rótulos, botões |

### 2.3 Radius / Shadow / Motion

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius` | `1.25rem` (novo base largo) | bordas de card grande |
| raios derivados | svm/md/lg/xl/2xl/3xl/4xl | hierarquia de cantos |
| `--shadow-soft` | sombra leve | cards em repouso |
| `--shadow-lift` | sombra elevada | card/hover selecionado, CTA |
| `--motion-fast/base/slow` | preservados | transições; respeitam `prefers-reduced-motion` |

## 3. Preferências de sessão (usuário — em-memória)

| Campo | Derivação | Enviado à API? |
|-------|-----------|----------------|
| `age` (exact) | apenas memória | não — vira `ageBand` |
| `ageBand` | `2-4 | 5-7 | 8-9` de `age` | sim |
| `locale` | `pt-BR | en` | sim |
| `theme` | os 6 valores | sim (categoria anônima) |
| `sceneCount` | `3-5` | sim |

Nenhum persistência; a escolha visual (claro/escuro) é em-memória, com precedência do sistema na
primeira carga.

## Relacionamentos

- `Theme` → indica a **categoria narrativa** usada em `POST /api/stories` e alimenta `purposeFor`.
- Design tokens → **estilizam** todas as primitivas (`components/ui`) e features, mas não são dados
  de domínio (não transitam na API).
- `themeValues`/`themeSchema`/`themeCatalog` → derivados do **mesmo union tipado** (sem drift).
