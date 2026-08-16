# Checklist — Política de Segurança de Conteúdo (PR #4, opção A)

Guia para calibrar a CSP estática em `next.config.ts` sem quebrar o app.
Objetivo: **CSP que bloqueia XSS mas não derruba build/reader**. O leitor exibe
`data:` URIs (imagens do provedor) e usa `next/font` (CSS inline) — a política
precisa cobrir isso.

## Diretrizes por diretiva

| Diretiva | Valor recomendado | Por quê |
|----------|-------------------|---------|
| `default-src` | `'self'` | base conservadora |
| `script-src` | `'self'` + `'unsafe-inline'` (ou nonce) | bootstrap inline do Next (`__next`, dados) |
| `style-src` | `'self' 'unsafe-inline'` | `next/font` e estilos inline legítimos |
| `img-src` | `'self' data:` | o reader exibe `data:` (provedor `b64_json`) |
| `font-src` | `'self' data:` | `next/font` serve self; fallback data |
| `connect-src` | `'self'` | API própria (stories/narrate) |
| `frame-ancestors` | `'none'` | sem iframes de terceiros (anti-clickjack) |
| `base-uri` | `'none'` | impede injeção de `<base>` |
| `form-action` | `'self'` | submissões só para a própria API |
| `object-src` | `'none'` | sem plugins |

> Se `script-src 'unsafe-inline'` for aceitável (app anônimo, sem HTML
> perigoso, auditoria confirmou **sem** `dangerouslySetInnerHTML`/`eval`/
> `innerHTML`), é a opção de menor atrito. Uma política com **nonce** exige
> `middleware.ts` para injetar o nonce no `<script>` — mais robusta, porém
> maior superfície de manutenção; optar só se o bastidor exigir.

## Passos de verificação (validação REAL obrigatória)

- [x] **Teste-first:** E2E `tests/e2e/security-headers.spec.ts` (headers presentes; browser sem violação CSP)
- [x] `next.config.ts` com `headers()` retornando os 5 headers
- [x] `Strict-Transport-Security` **condicionado a produção** (`NODE_ENV`), não
      em dev (HTTPS/localhost)
- [x] `build` da rota `/`, `/form`, `/reader`, `/api/stories`, `/api/narrate`
      sem erro — scripts inline do Next carregam
- [x] **No browser:** default/error/reader abrem **sem violação de CSP no
      console** (devtools via Playwright)
- [x] Imagens `data:` do reader renderizam (não bloqueadas por `img-src`)
- [x] `next/font` aplica (não bloqueado por `style-src`)
- [ ] Storybook (host estático próprio) não afetado pelos headers de produção
      _(verificado implicitamente — headers globais aplicam só à rota Next)_
- [x] E2E de headers verdes; falhas visual/perf pré-existentes no baseline
- [x] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin` presentes

## Armadilhas conhecidas

1. `img-src` sem `data:` → reader quebra (imagens do provedor são `data:`).
2. `script-src` muito restrita → bootstrap do Next não roda, tela branca.
3. `style-src` sem `'unsafe-inline'` → `next/font` e estilos inline caem.
4. HSTS em dev → navegador adverte/recusa HTTP em localhost.
5. "passou no lint" ≠ "CSP válida" — sempre validar no navegador.
