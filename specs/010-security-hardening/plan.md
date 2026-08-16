# Plano — Hardening de Segurança 2026

Derivado da auditoria de segurança 2026 (documento original removido; conteúdo
consolidado neste diretório — ver `research.md` para o mapa achado→tratamento).
Ordem sugerida pela auditoria:
PR #3 (SCA) → PR #1 (SSRF) → PR #2 (rate-limit) → PR #4 (headers) → PR #5
(CodeQL); `_alternativa:_` PR #1 primeiro se preferir atacar o risco funcional.

Status contratado: **#1–#4 CONCLUÍDOS**; **#5 COBERTO pelo GitHub Default Setup**
(ver seção PR #5 abaixo).

---

## PR #1 — SSRF por redirect  ✅ CONCLUÍDO (`3857eb3`)

**Finding §1 (médio, CWE-918):** `image-client.ts` validava a URL original com
`isSafeImageUrl()`, mas o `fetch` global segue redirects por padrão sem
revalidação do alvo — provedor hostil/prompt-injetado podia retornar URL
pública que `302 → interno/metadata`.

**Correção:** `fetchSafeImage()` em `provider-core/image-client.ts`:
- `redirect: "manual"` no fetch;
- em 3xx, revalida o `Location` com `isSafeImageUrl()` antes de seguir;
- limita a **1 hop** (redirect encadeado → `unsafe-url`);
- `Location` ausente ou alvo inseguro → `unsafe-url`;
- corpo final buscado **exatamente uma vez**; `.ok` preservado em `postImages`.

**Testes** (`tests/unit/provider-core/image-client.test.ts`): redirect→interno
rejeitado (alvo interno nunca buscado); redirect público único seguido com bytes
corretos; chain de 2 hops rejeitado. Escritos **test-first**, falharam antes da
correção.

---

## PR #2 — Rate-limit (bucket `unknown` + HFF forjável)  ✅ CONCLUÍDO (`6f87644`)

**Finding §2 (médio, CWE-770/799):** ambas as rotas faziam
```ts
x-forwarded-for?.split(",")[0]?.trim() || "unknown"
```
– confiava no hop **esquerdo** (forjável pelo cliente) e colapsava todos em um
bucket `"unknown"` compartilhado (DoS cross-user).

**Correção** em `lib/rate-limit.ts`:
- `resolveClientIp()`: só confia em `X-Forwarded-For`/`x-real-ip` quando
  `trustForwardedFor` (`VERCEL=1` ou `TRUST_PROXY=1`), e aí apenas no hop
  **direito** (acrescentado pelo proxy), validado como literal de IP.
- `ANONYMOUS_GLOBAL_KEY` (`"<anonymous-global>"`): bucket anônimo agregado,
  limitado e estável, usado quando **não** há IP confiável — elimina o
  colapso em `"unknown"` e não permite forjar chaves por cliente.
- `trustForwardedForEnv()` para derivar a decisão do ambiente.
- Rotas `stories`/`narrate` + `generation-runtime.ts` injetam `trustForwardedFor`.

**Testes** (`tests/unit/rate-limit.test.ts`): XFF à direita; HFF único; valor
não-IP → null; **HFF NÃO é confiado sem proxy confiável**; fallback `x-real-ip`;
linhas finais/lista com vírgula; e teste de rota: XFF forjado é ignorado e dois
requests caem no bucket global (2º → 429).

---

## PR #3 — SCA: atualizar dependências  ✅ CONCLUÍDO

**Finding §3 (médio SCA):** `pnpm audit` = **3 high + 1 low** transitivos:
`nanoid@3.3.17` (high), `image-size` ×2 (high), `elliptic` (low). Somente em
caminhos de dev/storybook/postcss — **não exploráveis em prod hoje** — mas
espelham os alertas do GitHub Dependabot.

**Ação:** atualizar `next`, `next-intl`, `@storybook/nextjs` e dependências
razoáveis para limpar os CVEs transitivos; rodar `pnpm audit` até 0 high;
confirmar `pnpm build`/`test:e2e` com o Dependabot alinhado.

**Critério de aceite:** `pnpm audit` sem CVEs de severidade high/medium no
caminho de runtime; nenhuma mudança de comportamento.

**Resultado:** `next@16.3.1`, `next-intl@4.13.6`, `@storybook/nextjs@10.5.8`;
override `nanoid: 3.3.18` em `pnpm-workspace.yaml` (pnpm 11 requer overrides
no workspace, não no `package.json`). `pnpm audit --prod` = **0 vulns** (runtime
limpo); nanoid high de >60 caminhos resolvido. **Ressalva:** restam 2 high + 1
low dev-only (`image-size` ×2, `elliptic`) via Storybook — os patches upstream
(`image-size` ≥2.0.3, `elliptic` ≥6.6.2) **ainda não publicados no registry**
(últimas versões 2.0.2 / 6.6.1); sem correção possível até upstream publicar.

---

## PR #4 — Headers de segurança HTTP  ✅ CONCLUÍDO

**Finding §8 (baixo, hardening, pré-existente):** `next.config.ts` **sem**
`headers()` e **sem** `middleware.ts`; o app responde sem CSP, HSTS,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.

**Ação (opção A recomendada):** bloco `headers()` estático em `next.config.ts`
com CSP calibrado para o app (ver arquivo `checklists/csp.md`):
- `script-src 'self'` + `'unsafe-inline'`/nonce para bootstrap inline do Next;
- `img-src 'self' data:` + host(s) de CDN (o reader exibe `data:` URI);
- `style-src 'self' 'unsafe-inline'` (next/font); `font-src 'self' data:`;
- `frame-ancestors 'none'`; `base-uri 'none'`; `form-action 'self'`;
- `Strict-Transport-Security` condicionado a produção (env), demais headers
  sempre.

**Risco:** CSP mal calibrada quebra build/reader (scripts inline ou imagens
bloqueados). Exige verificação real — **não** apenas lint — incluindo E2E e
visual (headers afetam carregamento).

**Critério de aceite:** rotas servem os 5 headers; default/error/reader carregam
sem violação de CSP no console; Storybook inalterado; E2E/visual/performance
verdes.

**Resultado:** headers aplicados em `next.config.ts` (`headers()` global); CSP
validada em browser real via E2E (`tests/e2e/security-headers.spec.ts`): heads
presentes e `/`, `/reader`, 404 sem violação de console. Falhas pré-existentes
confirmadas no baseline (locale/perf/visual — presentes sem os headers).
`pnpm test` 649/649; build tipo A; gates verdes.

---

## PR #5 — CodeQL na CI  ✅ COBERTO (GitHub Default Setup)

**Finding:** ausente da auditoria como item baixo; recomendado como hardening.

**Ação original:** adicionar workflow GitHub Actions `codeql-analysis.yml`
(languages `javascript-typescript`), `autobuild`, sarif `upload`, rodando em
`schedule` + push/PR da branch padrão. Sem estourar budget de CI.

**Critério de aceite:** workflow verde com sarif reportado e 0 alerts de
severidade high/medium introduzidos por mudanças novas.

**Resultado (decisão registrada):** **nenhum workflow manual foi criado** — o
repositório já tem **CodeQL ativo via GitHub Default Setup** (configuração
gerenciada pelo GitHub, sem arquivo no repo):
- Languages: **JavaScript/TypeScript + GitHub Actions** (as 2 detectadas);
- Query suite: **Default (high-precision)**;
- Runner: **Standard GitHub runner**;
- Scan events: **push + PR para `main`/branches protegidas + schedule semanal**
  (próxima varredura de `main` registrada no painel).

Isso atende T5.1–T5.4 sem custo de manutenção e sem tributar o CI por-PR.
**Não adotar advanced setup** (workflow manual p/ customizar queries): sinal já
é baixo neste repo (verifique: sem `dangerouslySetInnerHTML`/`eval`/`innerHTML`,
sem DB/shell/file-I/O de usuário; SSRF já coberto por PR #1 + testes) e o suite
default é o ajuste certo.
