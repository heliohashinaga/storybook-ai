# Varredura de Segurança — storybook-ai (auditoria independente)

> **Data:** 2026 · **Escopo:** autorização completa dos endpoints de servidor
> (`POST /api/stories`, `POST /api/narrate`), provedores de IA externos
> (OpenRouter / OpenCode-go), dependências/SCA, segredos e hardening HTTP.
>
> **Metodologia:** auditoria feita **do zero** (sem confiar em conclusões de
> sessões anteriores). Regras não-negociáveis de `AGENTS.md` (privacidade
> absoluta, anonimato, `no-store`) usadas como linha de base; skill `security`,
> `nextjs` e `speckit` como referência. **Nenhum código foi alterado** — este é
> somente um relatório com plano de remediação.
>
> **Ferramentas:** leitura de código-fonte; `pnpm audit`; grep de segredos
> (gitleaks/trufflehog não instalados); inspeção de `pnpm-lock.yaml`, de
> `.gitignore` e do histórico git; inspeção de `.github/dependabot.yml` e
> `.github/workflows/ci.yml` (GitHub scan).

---

## TL;DR

| Severidade               | Resumo                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Sem risco crítico** | Arquitetura **anônima por design** disciplinada: sem identificadores, sem persistência, Zod `.strict()` nos dois routes, saída estruturada validada, logging raspado. **0 achados vermelhos.**                |
| 🟡 **2 médios**          | ① SSRF: fetch de imagem segue **redirects sem revalidação** após o guard (`image-client.ts`); ② rate-limit **in-memory + `X-Forwarded-For`/bucket `unknown`** (DoS/impessoalidade).                           |
| 🟡 **SCA**               | `pnpm audit` = **3 high + 1 low** (`nanoid@3.3.17`, `image-size` ×2, `elliptic`), todas transitivas — também espelhadas nas **Dependabot alerts** do GitHub. **Não exploráveis no runtime de produção hoje.** |

---

## Achados priorizados

> Cada achado tem **arquivo:linha**, **regra CWE**, classificação
> (**verdadeiro positivo provável / teórico / mitigado p/ outra camada**),
> caminho de exploração e fix recomendado.

### 1. 🟡 MÉDIO — Redirects do fetch de imagem sem revalidação de SSRF (CWE-918)

- **Arquivo:** `src/features/story-generation/server/provider-core/image-client.ts:97`
- **Classificação:** **teórico → mitigado em parte p/ `url-safety.ts`** (gap real de 2º salto)
- **CWE:** CWE-918 (Server-Side Request Forgery) · OWASP A10:2021

**Descrição.** `isSafeImageUrl()` (`url-safety.ts`) valida a **URL original**
(https, host público, re-resolve todos os endereços contra DNS-rebinding, bloqueia
loopback/RFC1918/cloud-metadata/link-local e **todo IPv6**). Porém o download usa:

```ts
const imageResponse = await fetchImpl(first.url, { signal: controller.signal });
```

O `fetch` global segue **redirects `3xx` por padrão** (`redirect: "follow"`), e o
guard **não é re-executado para o destino final**. Um provedor de imagem
comprometido ou induzido por prompt-injection pode devolver um `url` público
válido que faz `302 → http://169.254.169.254/...` ou `http://internal:8080/admin`.

**Caminho de exploração.** O único campo não-enumerado do pipeline que gera uma
requisição de rede para URL influenciada por terceiro é o campo `url` do
`/images` do provedor. Gatilho: provedor hostil OU prompt-injection desviando o
modelo a devolver imagem via URL (em vez de `b64_json`). O guard passa na
primeira URL; o corpo é baixado do host interno seguindo o redirect. Limitação
real: requer cadeia DNS-privada externamente resolvível e provedor não-confiável.

**Fix recomendado.** `redirect: "manual"`. Em resposta `3xx`, revalidar o
`Location` com `isSafeImageUrl()` (reutilizando o `urlSafetyResolver` injetado)
antes de re-buscar; limitar a 1 hop e então `redirect: "error"`.

---

### 2. 🟡 MÉDIO — Rate-limit in-memory + dependência de `X-Forwarded-For` (CWE-770 / CWE-799)

- **Arquivos:** `src/lib/rate-limit.ts:88`, `src/app/api/stories/route.ts:50`,
  `src/app/api/narrate/route.ts:47`
- **Classificação:** **verdadeiro positivo provável** (em multi-instância; single-instance ok)
- **CWE:** CWE-770 (Allocation of Resources Without Limits) · CWE-799 (Uncontrolled Resource Consumption)

**Descrição.** O `InMemoryRateLimiter` usa um `Map<string, number[]>` por
instância. Dois problemas combinados:

1. **Im-memory por instância:** em deploy com N instâncias (scale-out), cada uma
   tem bucket próprio → rotacionar instância/zona burla o limite (N × 10 reqs).
2. **`X-Forwarded-For` não é autenticado:** sem proxy de confiança que
   sobrescreva o header, o cliente pode forjar o valor. Além disso, quando o
   header está ausente cai para a constante **`"unknown"`**, e **todos os
   usuários anônimos colapsam em um único bucket** → tanto **DoS cross-user**
   (um usuário esgota o bucket do mundo todo) quanto **impessoalidade**
   (burlar o limite com qualquer valor spoofado). O salt é gerado **por boot**
   (`randomBytes(16)`), **não estático** — bom.

**Caminho de exploração.** Enviar requisições sem `X-Forwarded-For` (ou com
valores rotativos) para esgotar o bucket compartilhado `"unknown"` e negar
serviço a todos; ou, estando atrás de proxy que não sobrescreve `XFF`, forjar
`X-Forwarded-For: <ip-da-vítima>` para colapsar na mesma janela da vítima.

**Fix recomendado.** Resolver IP de fonte confiável: em prod, confiar em
`X-Forwarded-For` **somente** quando comprovadamente atrás do proxy destino
(Vercel sobrescreve); tratar `"unknown"` com um bucket agregado maior (limite
mais folgado) para não virar DoS cross-user. Para multi-instância, migrar para
um store compartilhado (o `interface RateLimiter` já é a seam).

---

### 3. 🟡 MÉDIO (SCA) — `pnpm audit`: 3 high + 1 low transitivas (CWE-400 / supply-chain)

- **Arquivo:** `package.json` + `pnpm-lock.yaml`
- **Classificação:** **verdadeiro, mas não-explorável no runtime de produção hoje**

| Pkg                                          | Severidade | Caminho (transitivo)                        | Exploração real                                             |
| -------------------------------------------- | ---------- | ------------------------------------------- | ----------------------------------------------------------- |
| `image-size` ≤2.0.2 (ICNS infinite-loop)     | **high**   | `@storybook/nextjs>image-size`              | **dev-only** (Storybook)                                    |
| `image-size` ≤2.0.2 (JXL/HEIF infinite-loop) | **high**   | `@storybook/nextjs>image-size`              | **dev-only** (Storybook)                                    |
| `nanoid@3.3.17` (<3.3.18, loop size=0)       | **high**   | `next>next-intl>postcss>nanoid` (>60 paths) | build-time (postcss), não chamada de zero-length em runtime |
| `elliptic` ≤6.6.1                            | **low**    | `@storybook/nextjs>...>elliptic`            | **dev-only** (Storybook)                                    |

**Supply-chain / GitHub.** O GitHub roda Dependabot alerts a partir de
`.github/dependabot.yml` (npm ecosystem, via `pnpm-lock.yaml`, weekly). As
alerts do GitHub derivam das mesmas fontes de advisory que o `pnpm audit` local,
logo **as 3 high + 1 low acima quase certamente aparecem na aba Security do
GitHub**. Confirmado no lock: `nanoid@3.3.17` (patched ≥3.3.18). **Nenhuma é
explorável em produção hoje**, mas deixam a aba Security vermelha em high.

**Fix.** `pnpm audit --fix` não é iterativo; atualizar `next`/`next-intl` (traz
`postcss` com `nanoid≥3.3.18`) e `@storybook/nextjs` (limpa `image-size` e
`elliptic`); se necessário, `overrides` para `nanoid@^3.3.18`. Validar com
`pnpm audit` → zero.

---

### 4. 🟢 BAIXO — Prompt injection: superfície inexistente; output estruturado validado

- **Arquivos:** `src/features/story-generation/server/provider-core/prompts.ts`,
  `schemas.ts` (`storyCandidateSchema`), `opencode-*`/`openrouter-*.ts` (`safeParse`)
- **Classificação:** **mitigado** (por enum-entrada + Zod + moderação)

A entrada de usuário é **não-gratuita e restrita** (`ageBand`/`locale`/`theme`
enums, `sceneCount` int). Não há campo `prompt` livre controlado pelo usuário →
**sem superfície de prompt injection direta**. O output estruturado é validado
com `response_format: {type:"json_object"}` + `parseChatJson` +
`storyCandidateSchema.safeParse()`; falha de shape → `ProviderError(
"invalid_structured_output")`, nunca chega ao cliente. Texto e prompt de
ilustração passam por `moderateText`/`moderateImage`. O `unsafe_url` ainda é
tratado pelo guard SSRF (ver #1).

---

### 5. 🟢 BAIXO — Authz / IDOR / BOLA: não há identificadores enumeráveis (confirmado)

- **Arquivos:** `src/app/api/stories/route.ts`, `src/app/api/narrate/route.ts`,
  `src/features/story-generation/server/schemas.ts`
- **Classificação:** **verdadeiro negativo — sem vulnerabilidade**

Ambos os routes aceitam **apenas** campos enums/ints do Zod `.strict()`. Não há
`id` de recurso, carimbo, UUID ou token em path/query/body. O `generationToken`
é um nonce hex aleatório **gerado no servidor** (nunca aceito como entrada). **Sem
IDOR/BOLA** — anonimato total, impossível enumerar recursos de terceiros.

---

### 6. 🟢 BAIXO — Validação de entrada (Zod) — **aprovado** (com nota)

- `POST /api/stories`: `ageBand` (2-4/5-7/8-9), `locale` (pt-BR/en), `theme`
  (6 enums), `sceneCount` (3–5). `.strict()` rejeita campos extras.
- `POST /api/narrate`: `sceneText` (trim, min 1, **max 2000** = `NARRATE_TEXT_MAX`),
  `locale`. `.strict()`.
- Toda resposta `Cache-Control: no-store`.
- **Nota:** sem limite explícito de `content-length` no corpo HTTP; o Zod trata o
  JSON e o `NARRATE_TEXT_MAX` limita bem o TTS. Baixo risco.

---

### 7. 🟢 BAIXO — Segredos / credenciais — **limpo**

`gitleaks`/`trufflehog` não instalados → grep de chaves + inspeção de histórico
git. **Nenhum segredo real encontrado** (sem `sk-`, `AKIA`, PK privada).
`.env.local` presente em disco mas **gitignored e nunca commitado** (sem
`.env.local` no histórico). **Sem `NEXT_PUBLIC_*`** em todo o código → **nenhum
segredo vai pro client**. Keys lidas só via `getEnv()` server-only
(`src/lib/env.ts` com `.strict()` e whitelist `KNOWN_KEYS`); injetadas apenas no
`Authorization: Bearer`; e o observability raspa `apiKey`/`secret`/`token`.

---

### 8. 🟢 BAIXO — Headers de segurança HTTP — **ausentes (pré-existente)**

- **Arquivo:** `next.config.ts` (sem bloco `headers()`)
- **Classificação:** **ausente, baixo impacto** (app JSON/texto React, sem
  `dangerouslySetInnerHTML`/`eval`/`innerHTML` — confirmado em `src/`)

**Sem** CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`. Recomendado hardening de baixo custo (PR plano abaixo).

**GitHub code scanning:** `.github/workflows/ci.yml` roda quality/build/browser
mas **não tem CodeQL** (`github/codeql-action` ausente). O GitHub só oferece
Dependabot alerts + Secret scanning automaticamente; **CodeQL exige config**.
Recomendado adicionar (PR plano abaixo).

---

## Plano de remediação (PRs priorizados)

| PR     | Prioridade        | Alvo                                                  | Arquivos                                                                    |
| ------ | ----------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| **#1** | **Alta** (código) | SSRF — revalidar redirects no fetch de imagem         | `provider-core/image-client.ts`                                             |
| **#2** | Alta (código)     | Rate-limit — bucket `unknown` + IP de fonte confiável | `lib/rate-limit.ts`, `app/api/stories/route.ts`, `app/api/narrate/route.ts` |
| **#3** | Alta (SCA)        | Limpar Dependabot alerts + `pnpm audit`               | `package.json`, `pnpm-lock.yaml`                                            |
| **#4** | Baixa (hardening) | Headers de segurança HTTP                             | `next.config.ts`                                                            |
| **#5** | Baixa (processo)  | CodeQL no CI                                          | `.github/workflows/ci.yml`                                                  |

**Ordem sugerida:** PR #3 (SCA, limpa o vermelho do GitHub e desbloqueia
confiança) → PR #1 (SSRF, risco funcional real) → PR #2 (rate-limit) → PR #4
(headers) → PR #5 (CodeQL). _(Alternativa: PR #1 primeiro se preferir atacar o
risco de código antes do SCA.)_

**Gates obrigatórios por PR (AGENTS.md):** `pnpm lint` (0 warnings),
`pnpm format:check` (`pnpm format` em arquivos novos/editados), `pnpm typecheck`,
`pnpm test`, `pnpm build`. **Test-first** para PRs #1 e #2. Não commitar
`.env.local`. Mensagens com gitmoji + Conventional Commits.

---

## Veredito

- **3 maiores riscos:** ① SSRF por redirect pós-validação (`image-client.ts:97`);
  ② rate-limit in-memory + `X-Forwarded-For`/bucket `unknown`; ③ CVEs transitivas
  `nanoid`/`image-size` (3 high).
- **1 recomendação de prioridade para PR:** fixar o **SSRF de redirect** primeiro
  (`redirect: "manual"` + revalidar `Location` com `isSafeImageUrl()`).
- **`pnpm audit` está limpo?** **NÃO** — 3 high + 1 low (transitivas, não
  exploráveis em produção; também refletidas nas Dependabot alerts do GitHub).

### Notas de autor

- Este é um **relatório pontual (auditoria 2026)**, não um ADR (os ADRs vivem em
  `docs/adr/`, 1 decisão por ADR). Para auditorias recorrentes, considerar girar
  este arquivo por data/versão e acoplar o CodeQL + Dependabot como gate.
- Nenhum código foi alterado nesta auditoria; o plano acima é a proposta de
  execução.

### Status da remediação

- **PR #1 — SSRF por redirect: CONCLUÍDO.** `image-client.ts` agora usa
  `redirect: "manual"` + revalida o alvo do `Location` com `isSafeImageUrl()`
  e limita a **1 hop** (redirect encadeado → `unsafe-url`); corpo final buscado
  exatamente uma vez. Testes adicionados em `tests/unit/provider-core/image-client.test.ts`
  (redirect→interno, redirect válido único, chain de 2 hops).

- **PR #2 — rate-limit: CONCLUÍDO.** `lib/rate-limit.ts` adiciona
  `resolveClientIp()` (confiança em `X-Forwarded-For`/`x-real-ip` só quando
  `trustForwardedFor` = `VERCEL=1`/`TRUST_PROXY=1`, e aí somente o hop da
  **direita** acrescentado pelo proxy) e `ANONYMOUS_GLOBAL_KEY` (bucket anônimo
  agregado e limitado quando não há IP confiável — elimina o colapso em
  `"unknown"`). Rotas `stories`/`narrate` e o bootstrap (`generation-runtime.ts`)
  injetam `trustForwardedFor`. Testes novos em `tests/unit/rate-limit.test.ts` e
  `tests/unit/stories-route.rate-limit.test.ts` (XFF à direita; XFF forjado é
  ignorado sem proxy confiável; fallback global anônimo).
