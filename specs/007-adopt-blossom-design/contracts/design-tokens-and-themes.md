# Contracts — Design system e frontend do story-blossom-room

**Phase 1 output** — contratos de interface tocados por esta entrega.

Dois conjuntos:

1. **Contrato externo (público) — `POST /api/stories`**: o **enum `theme`** é expandido de 3 para
   6 valores. O **shape** de `request`/`GeneratedStory`, códigos de erro e `Cache-Control: no-store`
   permanecem **intactos** — apenas o conjunto de valores válidos de `theme` cresce (SC-007).

2. **Contrato de identidade (tokens)**: os tokens semânticos em `globals.css`/`tailwind.config.ts`
   que todas as primitivas consomem; e o **catálogo de temas** derivado tipado.

## 1. Contrato externo: `POST /api/stories`

Formato conforme `specs/002-generate-more-scenes/contracts/story-generation.openapi.yaml`
(referência; **não reescrito aqui**). Esta entrega apenas **amplia o enum de `theme`**.

### 1.1 Request

```
POST /api/stories
Cache-Control: no-store
{
  "ageBand": "2-4" | "5-7" | "8-9",
  "locale":  "pt-BR" | "en",
  "theme":   "courage" | "friendship" | "kindness"
             | "curiosity" | "perseverance" | "empathy",   // ← 3 novos
  "sceneCount": 3 | 4 | 5
}
```

- `theme` agora aceita os **3 novos valores**: `curiosity`, `perseverance`, `empathy`.
- Nenhum novo campo; nenhum identificador introduzido.

### 1.2 Response

- `200` → `GeneratedStory` (mesmo shape, até 5 cenas com narrativa + ilustrações). **Invariante.**
- `400` → `invalidInput` quando `theme` não está nos 6 (mesma resposta localizada atual).
- Erros de geração/segurança → mesmas famílias localizadas (`safeAlternativeUnavailable`,
  `generationUnavailable`, `rateLimited`, etc.). **Invariante.**

### 1.3 Invariantes de privacidade

- `theme` é categoria anônima; os 3 novos não carregam dado pessoal.
- `Cache-Control: no-store`; `POST /api/stories` continua o único entry-point de geração.

## 2. Contrato de identidade visual (tokens semânticos)

Todas as primitivas/features referenciam **tokens semânticos**, nunca hex/valores arbitrários em
componentes.

| Token (CSS var) | Registro | Consumidores |
|-----------------|----------|--------------|
| `--color-background/surface/text/text-subtle` | `:root` | base `body`, cards |
| `--color-text-subtle` | `:root` | captions |
| `--color-accent`/`-hover` | `:root` | `Button primary`, focos (primário atual) |
| `--color-secondary`/`-foreground` | `:root` (novo) | chips/pills, botões secundários |
| `--color-muted`/`-foreground` | `:root` (novo) | texto muted |
| `--color-focus` | `:root` | `:focus-visible` outline |
| `--color-success/warning/danger` | `:root` | `Alert` variants |
| `--color-border`/`input`/`ring` | `:root` (novo) | inputs, foco |
| `--font-display` | `:root` + `next/font` | `h1–h3`, títulos |
| `--font-sans` | `:root` + `next/font` | corpo |
| `--radius` (e derivados) | `:root` | cards, botões, inputs |
| `--shadow-soft`/`--shadow-lift` | `:root` | cards, CTA, hover |
| `--motion-fast/base/slow` | `:root` | transições (respeitam reduced-motion) |

**Modo escuro**: mesmos tokens redefinidos em `@media (prefers-color-scheme: dark)` (padrão) e
manual via `.dark`/`.light` (in-session, sem persistência) — todos com AA ≥4.5:1.

## 3. Catálogo de temas (contrato derivado)

`themeCatalog` (em `lib/story-catalog.ts`) expõe, para cada um dos **6** `Theme`, `{value, label,
description}`. A UI renderiza o card de tema com **emoji do protótipo** + nome + descrição, usando
as strings localizadas de `catalog.theme.*` / `catalog.themeDescription.*` (pt-BR/en).

**Garantia**: o catálogo é **derivado de `themeValues`**, portanto nunca diverge do enum validado
pelo servidor (`themeSchema`) — um tema fora dos 6 quebra `typecheck`/teste de catálogo, não a
runtime.

## Versionamento

- **Alterado**: enum `theme` em `POST /api/stories` (3→6). Registrado em `data-model.md` e no trecho
  `story-generation.openapi.yaml` de temas (atualizar no implement).
- **Preservado**: shape de request/response, códigos de erro, endpoints, `no-store`,
  `POST /api/stories` como único entry-point, e o contrato de áudio `POST /api/narrate`.
