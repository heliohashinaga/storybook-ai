# Quickstart / Validação — Leitura por voz com TTS de IA

**Feature**: `004-ai-natural-tts` | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/tts.openapi.yaml](contracts/tts.openapi.yaml) | **Dados**: [data-model.md](data-model.md)

> Guia de validação **executável** para provar a feature ponta-a-ponta. Não repõe `tasks.md`; aqui estão os cenários e comandos de verificação, usando **provider fake determinístico** (nenhum teste chama TTS real) e respeitando os invariantes de anonimato.

---

## Pré-requisitos

- Node 22+, `pnpm install`. (Não é necessário `AI_NARRATION_ENABLED`/`TTS_*` para testes: o fake/provider local substitui por padrão.)
- Suítes já existentes verdes (baseline): `pnpm test` (322+), `pnpm storybook:test`, `pnpm test:e2e` (fake provider), `pnpm test:visual`, `pnpm test:performance`.

## Variáveis de ambiente (server-only, para o caminho IA real)

| Variável | Default | Uso |
|----------|---------|-----|
| `AI_NARRATION_ENABLED` | `false` | Liga o caminho TTS de IA. `false` ⇒ usa a voz de sistema (Web Speech) no navegador (seguro). |
| `OPENROUTER_TTS_MODEL` | Kokoro-class (OpenRouter por hora) | Modelo de voz; perfil custo-vs-naturalidade (Q2-C). |

---

## Cenários de validação

### Cenário 1 — Narração de IA (caminho feliz) [US1]

- **Setup**: fake TTS determinístico (dev) devolve um `Blob` MP3 curto; `AI_NARRATION_ENABLED=true` com fake.
- **Comando** (unit/contrato): `pnpm test -- tts` → provas que `tts-runtime` chama provider, devolve áudio e marca `mode: ai`.
- **E2E** (provider fake): abrir uma história, acionar "ouvir" na cena → `state.speaking` em `ai`; interromper ao trocar de cena.
- **Esperado**: narração audível, iniciar/parar correto, interrupção por navegação; estado acessível (`aria-live`/`aria-busy`) anunciando "lendo"/"parado". (Contrato: `tts.openapi.yaml` → `POST /api/narrate` → 200 audio.)

### Cenário 2 — Erro controlado quando a IA ativa falha [US2]

- **Setup**: fake/TS que força erro (ex. 429/502/timeout); `AI_NARRATION_ENABLED=true`.
- **Comando** (unit+e2e): após erro do provedor, o controle entra em **estado de erro**; nenhuma narração inicia; **nenhum** áudio de Web Speech é tocado.
- **Esperado**: 1ª leitura tenta IA; se falhar, exibe mensagem de erro acessível e o texto da cena segue legível — **sem queda para a voz de sistema**; repetições não tentam por infinito (limite/backoff).

### Cenário 3 — Zero persistência e anonimato [US3 + invariantes]

- **Setup**: provider fake; bloqueio de rede não-local (testes já fazem).
- **Comandos** (e2e/privacidade): `anonymous-session…` + novo teste específico do `narrate`.
- **Esperado**:
  - Nenhuma chamada a `/narrate` ocorre antes do usuário acionar "ouvir" (sem pre-busca).
  - Recarregar a página não re-apresenta áudio (nenhum storage).
  - Payload do `/narrate` contém apenas `sceneText`/`locale` — sem identificador; nenhum cookie/localStorage criado.
  - Rota responde `Cache-Control: no-store`.

### Cenário 4 — Performance/budget

- **Setup**: build de produção (`pnpm build`), provider fake.
- **Comando**: `pnpm test:performance`.
- **Esperado**: JS inicial ≤ 250 KiB gzip (TTS NÃO está no bundle inicial — só via `/narrate` sob demanda); LCP p75 ≤ 2.5s; navegação de cena ≤ 100ms p75; geração ≤ 120s. A narração sob demanda não degrada esses valores.

### Cenário 5 — Naturalidade/preferência (SC-002, proxy verificável em CI)

- **Em CI**: `tests/unit/naturalness-preference.test.ts` compara de forma **determinística** a qualificação A/B entre um áudio de IA (blob fake rotulado) e a voz de sistema; assere que o caminho IA é selecionado quando habilitado (proxy — sem medição com participantes).
- **Pós-lançamento (NÃO medido por este teste)**: estudo com participantes mede se a preferência por IA atinge ≥80%. Esse critério é documentado aqui como métrica pós-lançamento; não há chamada a TTS real em nenhum teste.
- **Perfil custo-vs-naturalidade**: `OPENROUTER_TTS_MODEL` resolve o modelo (custo-eficiente vs premium) por ambiente (Q2-C/SC-007); validado por `tests/unit/tts-model-resolution.test.ts`.

### Cenário 6 — Acessibilidade (WCAG A/AA) e reduced-motion

- **Setup**: Storybook + test-runner/axe.
- **Comando**: `pnpm storybook:test`.
- **Esperado**: novos estados do controle de narração (carregando/erro) sem violações A/AA; foco/teclado ok; `prefers-reduced-motion` honrado; contraste ≥ 4.5:1 em texto normal.

---

## Gates exigidos antes de concluir (DoD)

1. `pnpm lint` (0 warnings) · `pnpm format:check` (nenhum drift) · `pnpm typecheck`.
2. `pnpm test` (unit/contrato/pipeline) verdes, incl. novos testes do `tts-runtime`/provider fake/contrato.
3. `pnpm test:coverage:check` — gates ≥80% global; ≥90% módulos safety/validation/orchestration (sem regressão).
4. `pnpm storybook:test`, `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:performance`.
5. `pnpm build` passa.
6. Testes de privacidade afirmam invariante: `/narrate` recebe só `sceneText`/`locale`; sem persistence/storage; rede bloqueada a não-local.
7. Storybook behavior == app; budgets respeitados; spec/contrato/OpenAPI atualizado se mudou.

> **Nunca chamar TTS real em testes.** Use fake determinístico + MSW. Não commitar `.env.local`/credenciais reais.

## Próximos passos

Depois de validar os cenários, rodar `/speckit.tasks` para gerar o `tasks.md`, e `/speckit.implement`.