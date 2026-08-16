# Quickstart — Hardening de Segurança 2026

Guia rápido para começar a implementação da `010-security-hardening`.
Leia **este arquivo**, depois `spec.md` (o quê/porquê), `plan.md` (como) e
`tasks.md` (o que fazer, com checkboxes).

## Contexto

- **Fonte da verdade técnica:** [`docs/security-audit-2026.md`](../../docs/security-audit-2026.md)
  (auditoria; leitura, nenhum código alterado nela).
- **Baseline de invariantes:** seção **Security Hardening** em `AGENTS.md`
  (nada aqui pode quebrar anonimato, `no-store`, Zod `.strict()` ou contrato
  OpenAPI).

## Estado atual

| PR | Finding | Severidade | Status |
|----|---------|-----------|--------|
| #1 | SSRF por redirect (CWE-918) | Médio | ✅ `3857eb3` |
| #2 | Rate-limit `unknown`/HFF forjável (CWE-770/799) | Médio | ✅ `6f87644` |
| #3 | SCA — CVEs transitivas | Médio SCA | ⏳ pendente |
| #4 | Headers de segurança HTTP | Baixo | ✅ |
| #5 | CodeQL na CI | Baixo | ⏳ pendente |

## Começando (faça em ordem)

```bash
pnpm install          # reflete o estado atual
pnpm test:limited     # se o host tiver pouca memória (senão pnpm test)
pnpm audit            # inventário SCA (PR #3)
pnpm build            # deve estar verde antes de mudar
```

1. **PR #3 (SCA):** atualize `next`/`next-intl`/`@storybook/nextjs`; rode
   `pnpm audit` até 0 high/medium runtime; confirme `build`/`test:e2e`;
   alinhe o Dependabot.
2. **PR #5 (CodeQL):** adicione `.github/workflows/codeql-analysis.yml`.

## Regras de qualidade (não pule)

- **Test-first:** escreva o teste que falha antes de implementar.
- Rode `lint`/`format:check`/`typecheck` **depois da última edição**; `format`
  em qualquer arquivo novo/alterado (inclui estes docs/specs).
- Cobertura ≥80% global; ≥90% em safety/validation/orchestration.
- **Nunca** adicionar identificador direto, cookie, localStorage ou mudar o
  payload público.
- Ao terminar cada PR: atualize `tasks.md`/`plan.md`/`reviews.md` e o status
  em `docs/security-audit-2026.md`.

## Verificação final (Definition of Done)

- `pnpm audit` sem CVEs high/medium no caminho de runtime (PR #3).
- Rotas servem os 5 headers; default/error/reader sem violação CSP (PR #4).
- Workflow CodeQL verde, 0 alerts novos (PR #5).
- `pnpm lint` (0 warnings), `format:check` (sem drift), `pnpm typecheck`,
  `pnpm test`, `pnpm build` — todos verdes após a última edição.
