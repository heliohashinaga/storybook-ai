# OpenRouter Provider Models — validated matrix

Validado empiricamente (testes reais contra a OpenRouter via a key do projeto e o pipeline do app). Útil para configurar `.env.local` sem re-descobrir o que funciona.

## Como o app espera cada modelo

| Papel (env var) | Endpoint que o app usa | Formato esperado |
|---|---|---|
| `OPENROUTER_TEXT_MODEL` | `/chat/completions` com `response_format: {type:"json_object"}` | A história em JSON no campo `content` (o prompt inclui a palavra "json") |
| `OPENROUTER_MODERATION_MODEL` | `/chat/completions` com `json_object` | JSON `{"safe": true\|false, "reason": string\|null}` no campo `content` |
| `OPENROUTER_IMAGE_MODEL` | `{baseUrl}/images` | `data:...b64_json`/`url`, `output_format: webp` (o app converte p/ WebP) |

> ⚠️ **Ponto crítico**: moderação e texto exigem que o modelo retorne o JSON **no campo `content`** (via `json_object`). Modelos do tipo "classificador/moderador dedicado" costumam devolver o resultado em `categories` ou em `reasoning`/`content: null`, o que faz o parser do app falhar com `Moderation result is invalid.` → 502.

## ✅ Catalog validated (funciona)

| Variável | Modelo | Resultado do teste |
|---|---|---|
| TEXTO | `openai/gpt-4o-mini` | ✅ Gera história válida (3 cenas com `illustrationPrompt`) |
| MODERAÇÃO | `openai/gpt-4o-mini` | ✅ Retorna `{safe, reason}` no `content`; pipeline completo gera (3 cenas + 3 imagens) |
| IMAGEM | `openai/gpt-5-image-mini` | ✅ Endpoint `/images` retorna `b64_json` (WebP via conversão); precisa timeout ≥ 90s |

**Pipeline end-to-end validado (moderação = gpt-4o-mini, imagem = gpt-5-image-mini, texto = gpt-4o-mini)**:
`ok: true` — 3 cenas, 3 imagens, ~121s de ponta a ponta.

## ❌ Models que NÃO atendem ao parser do app

| Variável | Modelo | Por que falha |
|---|---|---|
| MODERAÇÃO | `nvidia/nemotron-3.5-content-safety:free` | Devolve `content: null` + texto em `reasoning` (não JSON `{safe, reason}` no `content`) → `Moderation result is invalid.` → 502 |
| MODERAÇÃO | `openai/omni-moderation-latest` | Retorna em `categories` (não `{safe, reason}` no `content` via `json_object`) → mesmo 502 |

## Recomendações práticas

1. Use o mesmo modelo de chat que gera (ex.: `gpt-4o-mini`) também para **moderação** — é o mais garantido, pois já respeita `json_object` com JSON no `content`.
2. Para **imagem**, modelos de chat/híbridos podem servir, mas exige **timeout maior** (`IMAGE_TIMEOUT_MS`, hoje 90_000) porque a geração passa de 30s.
3. **Timeout da imagem**: o default de 30s era insuficiente para `gpt-5-image-mini` (`Image generation timed out.`); o fix `IMAGE_TIMEOUT_MS = 90_000` já está aplicado/commitado.
4. **Performance**: a geração completa com 3 imagens levou ~121s (budget ≤120s) — fique atento se o provider de imagem for lento.

## Notas

- Validação feita em ambiente **Node real** (não jsdom): o SDK da OpenAI bloqueia com *"browser-like environment"* em testes jsdom, o que não reflete o comportamento do `next dev`/produção (Node).
- A key e os modelos são configurados em `.env.local` (gitignored); nunca commitá-los.
