# Quickstart — Hardening de Segurança 2026

Guia rápido para começar a implementação da `010-security-hardening`.
Leia **este arquivo**, depois `spec.md` (o quê/porquê), `plan.md` (como) e
`tasks.md` (o que fazer, com checkboxes).

## Contexto

- **Fonte da verdade técnica:** [`specs/010-security-hardening/`](../../specs/010-security-hardening/spec.md)
  (auditoria 2026 consolidada; o arquivo `docs/security-audit-2026.md` foi removido).
- **Baseline de invariantes:** seção **Security Hardening** em `AGENTS.md`
  (nada aqui pode quebrar anonimato, `no-store`, Zod `.strict()` ou contrato
  OpenAPI).

## Estado atual

| PR | Finding | Severidade | Status |
|----|---------|-----------|--------|
| #1 | SSRF por redirect (CWE-918) | Médio | ✅ `3857eb3` |
| #2 | Rate-limit `unknown`/HFF forjável (CWE-770/799) | Médio | ✅ `6f87644` |
| #3 | SCA — CVEs transitivas | Médio SCA | ✅ |
| #4 | Headers de segurança HTTP | Baixo | ✅ |
| #5 | CodeQL na CI | Baixo | ✅ coberto (GitHub Default Setup) |

## Começando (faça em ordem)

```bash
pnpm install          # reflete o estado atual
pnpm test:limited     # se o host tiver pouca memória (senão pnpm test)
pnpm audit            # inventário SCA (PR #3)
pnpm build            # deve estar verde antes de mudar
```

1. **Debug/inspeção:** CodeQL já ativo via GitHub Default Setup (ver seção
   "Nota CodeQL") — nenhum workflow manual necessário.

## Nota CodeQL (PR #5)
- Repositório já tem CodeQL ativo via **GitHub Default Setup** (sem arquivo no
  repo): JS/TS + GitHub Actions, query suite Default (high-precision), runner
  padrão, scan em push+PR para `main`/branches protegidas + schedule semanal.
- **Não** migrar para advanced setup (workflow manual) para customizar queries:
  o sinal já é baixo neste repo (sem sinks perigosos; SSRF coberto por PR #1).

## Nota SCA (PR #3)
- Overrides do pnpm 11 vivem em `pnpm-workspace.yaml`, **não** no campo `pnpm`
  do `package.json` (ignorado). `nanoid: 3.3.18` já aplicado.
- `pnpm audit --prod` = 0 vulns. `image-size`/`elliptic` (dev-only) aguardam
  upstream publicar patches (≥2.0.3 / ≥6.6.2).

## Regras de qualidade (não pule)

- **Test-first:** escreva o teste que falha antes de implementar.
- Rode `lint`/`format:check`/`typecheck` **depois da última edição**; `format`
  em qualquer arquivo novo/alterado (inclui estes docs/specs).
- Cobertura ≥80% global; ≥90% em safety/validation/orchestration.
- **Nunca** adicionar identificador direto, cookie, localStorage ou mudar o
  payload público.
- Ao terminar cada PR: atualize `tasks.md`/`plan.md`/`reviews.md`.

## Verificação final (Definition of Done)

- `pnpm audit` sem CVEs high/medium no caminho de runtime (PR #3).
- Rotas servem os 5 headers; default/error/reader sem violação CSP (PR #4).
- CodeQL ativo via GitHub Default Setup (JS/TS + Actions, push+PR+semana) (PR #5);
  sem workflow manual — sem custo de CI extra.
- `pnpm lint` (0 warnings), `format:check` (sem drift), `pnpm typecheck`,
  `pnpm test`, `pnpm build` — todos verdes após a última edição.
