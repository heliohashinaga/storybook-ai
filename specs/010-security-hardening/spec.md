# Spec — Hardening de Segurança 2026

**Feature:** `010-security-hardening`
**Status:** em execução (PR #1 e #2 concluídos; PR #3, #4 e #5 pendentes)
**Origem:** auditoria de segurança [`docs/security-audit-2026.md`](../../docs/security-audit-2026.md) (leitura; nenhum código alterado na auditoria)

---

## Problema

A auditoria (CWE-918, CWE-770, CWE-799, headers ausentes, SCA) identificou
**0 riscos críticos**, mas **2 médios** de código (SSRF por redirect, rate-limit
com bucket `"unknown"` e HFF forjável), **1 médio SCA** (`pnpm audit`: 3 altos +
1 baixo transitivos) e gaps de hardening (headers de segurança ausentes, CodeQL
não ativo). O projeto é anônimo por design; nenhuma correção pode introduzir
identificador direto, persistência ou mudança de contrato público.

## Objetivo de negócio

Endurecer as superfícies de `POST /api/stories` e `POST /api/narrate` e das
dependências sem quebrar o invariante de anonimato nem o contrato OpenAPI,
com testes first-class e sem bloat de perímetro.

## Fora de escopo

- Mudanças de contrato/OpenAPI (nenhuma correção altera o payload público).
- Adição de identificadores diretos, cookies ou persistência.
- Refatoração estrutural; apenas correções localizadas e hardening.

## Princípios (constitution)

- **Privacidade:** só `ageBand`/`locale`/`theme`/`sceneText` chegam ao servidor;
  nenhuma identidade em payloads/logs/storage.
- **Confiança:** entradas de terceiros (URLs, headers) são sempre não-confiáveis
  até validação em cada hop.
- **Limpeza:** sem dead code, sem strings hardcoded, sem `any` novo em produção.
- **Gates:** `lint`/`format:check`/`typecheck` re-executados após a última edição.

## Não-Funcionais

- Geração ≤120 s E2E; LCP ≤2.5 s p75; JS de rota inicial ≤250 KiB gzip; navegação
  de cena ≤100 ms p75. Headers não podem regredir tempo de exibição.
- Cobertura ≥80% global; ≥90% em safety/validation/orchestration.
