# Research & Technical Decisions: Leitura por voz com TTS de IA

**Feature**: `004-ai-natural-tts` | **Branche**: `004-ai-natural-tts` | **Date**: 2026-08-20
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> Resolve todos os items de "NEEDS CLARIFICATION" do Technical Context e documenta as escolhas por trás de cada decisão arquitetural. As decisões de produto (Q1-C híbrido, Q2-C configurável) foram definidas no `spec.md`; aqui consolidamos o "como".

---

## 1. Provedor/Modelo de TTS de voz (voz natural, em pt-BR/en)

- **Decision**: Usar um modelo de TTS de voz **neural** acessível via API HTTP, **configurável por ambiente** (`OPENROUTER_TTS_MODEL`; assume-se OpenRouter por hora como provedor de voz), atrás do adapter `server-only`. **Default: Kokoro 82M via OpenRouter** (`output_modalities=speech`), pela relação naturalidade/custo, com voz pt-BR disponível.
- **Rationale**:
  - Voz de IA neural é o único caminho para a "voz mais natural" pedida (a Web Speech atual é robótica e varia por dispositivo).
  - **OpenRouter** centraliza vários modelos com um único ponto de integração (mesmo padrão já usado na geração de histórias), cobrado **por caractere de texto**, e expõe filtro `output_modalities=speech`.
  - **Configurável (Q2-C)**: escolher `OPENROUTER_TTS_MODEL` por env permite alternar perfil custo-eficiente ↔ premium sem tocar em código (atende ao requisito FR-011).
  - **Server-only controlado (Q1-C)**: quando `AI_NARRATION_ENABLED=true`, o servidor gera o áudio pelo provedor; se o provedor falhar, retorna **erro acessível** (sem fallback para a Web Speech).
- **Alternativas consideradas**:
  - **Kokoro 82M (OpenRouter, default)** — $0.62/M chars; leve (82M params); voz pt-BR (`pf_dora`, `pm_alex`, `pm_santa`); bom custo-benefício p/ "claramente mais natural que sistema". *(Preço snapshot 2026-08-20; validar em `openrouter.ai`.)*
  - **Kokoro via fal.ai** — mesmo modelo, `fal-ai/kokoro/brazilian-portuguese` (hosting separado, requer `FAL_KEY`); nota: custo por 1k denotado diferente das convenções do OpenRouter — avaliar ao configurar.
  - **Voxtral Mini / Speech 2.8 / Qwen-Audio-TTS etc. (OpenRouter)** — voz mais premium, custo maior ($15–60/M chars); encaixam no perfil "premium" configurável.
  - **Azure Neural / ElevenLabs / Google** — fora do OpenRouter; excelente qualidade, mas custo/contrato próprios; manter fora do default (configurável apenas se o usuário optar).
  - **Web Speech local (estado atual)** — usado quando `AI_NARRATION_ENABLED=false` (comportamento normal) ou, se a IA não oferecer voz no idioma, como erro; **não** é fallback automático quando a IA ativa falha.

## 2. Fronteira de privacidade e contrato anônimo

- **Decision**: A chamada ao TTS (topologia híbrida ativa) envia **apenas o texto anônimo da cena** do adapter `server-only` ao provedor; nenhum identificador (nome, idade exata, e-mail, id de sessão) é transmitido, logado ou armazenado. O endpoint de narração responde `Cache-Control: no-store`; zero persistência de áudio.
- **Rationale**:
  - Preserva os invariantes não-negociáveis do AGENTS.md: como a geração já envia o mesmo texto à fronteira do servidor, enviá-lo ao TTS pelo mesmo boundary **não introduz novo identificador**.
  - Áudio é **transitório** (blob em memória → reprodução imediata → descartado). Nenhum cookie/localStorage/DB/cache de áudio.
  - "Quem é o usuário" continua não existindo (acesso anônimo, sem login).
- **Alternativas consideradas**: manter 100% local (rejeitado — qual também presa de qualidade; modelo on-device pesado quebraria o budget de JS) — ratificado na escolha Q1-C.

## 3. Formato/entrega do áudio ao navegador

- **Decision**: O endpoint `POST /api/narrate` (server-only) retorna o **áudio como bytes** (`Content-Type: audio/mpeg`/`audio/wav` conforme `response_format` do provedor); o cliente converte a resposta em `Blob` e toca via `HTMLAudioElement`/`<audio>`. Base64 data-URL também é aceitável, mas bytes+Blob evita inflar o payload e o HTML.
- **Rationale**: playback de áudio no navegador é direto com Blob; evita peso extra no bundle (nenhum carregador de áudio no bundle inicial, respeitando ≤250 KiB gzip); a reprodução acontece via URL de objeto (`URL.createObjectURL`), revogada ao parar/trocar de cena.
- **Alternativas consideradas**:
  - **base64 inline** — simples, mas ~33% maior; aceitável porém não preferido.
  - **Streaming/Chunked** — overkill para texto curto de cena (centenas a ~1.5k chars); adiável.

## 4. Adapter server-only (padrão a seguir)

- **Decision**: Criar `tts-provider.ts` com interface `TtsProvider` (ex.: `synthesize(text, { locale, format }): Promise<Buffer>`) + `ProviderError` com `kind` (unavailable/timeout/invalid), espelhando o padrão `StoryGenerationProvider` existente (`story-generation-provider.ts`).
- **Rationale**: consistência com a arquitetura já consolidada do repo (mesmo modelo de erro/frontes de fake), testável com fake determinístico, e centraliza a resolução de erro (fallback apenas para IA desativada) em `tts-runtime.ts`.
- **Alternativas consideradas**: chamar o provider direto na rota (rejeitado — frágil, sem camada de resolução de erro/provider/fake).

## 5. Configuração e teto de custo (Q2-C)

- **Decision**: Variáveis de ambiente (server): `AI_NARRATION_ENABLED` (liga/desliga) e `OPENROUTER_TTS_MODEL` (provedor/modelo de voz; assume-se OpenRouter por hora). `tts-runtime.ts` chama o provedor e, em falha/indisponibilidade, sinaliza fallback para a voz de sistema (Web Speech).
- **Rationale**: personaliza o perfil custo-vs-naturalidade sem deploy; garante que um projeto pessoal não estourara custo; teto+retries dão comportamento gracioso (FR-007).
- **Alternativas**: teto fixo em código (rejeitado — pouco flexível para P2).

## 6. UX do controle de leitura (reutilizar use-read-aloud)

- **Decision**: Reutilizar o hook `use-read-aloud.ts` (estados `speaking`/`supported`, `toggle`/`stop`, voz por locale) e estendê-lo para um caminho de IA (`use-ai-read-aloud`): se IA habilitada/disponível → token áudio Blob; senão → Web Speech. Mantém UX de *single start/stop* e *interrupção ao navegar* (FR-002/FR-005).
- **Rationale**: preserva acessibilidade/estados já implementados (AA, `aria-live`) e o padrão de melhoria progressiva; evita regressão da US1/US2/US3.
- **Alternativas**: novo hook separado com duplicação de estados (rejeitado).

## 7. Testes (determinísticos, sem TTS real)

- **Decision**: Provider de TTS **fake** (responde um blob MP3 determinístico ou sinaliza erro) + MSW para o endpoint `/api/narrate`. Testes reforçam o invariante de anonimato: rede bloqueada a não-local e payload sem identificador; sem storage.
- **Rationale**: test-first (constitution), sem custo/rede, determinístico. Storybook + a11y cobrem novos estados do controle.
- **Alternativas**: testes contra TTS real (rejeitado — não-determinístico, custa e depende de rede).

---

## Decisões abertas / notas

- **Modelo exato e preços** ainda podem ser ajustados no `tasks.md`/`.env` (benchmark de naturalidade/custo do perfil default Kokoro vs demais). O contrato do adaptador é estável (interface + erro tipado + runtime de teto), então trocar de modelo não altera o design.
