# Pesquisa — Hardening de Segurança 2026

Mapa de evidência: achado da auditoria → tratamento → artefatos.
Fonte primária: `docs/security-audit-2026.md` (25/03/2026; leitura; 0 mudanças).

## Resumo da auditoria
- **Veredito:** 0 riscos críticos; 2 médios (código) + 1 médio SCA; 3 baixos
  (headers, CodeQL, e true-negatives `autenticação/autorização/IDOR`).
- **Superfícies auditadas:** `POST /api/stories`, `POST /api/narrate`,
  provedores externos (OpenRouter/OpenAPI), dependências (SCA), segredos,
  headers HTTP.

## Mapa achado → tratamento

| # | Achado | CWE | Sev | Tratamento | Artefatos |
|---|--------|-----|-----|------------|-----------|
| 1 | SSRF — redirect sem revalidação | CWE-918 | Médio | **PR #1 ✅** | `plan.md` T1, `image-client.ts` |
| 2 | Rate-limit — `unknown` + HFF forjável | CWE-770/799 | Médio | **PR #2 ✅** | `plan.md` T2, `rate-limit.ts` |
| 3 | SCA — CVEs transitivas | – | Médio SCA | **PR #3 ⏳** | `plan.md` T3 |
| 4 | Prompt injection | – | Baixo | Mitigado (enums+Zod+moderação) | `enums`/`moderation.ts` |
| 5 | Authz/IDOR/BOLA | – | Baixo | True negative (sem ids enumeráveis) | – |
| 6 | Validação de entrada (Zod) | – | Baixo | Aprovado; sem `content-length` | `schemas.ts` |
| 7 | Segredos | – | Baixo | Limpo (sem `NEXT_PUBLIC_*`) | `lib/env.ts` |
| 8 | Headers de segurança | – | Baixo | **PR #4 ⏳** | `plan.md` T4, `next.config.ts` |
| – | CodeQL na CI | – | Baixo | **PR #5 ⏳** | `plan.md` T5, workflow GH |

## Verdito do true-negative
Nenhum `dangerouslySetInnerHTML`/`eval`/`innerHTML` em `src/`; nenhum
identificador/nome em UI/API/logs. Sem enumerabilidade de recursos → sem
IDOR/BOLA. Prompt injection já mitigado pela enumeração estrita.

## Riscos residuais e mitigação
- CSP de PR #4 é o único com risco de regressão de funcionalidade → validar no
  browser (ver `checklists/csp.md`).
- SCA (PR #3) pode exigir bump maior se grades de `next` não resolverem um CVE
  transitivo → considerar `overrides` tipados ou espera de patch upstream.

## Fonte de decisão
- `plan.md` (ordem e critérios de aceite), `reviews.md` (estações D1-Dx),
  `tasks.md` (estado por tarefa).
