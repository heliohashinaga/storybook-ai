# ADR 0007 — Leitura em voz alta com TTS de IA via OpenRouter (melhoria futura)

- Status: Accepted (direção) — em especificação na feature `004-ai-natural-tts`
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-20
- Contextos relacionados: feature `003-melhorias-de-ux` (FR-UX-003/FR-UX-004) e `004-ai-natural-tts`. A
  leitura em voz alta atual usa **Web Speech API local** (`speechSynthesis`), sem rede e sem IA.

> **Atualização de decisão (2026-08-20)** — conforme a feature `004-ai-natural-tts`, a topologia
> escolhida é **híbrida (server-only com fallback)**: a IA é usada quando disponível / dentro do teto
> de custo, caindo para voz de sistema caso contrário; e o **perfil custo-vs-naturalidade é
> configurável por ambiente**. O "não adotar agora" abaixo se refere à Web Speech como implementação
> vigente; a evolução para IA está sendo especificada com os invariantes de anonimato mantidos.

## Contexto

A leitura em voz alta hoje é 100% local no navegador: usa `speechSynthesis` (Web Speech API nativa),
que sintetiza a voz no próprio dispositivo, **sem transmitir o texto nem áudio a nenhum servidor**
(FR-UX-003/004). É uma decisão **progressive enhancement**: se o dispositivo não tiver voz no
idioma, o controle fica desabilitado com mensagem localizada e o texto permanece legível.

Pontos fortes do estado atual:

- Zero custo monetário e zero rede (funciona offline, instantâneo).
- Preserva integralmente o invariante "nada sai do dispositivo na etapa de leitura".
- Mantém o budget inicial de JS (≤250 KiB gzip) — nenhum modelo on-device pesado.
- Sem necessidade de armazenar áudio nem gerir chave de provedor.

Limitação reconhecida: a **qualidade de voz é robótica/artificial** e varia muito por navegador/OS
(e pela disponibilidade de voz installada). Não há um modelo neural de voz natural.

O OpenRouter agora expõe **modelos de texto-para-fala (TTS)** listáveis por
`output_modalities=speech`, com **custo por caractere de texto de entrada** — o que torna um TTS de
IA (voz natural) tecnicamente viável mantendo anonimato (enviando apenas o texto anônimo da cena).

## Forças e restrições

- **Anonimato por design**: poderia ser mantido se o servidor recebesse apenas o texto anônimo da
  cena (sem qualquer identificador) e devolvesse o áudio; nenhum identificador direto deve existir
  em payload, log ou storage (regras não-negociáveis do AGENTS.md).
- **Sem persistência**: por design não há cache durável; adicionar áudio exige decidir se ele é
  transitório (in-memory / na resposta) e jamais persistido.
- **Server-only**: qualquer chamada a provedor de TTS ficaria atrás de um adapter `server-only`
  (como a geração), nunca no bundle/cliente.
- **Budget de performance**: geração completa ≤120 s end-to-end; LCP ≤2.5 s; JS inicial ≤250 KiB
  gzip. Gerar áudio sob demanda soma latência; pré-gerar junto à história soma custo.
- **Custo monetário**: o modelo é por caractere; estimativas abaixo indicam que é desprezível por
  leitura, mas há trade-offs de rede/latência/storage/chave.

## Preços atuais (snapshot 2026-08-20, OpenRouter TTS)

| Modelo TTS                   | Provedor   | Preço                                  |
| ---------------------------- | ---------- | -------------------------------------- |
| Kokoro 82M                   | hexgrad    | **$0.62 / M caracteres** (mais barato) |
| Grok Voice TTS 1.0           | xAI        | $15 / M caracteres                     |
| MAI-Voice-2-Flash            | Microsoft  | $15 / M caracteres                     |
| Qwen-Audio-3.0-TTS Flash     | Qwen       | $15 / M caracteres                     |
| Fish Audio S2.1 Pro          | Fish Audio | $15 / M UTF-8 bytes                    |
| Voxtral Mini TTS             | Mistral    | $16 / M caracteres                     |
| MAI-Voice-2                  | Microsoft  | $22 / M caracteres                     |
| Speech 2.8 Turbo             | MiniMax    | $60 / M caracteres                     |
| Gemini 3.1 Flash TTS Preview | Google     | por token ($1/M in, $20/M out)         |

Estimativa prática: uma história de 3–5 cenas tem ~800–1.500 caracteres.

- **Cenário barato (Kokoro 82M, $0.62/M)**: ≈ **US$ 0.0005–0.001 por leitura** (fração de centavo).
- **Cenário padrão (~$15/M)**: ≈ **US$ 0.012–0.023 por leitura**.

> Preços mudam com frequência; validar em `https://openrouter.ai/models?output_modalities=speech`
> (ou `curl https://openrouter.ai/api/v1/models?output_modalities=speech`) antes de reavaliar.

Alternativas fora do OpenRouter (não-adotadas aqui, apenas referência para comparação):

| Fornecedor                  | Custo                               | Naturalidade  |
| --------------------------- | ----------------------------------- | ------------- |
| OpenAI `tts-1`              | $15/M caracteres                    | Boa, pt-BR ok |
| ElevenLabs v2/v3            | $50–100/M (API $0.05–0.10/1K chars) | Excelente     |
| Azure Neural / Google Cloud | ~$4/M                               | Excelente     |

## Decisão

**Não adotar** TTS de IA (via OpenRouter ou outro provedor) **agora**. **Manter a Web Speech API
local** como leitura em voz alta.

Esta ADR documenta o cenário para reavaliar com dados de custo e gatilhos objetivos, de modo que a
evolução seja uma escolha consciente — e não uma deriva — quando/quando for desejado **voz natural**.

## Decisões de não-adotar (o que NÃO fazer sem um plano próprio)

- **Não** chamar TTS de IA **diretamente do cliente/browser** — exporia a chave do provedor e
  quebraria o boundary server-only; qualquer integração ficaria no adapter `server-only`.
- **Não** pré-gerar áudio de todas as histórias de forma agressiva **sem decisão de cache** —
  conflita com o invariante "sem persistência"; qualquer uso exigiria uma decisão explícita de
  storage transitório/efêmero (ex.: ttl curto) e revisão do invariant privacidade.
- **Não** adotar um **modelo on-device** (RN/TFLite/WASM) de voz neural: pesado o suficiente para
  estourar o budget de ≤250 KiB gzip de JS inicial — fora de escopo para este app.

## Alternativas consideradas

| Alternativa                                                | Veredito                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Web Speech local** (estado atual)                        | **Adotada** — gratuita, offline, anônima, leve                                                          |
| **TTS de IA via OpenRouter (server)** (ex. Kokoro $0.62/M) | Adiada — custo irrelevante, mas redes/latência/storage/chave e saída do "tudo local"                    |
| **TTS de IA direto do cliente**                            | Rejeitada — expõe chave e quebra o boundary server-only                                                 |
| **Modelo de voz neural on-device**                         | Rejeitada — estoura o budget de JS inicial                                                              |
| **Áudio pré-gerado + cache**                               | Rejeitada por ora — conflita com o invariante "sem persistência" (precisa plano de storage transitório) |

## Consequências

**Positivas (de manutenção do status quo)**

- Zero custo, offline, instantâneo; anonimato estrito preservado; budget intacto.
- Decisão registrada com números — reavaliar futuramente vira um passo barato e objetivo.

**Custos/limitações (por isso a melhoria é desejável a longo prazo)**

- Voz robótica, qualidade varia por dispositivo; sem voz no idioma → botão desabilitado
  (progressive enhancement cobre, mas não entrega voz boa).

**Riscos e mitigações (se um dia adotar)**

- Latência ao gerar áudio sob demanda → mitigar com geração em paralelo à renderização ou
  streaming; medir contra o budget de 120 s end-to-end.
- Persistência de áudio → manter efêmero/transitório e revisar o invariant privacidade antes.
- Secreção de chave → usar adapter `server-only` com chave em `.env`, nunca no cliente.
- Custo imprevisto → teto de uso/limite mensal e monitoramento de gasto por requisição.

## Gatilhos para reavaliar

- Quando o usuário/requisito priorizar **voz natural** como critério de qualidade da leitura em voz
  alta (não apenas "funciona", mas "soa bem").
- Se houver **feedback recorrente** sobre a qualidade robótica da Web Speech entre os usuários.
- Quando houver orçamento/disposição para custo **operacional** (mesmo que baixo por leitura) e para
  manter infraestrutura server-side adicional (rede, chave, possível storage efêmero).
- Se o OpenRouter (ou um provedor) oferecer um modelo TTS com **qualidade boa + custo marginal
  trivial** e a decisão de cache/storage for aceita.

## Como reavaliar rápido

- Validar a lista e preços atuais: `curl https://openrouter.ai/api/v1/models?output_modalities=speech`
- Estimar custo por história no tamanho real médio (medir caracteres das cenas geradas).
- Prototipar no adapter `server-only` com um modelo barato (ex. Kokoro 82M) e medir latência
  vs. budget; decidir storage transitório explicitamente.
