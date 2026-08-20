# Data Model: Mobile UX Refinements

**Branch**: `016-mobile-ux-refinements` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Principle**: Esta feature é **puramente de apresentação**. Não há novas entidades, campos,
relações, validações de dados nem transições de estado. Nenhuma mudança no modelo de dados do
projeto (o modelo existente — `ageBand | locale | theme | sceneCount` para histórias, sessão
OAuth stateless, hash anônimo de IP para rate-limit — permanece **inalterado**).

## Entidades

Nenhuma. A spec omitiu `Key Entities` por design apropriado (ver `spec.md`).

### Notas

- **Validations**: não há inputs novos; o payload de pedido continua `Zod .strict()` válido como já
  está, sem ampliação de superfície.
- **State transitions**: nenhuma — os componentes alterados mantêm seus estados atuais
  (`selected`/`busy`/`disabled` etc.), apenas com classes de apresentação ajustadas.

---

# Dados de UI envolvidos (referência, sem mudança)

String localizadas existentes usadas nas superfícies afetadas (via catálogos next-intl `pt-BR` +
`en`):

| Chave | pt-BR | en |
|-------|-------|----|
| `theme.<value>.name + .description` | "Amizade – Faça amigos verdadeiros…" | "Friendship – …" |
| `language.*` (nome de idioma) | "Português (Brasil)" | "English" |
| `sceneCount.unit` | "cenas" | "scenes" |
| `story title` | conteúdo gerado/fake (qualquer comprimento) | idem |

Estas strings **não são alteradas**; apenas a forma como se dispõem (quebra/densidade) muda.
