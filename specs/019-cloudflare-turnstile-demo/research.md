# Research: Proteção anti-bot do /demo com Cloudflare Turnstile

**Phase 0** — resolução de decisões técnicas antes do design. Fonte: docs oficiais Cloudflare
Turnstile + Clerk bot-protection + convenções do AGENTS.md/constitution.

## 1. Onde a barreira deve viver

- **Decision**: No gargalo de entrada — o formulário `/demo` → `POST /api/stories` em **modo demo**.
- **Rationale**: `/demo` é a única rota pública e anônima que dispara geração. `/form` é auth-gated
  e rate-limitado; `/api/narrate` em demo responde 204 (sem custo); `/demo/reader` é read-only e faz
  redirect ao form sem história. Logo o ponto único a proteger é o POST de geração em modo demo.
- **Alternatives considered**: (a) proteger `/`/login — rejeitado: Clerk só oferece Turnstile para
  sign-up e o sign-up é invite-only; login já protegido nativamente (lockout/IP-limit); turnstile
  aí teria que ser um custom sign-in flow (alto custo). (b) proteger `/api/narrate` — inócuo em demo
  (204) e TTS real é auth-gated.

## 2. Modo do widget

- **Decision**: **non-interactive** (auto-resolve, sem checkbox visível), com recebimento do token
  via `callback` do `turnstile.render` e **execution controlado** para obter token sob demanda no
  submit.
- **Rationale**: invisível ao humano (zero fricção — US1), anônimo e sem cookie (preserva o
  invariante de privacidade da demo). Tokens são single-use e curtos.
- **Alternatives considered**: `invisible` — deprecated pela Cloudflare; `managed` — pode exibir um
  widget visível a alguns usuários (fricção extra num fluxo demo).

## 3. Transporte da prova (header vs body)

- **Decision**: **header `cf-turnstile-token`** no `POST /api/stories`.
- **Rationale**: o AGENTS.md define o corpo como enum fechado (`ageBand|locale|theme|sceneCount`,
  Zod `.strict()`). Um header é distinto de path/query/body ("no tokens in path/query/body") e
  mantém o contrato de entidades intacto. Turnstile tokens são opacos, anônimos e single-use (não
  são um identificador).
- **Alternatives considered**: campo no body — rejeitado: ampliaria o enum fechado e exigiria
  mexer no `.strict()`/contrato.

## 4. Validação server-side (siteverify)

- **Decision**: módulo `server-only` que faz `POST https://challenges.cloudflare.com/turnstile/v0/
  siteverify` com `secret`, `response` (e `remoteip` opcional), corpo `application/x-www-form-
  urlencoded`; resposta JSON `{ "success": true|false }`.
- **Rationale**: URL **fixa e confiável** da Cloudflare (não é terceiro-influenciada); a validação
  precisa ser no servidor (nunca confiar num token só do lado do cliente). Só sucesso executa a
  geração.
- **Alternatives considered**: pacote npm cliente/server para Turnstile — rejeitado (um simples
  `fetch` server-side basta e mantém deps/cobertura sob controle).

## 5. Segurança na rede (AGENTS SSRF/redirect)

- **Decision**: a chamada é a um host **constante** da Cloudflare (não- influenciada por input de
  usuário). Ainda assim, usar `redirect: "manual"` + revalidação do `Location` com o mesmo resolver
  de URL segura antes de re-descarga, e nunca seguir redirect para candidatos inseguros
  (loopback/RFC1918/metadata/IPv6), conforme `provider-core/url-safety.ts`.
- **Rationale**: hierarquia do AGENTS sobre SSRF aplica-se a "URLs terceiro-influenciadas"; aqui o
  alvo é fixo, mas a disciplina de rede é barata e defensiva.

## 6. Fail-closed vs fail-open

- **Decision**: **fail-closed** — se o `siteverify` falhar por rede/erro, a requisição demo é
  recusada com erro localizado retryável; o gerador nunca é chamado sem verificação.
- **Rationale**: uma falha aberta anularia a barreira (o atacante forçaria 500/erro do verificador
  para passar). Fail-closed é o default de segurança.
- **Alternatives considered**: fail-open — rejeitado por furo de segurança, embora evite indispor a
  demo num incidente do terceiro (mitigado pelo erro retryável + opt-in).

## 7. Configuração / opt-in

- **Decision**: ambas as chaves **opcionais**. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) +
  `TURNSTILE_SECRET_KEY` (server-only) em `lib/env.ts` (`.strict()` whitelist). Ausentes →
  feature desligada, demo como hoje.
- **Rationale**: deploys demo-only/CI/fake não exigem config; a feature é opt-in. `NEXT_PUBLIC_*`
  é **exceção consciente** (chave publishable não-secreta), como a do Clerk (ADR 0013) — registrar
  no ADR 0014.
- **Alternatives considered**: chaves obrigatórias no modo playground — rejeitado (quebraria
  deploy/CI sem chave; o /form não precisa da barreira).

## 8. CSP

- **Decision**: adicionar `https://challenges.cloudflare.com` a `script-src`, `frame-src`,
  `connect-src` (e `style-src`/`img-src` se o widget exigir) no `next.config.ts`, com comentário
  "EXPLICIT RELAXATION".
- **Rationale**: o widget carrega JS + iframe de `challenges.cloudflare.com`; CSP estrita atual
  bloquearia. Relaxamento mínimo e rotulado (regra AGENTS).
- **Alternatives considered**: servir o script via pacote/proxy local — rejeitado (o widget precisa
  comunicar com o domínio do desafio de qualquer forma).

## 9. Testes herméticos

- **Decision**: mockar `fetch` server-side e `window.turnstile` no cliente; usar as **site/secret
  de teste da Cloudflare** (`1x000...AA` always-passes; `2x...AB` always-blocks) só em validação
  manual (quickstart), nunca no CI.
- **Rationale**: zero chamadas live / chaves reais em testes (AGENTS + Constitution II).