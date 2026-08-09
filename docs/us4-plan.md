# US4 — Localização EN (pt-BR + en) — Plano de execução

Branch: `feat/phase-4-i18n-english` (base: main, merge PR #7)

## Gap real vs estado herdado da Fase 3

- ✅ T052 — schema aceita `pt-BR|en`, rejeita outros; rota retorna 422 `unsupported_locale` antes do provider (schema + route tests) — já pronto.
- ✅ T057 — provider já faz branching por locale (narrativa/título/alt-text via `locale === "en"`) — já pronto.
- ❌ T055 — só existe `pt-BR.json`; `getMessages()` sempre retorna pt-BR.
- ❌ T056 — `getMessages()` não é locale-aware; falta retorno localizado p/ locale não suportado (UX).
- ❌ T053 — jornada E2E `generate-english.spec.ts` não existe.
- ❌ T054 — Storybook sem casos em EN.

## Ordem de execução (test-first)

1. **T055** — criar `locales/en.json` espelhando `pt-BR.json`.
2. **T056** — tornar `getMessages(locale)` locale-aware (en→en.json, pt-BR/outros→pt-BR); atualizar `request.ts`.
3. **T052 (completar)** — teste de catálogo EN espelha estrutura pt-BR.
4. **T053** — `tests/e2e/generate-english.spec.ts` (age 9, friendship, EN, fake provider).
5. **T054** — casos Storybook pt-BR/EN (default/edge/error) + a11y.
6. Verificação: typecheck, lint, format, test, coverage, build, e2e pt-BR+EN, storybook.
