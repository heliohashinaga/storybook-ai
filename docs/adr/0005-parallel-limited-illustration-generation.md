# ADR 0005 — Paralelização limitada na geração de ilustrações (latência)

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-11
- Contextos relacionados: feature `002-generate-more-scenes` (FR-005/FR-008); considerações de
  latência em `specs/002-generate-more-scenes/spec.md` ("Decisão de latência")

## Contexto

A geração de histórias usa um **único pipeline server-side** que combina texto, moderação e
ilustrações. Com provedores de modelos mais lentos/fracos (ex. `OPENROUTER_IMAGE_MODEL=gpt-5-image-mini`,
`MAX_TIMEOUT_MS` alto para imagem), o principal custo de latência está na **geração das
ilustrações**.

Estado atual do código:

- As ilustrações são renderizadas por um `for (const prompt of prompts)` — **sequencial**.
- Timeout de texto/moderação = `60_000` ms, com `maxRetries` = 2.
- Timeout de imagem = `120_000` ms (`IMAGE_TIMEOUT_MS`); retry em **nível do set inteiro**
  (`imageRetries` default = 1, ou seja até 2 tentativas no total).
- Tamanho máx. de `data:image/webp;base64,` = 4 MiB.
- Pool de ilustração rejeita **conjunto parcial**: uma história só é sucesso quando todas as N
  cenas têm texto + ilustração moderados (FR-005/FR-008).

Para uma história de 3 cenas com imagem lenta, a geração sequencial paga ~3 × a latência de
imagem, antes de qualquer retry. Isso degrada a experiência (espera longa, progresso simulado).

Forças e restrições:

- **Anonimato por design**: sem persistência, sem reprocessamento fora da sessão; tudo server-only.
- **Invariante de segurança**: nunca sucesso parcial (FR-005/FR-008); manter o retry do set inteiro.
- **Provedores**: imagem é o gargalo dominante; paralelizar tudo pode disparar **rate-limit** e
  degradar a **consistência de estilo/personagem** entre cenas.
- **Percepção**: o progresso atual é time-based (simulado); reduzir a latência real e/ou o custo
  ajuda a UX mesmo sem streaming.

## Decisão

A geração de ilustrações DEVE suportar **concorrência limitada** ao renderizar o set de prompts do
story, em vez de estritamente sequencial:

1. Substituir o `for...of` sequencial por um helper de **`Promise.allSettled` com um `concurrency`
   limitado** (ex. 2–3 em paralelo), preservando:
   - o **retry em nível de set inteiro** (`imageRetries`) existente;
   - o timeout `IMAGE_TIMEOUT_MS` por chamada;
   - o limite de 4 MiB por data URI;
   - a regra de **nunca sucesso parcial** — qualquer falha no set mantém o comportamento atual.
2. Manter esta decisão **conservadora**: concorrência limitada (não total), para mitigar
   rate-limit do provedor e risco de quebra de consistência visual entre cenas.
3. A **decisão de escala de tempo/retries por contagem** permanece **adiada** até medição real
   (adotado em `FR-008` do 002); a paralelização limitada é independente disso e é o caminho
   recomendado para já reduzir a espera.

## Decisões de não-adotar

- **Não** paralelizar todas as ilustrações de uma vez (`Promise.all` irrestrito): risco alto de
  rate-limit e de perda de consistência visual/estilo entre cenas — contraria FR-006/SC-004.
- **Não** aumentar `IMAGE_TIMEOUT_MS` (ou o teto end-to-end) só por causa de cenas longas: eleva a
  latência percebida e os budgets; prefere-se reduzir o tempo com paralelização limitada e, se
  necessário, comunicar a espera (streaming) — fora do escopo desta ADR.

## Alternativas consideradas

| Alternativa                                             | Veredito                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Geração **sequencial** (estado atual)                   | Rejeitada — 3 cenas = 3× latência de imagem; com modelo lento a espera é o gargalo dominante    |
| **`Promise.all` irrestrito** (tudo em paralelo)         | Rejeitada — alto risco de rate-limit e quebra de consistência visual entre cenas                |
| **Concorrência limitada** (`Promise.allSettled`, 2–3)   | **Adotada** — reduz latência sem escalar rate-limit; mantém consistência e o retry do set       |

## Consequências

**Positivas**

- Menor tempo de geração quando há várias cenas (principalmente 3–5), reduzindo a espera percebida.
- Invariantes preservados: nunca conjunto parcial, retry do set inteiro, timeouts e 4 MiB intactos.
- Alinhado ao valor de UX (perceived performance da constituição) sem abrir mão de anonimato.

**Riscos e mitigações**

- Rate-limit do provedor ao paralelizar → mitigado por `concurrency` limitado (2–3) e pela validação
  via medição; se necessário, reduzir o `concurrency`.
- Degradação de consistência de estilo entre cenas em paralelo → verificar visualmente
  (visual tests); o descritor de estilo/personagem único (FR-006) continua sendo passado a cada
  prompt.

## Gatilhos para reavaliar

- Se a medição real de latência mostrar que a paralelização limitada não reduz de forma
  significativa a espera (provedor com gargalo de fila/rate-limit), revisar o `concurrency` ou
  considerar streaming/feedback de etapas.
- Se o produto mudar para um provedor de imagem com rate-limit muito baixo ou latência muito alta,
  reavaliar a concorrência máxima.
