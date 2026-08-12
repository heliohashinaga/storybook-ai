# Quickstart / Validação — Leitura por voz com TTS de IA

**Feature**: `004-ai-natural-tts` | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/tts.openapi.yaml](contracts/tts.openapi.yaml) | **Dados**: [data-model.md](data-model.md)

> Guia de validação **executável** para provar a feature ponta-a-ponta. Não repõe `tasks.md`; aqui estão os cenários e comandos de verificação, usando **provider fake determinístico** (nenhum teste chama TTS real) e respeitando os invariantes de anonimato.

---

## Pré-requisitos

- Node 22+, `pnpm install`. (Não é necessário `AI_NARRATION_ENABLED`/`TTS_*` para testes: o fake/provider local substitui por padrão.)
- Suítes já existentes verdes (baseline): `pnpm test` (307), `pnpm storybook:test`, `pnpm test:e2e` (fake provider), `pnpm test:visual`, `pnpm test:performance`.

## Variáveis de ambiente (server-only, para o caminho IA real)

| Variável | Default | Uso |
|----------|---------|-----|
| `AI_NARRATION_ENABLED` | `false` | Liga o caminho TTS de IA. `false` ⇒ sempre Web Speech fallback (seguro). |
| `TTS_PROVIDER` / `TTS_MODEL` | Kokoro-class | Perfil custo-vs-naturalidade (Q2-C). |
| `TTS_MAX_CHARS_PER_SCENE` | `2000` | Teto de chars por cena. |
| `TTS_MAX_RETRIES` | `1` | Retries em falha antes do fallback. |
| `TTS_MAX_COST_PER_READ` | pequeno | Teto monetário estimado por leitura. |

---

## Cenários de validação

### Cenário 1 — Narração de IA (caminho feliz) [US1]

- **Setup**: fake TTS determinístico (dev) devolve um `Blob` MP3 curto; `AI_NARRATION_ENABLED=true` com fake.
- **Comando** (unit/contrato): `pnpm test -- tts` → provas que `tts-runtime` chama provider, devolve áudio e marca `mode: ai`.
- **E2E** (provider fake): abrir uma história, acionar "ouvir" na cena → `state.speaking` em `ai`; interromper ao trocar de cena.
- **Esperado**: narração audível, iniciar/parar correto, interrupção por navegação; estado acessível (`aria-live`/`aria-busy`) anunciando "lendo"/"parado". (Contrato: `tts.openapi.yaml` → `POST /api/narrate` → 200 audio.)

### Cenário 2 — Fallback progressivo quando a IA falha [US2]

- **Setup**: fake/TS que força erro (ex. 429/502/tetos); `AI_NARRATION_ENABLED=true`.
- **Comando** (unit+e2e): após erro do provider, o cliente usa Web Speech local; nenhum erro "duro".
- **Esperado**: 1ª leitura tenta IA; ao falhar (dentro de `TTS_MAX_RETRIES`), cai para voz de sistema com anúncio de que a voz padrão está em uso; repetições não tentam infinitamente.

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

### Cenário 5 — Acessibilidade (WCAG A/AA) e reduced-motion

- **Setup**: Storybook + test-runner/axe.
- **Comando**: `pnpm storybook:test`.
- **Esperado**: novos estados do controle de narração (carregando/erro/fallback) sem violações A/AA; foco/teclado ok; `prefers-reduced-motion` honrado; contraste ≥ 4.5:1 em texto normal.

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