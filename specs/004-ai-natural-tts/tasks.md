# Tasks — Leitura por voz com TTS de IA (voz mais natural)

**Feature Branch**: `004-ai-natural-tts` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-08-20

> **Metodologia**: projeto segue TDD (constitution) — para cada fatia de implementação há testes **antes** (escrever o teste que falha, confirmar a razão, implementar até verde). Nenhum teste chama TTS real: usar **fake determinístico** + MSW. Nunca commitar `.env.local`/credenciais reais.
>
> **Rótulos**: `[P]` = paralelizável (arquivos independentes). `[US#]` = user story (spec). Setup/Foundational/Polish NÃO têm rótulo de story.
>
> **Nota de remediação (/speckit.analyze)**: foram adicionadas tasks para cobrir itens antes sem task — SC-002 (naturalidade A/B), SC-007 (configurável por env) e FR-006 (estado de erro/indisponível com mensagem localizada), e esclarecida a natureza (fixture de teste) de `narrate.schema.ts`.

## Phase 1 — Setup (infraestrutura)

- [ ] T001 Definir/comentar as variáveis de ambiente TTS em `.env.example` conforme `research.md` (§5): `AI_NARRATION_ENABLED` e `OPENROUTER_TTS_MODEL` (server-only, nunca no cliente)
- [ ] T002 [P] Criar os tipos de referência dos testes de contrato: `tests/unit/tts.contract.ts` (fixture de teste, NÃO código de produção) exportando `NarrateRequest`/`NarrateError` alinhados ao `contracts/tts.openapi.yaml`; não criar arquivo de schema separado em `src/` (o schema real será Zod na rota/contrato)
- [ ] T003 Criar a base de catálogos i18n do recurso: `src/features/story-read-aloud/locales/pt-BR.json` e `en.json` com as chaves de estado/erro da narração (lendo/parado/erro/indisponível), seguindo o padrão next-intl do repo

## Phase 2 — Foundational (bloqueia todas as stories)

- [ ] T004 [P] Definir a interface base do provider TTS: `src/features/story-read-aloud/server/tts-provider.ts` — `TtsProvider { synthesize(text, opts): Promise<{ format, audio }> }` + `TtsProviderError` com `kind` (`unavailable`/`timeout`/`invalid`/`over_limit`), espelhando `StoryGenerationProvider`/`ProviderError`
- [ ] T005 [P] Documentar o endpoint no contrato já criado: garantir `POST /api/narrate` no `contracts/tts.openapi.yaml` reflete `NarrateRequest`/`NarrateResponse`/erros (200 audio / 204 IA desativada / 400 / 429 / 502)
- [ ] T006 Contract test do provider: `tests/unit/tts-provider.contract.test.ts` — a interface/tipos satisfazem `NarrateRequest`/`NarrateError` e o `ProviderError.kind`; (teste de contrato; falha se tipos mudarem)

## Phase 3 — [US1] Narração natural de IA (caminho feliz)

**Objetivo da story (P1)**: o responsável aciona "ouvir" e ouve a cena narrada por voz de IA natural, sob demanda, com estados acessíveis e interrupção por navegação.

- [ ] T007 Escrever teste (falha) do provider fake de TTS: `tests/unit/tts/fake.ts` + `tests/unit/tts-provider.test.ts` — `synthesize()` devolve um Blob MP3 determinístico; erro tipado quando configurado
- [ ] T008 [P] [US1] Implementar `src/features/story-read-aloud/server/openrouter-tts-provider.ts` — chama o modelo TTS configurado (`output_modalities=speech`), retorna bytes; erro tipado `TtsProviderError`; `Cache-Control` via header da rota
- [ ] T009 Escrever teste (falha) do runtime: `tests/unit/tts-runtime.test.ts` — encadeia provider fake, devolve áudio; marcador `mode: 'ai'`
- [ ] T010 [P] [US1] Implementar `src/features/story-read-aloud/server/tts-runtime.ts` — resolve provider (default fake/real por env), orquestra `synthesize`, define `mode`; em falha/indisponibilidade com IA ativa, propaga erro tipado (sem fallback para Web Speech)
- [ ] T011 Escrever teste (falha) da rota: `tests/unit/narrate-route.test.ts` / contrato `POST /api/narrate` com MSW — 200 audio para payload válido; 400 para `sceneText` vazio/`locale` inválida; validação zod
- [ ] T012 [US1] Implementar `src/app/api/narrate/route.ts` — rota server-only, revalidação zod (`NarrateRequest`), `Cache-Control: no-store`, delega ao `tts-runtime`, devolve bytes de áudio; só `sceneText`/`locale`, sem identificador
- [ ] T013 Escrever teste (falha) do hook client: `tests/unit/use-ai-read-aloud.test.tsx` — `toggle()` chama `/api/narrate` (MSW), toca Blob via `<audio>`, expõe `speaking`/`mode`; interrompe ao trocar de cena
- [ ] T014 [US1] Implementar `src/features/story-read-aloud/client/use-ai-read-aloud.ts` e `tts-state.ts` — estende o padrão de `use-read-aloud`; busca áudio sob demanda, `URL.createObjectURL`, revoga ao parar/trocar cena; estados `idle/speaking/stopping/error` com `aria-live`
- [ ] T015 [US1] Integrar no leitor: `src/features/story-reader/components/story-reader.tsx` e `scene-view.tsx` — substituir rota do controle para `use-ai-read-aloud` (mantendo `use-read-aloud` como base p/ `AI_NARRATION_ENABLED=false`) e adicionar catálogo local + estado de erro quando IA ativa falha
- [ ] T016 [P] [US1] E2E do caminho feliz: `tests/e2e/ai-read-aloud.spec.ts` (provider fake) — abrir história, acionar "ouvir" na cena, estado `speaking`/`mode:ai`, interromper ao navegar; sem chamada a TTS real; inspecionar payload do `/narrate` (só `sceneText`/`locale`)
- [ ] T017 [P] [US1] Teste de naturalidade/preferência (SC-002): `tests/unit/naturalness-preference.test.ts` — comparação determinística A/B entre voz de IA (blob fake rotulado) e voz de sistema; implementa o critério de preferência e assere que o caminho IA é selecionado por padrão quando habilitado; serve como base verificável do SC-002 (o estudo com participantes de ≥80% é coberto em observação/E2E documentada no `quickstart.md`)

## Phase 4 — [US2] Erro controlado quando a IA ativa falha (P2)

**Objetivo**: com `AI_NARRATION_ENABLED=true`, se o TTS de IA estiver indisponível/erro, o app apresenta **erro acessível e compreensível** sem cair para voz de sistema; texto sempre legível; retries limitados.

- [ ] T018 Escrever teste (falha) de erro controlado: `tests/unit/use-ai-read-aloud.test.tsx` (extensão) — provider fake devolve erro 429/502 ⇒ hook entra em estado de erro acessível; **nenhum** áudio de Web Speech é tocado; não tenta infinitamente
- [ ] T019 [US2] Implementar tratamento de erro no cliente: `src/features/story-read-aloud/client/use-ai-read-aloud.ts` — em erro com IA ativa, define estado `error` (`mode:'ai'` + mensagem acessível), sem delegar a Web Speech; se `AI_NARRATION_ENABLED=false`, usa `use-read-aloud` (Web Speech)
- [ ] T020 [US2] Implementar propagação de erro no runtime: `src/features/story-read-aloud/server/tts-runtime.ts` — em falha/indisponibilidade do provider com IA ativa, propaga erro tipado (502/429) em vez de chamar de novo; loga apenas metadados (sem conteúdo)
- [ ] T021 Escrever teste (falha) de indisponibilidade no runtime: `tests/unit/tts-runtime.test.ts` — 429/502/sem-rede ⇒ retorna erro tipado (não `throw` duro para o usuário, mas **sem** fallback), sem retry infinito
- [ ] T022 [P] Escrever teste (falha) de validação de tamanho do texto: `tests/unit/narrate-route.test.ts` — `sceneText` que excede o limite do schema (constante de validação) ⇒ 400 sem chamar TTS; dentro do limite ⇒ chama normalmente
- [ ] T023 [P] [US2] Teste de aceitação do estado indisponível sem voz (FR-006): `tests/e2e/ai-read-aloud.spec.ts` (ou unit do hook) — com IA ativa e sem voz/idioma no provedor ⇒ estado de erro acessível (mensagem localizada), texto da cena permanece legível; acessível (`aria-live`)
- [ ] T024 [P] [US2] E2E do erro controlado: estender `tests/e2e/ai-read-aloud.spec.ts` — forçar falha do provider (fake/MSW) ⇒ estado de erro acessível, sem Web Speech, história legível; repetição não infinita

## Phase 5 — [US3] Geração sob demanda e zero persistência (P2)

**Objetivo**: narração só quando o usuário aciona "ouvir"; áudio nunca persistido; recarregar não re-apresenta; rota `no-store`.

- [ ] T025 Escrever teste (falha) de zero persistência/anonimato: `tests/e2e/ai-read-aloud.spec.ts` (novo caso) — sem chamada a `/narrate` antes do "ouvir"; recarregar não re-apresenta áudio; nenhum cookie/localStorage criado; rede bloqueada a não-local
- [ ] T026 [US3] Garantir `no prefetch` e transparência no cliente: `src/features/story-read-aloud/client/use-ai-read-aloud.ts` — chamar `/narrate` apenas no `toggle()`; revogar `objectURL` ao parar/trocar cena; não manter referência persistente
- [ ] T027 [US3] Garantir `no-store`/sem log na rota: `src/app/api/narrate/route.ts` — `Cache-Control: no-store`, sem log do `sceneText`; teste de contrato confirma header e ausência de conteúdo nos logs
- [ ] T028 [P] [US3] Story de acessibilidade/estado: `src/features/story-read-aloud/components/narration-control.stories.tsx` (default/loading/error/disabled) cobrindo novos estados; a11y WCAG A/AA (contraste/foco/keyboard/reduced-motion)

## Phase 6 — Polish & Cross-Cutting

- [ ] T029 Rodar `pnpm lint` (0 warnings), `pnpm format:check` (nenhum drift), `pnpm typecheck` e corrigir tudo antes de concluir
- [ ] T030 [P] Rodar `pnpm test` (unit/contrato/pipeline novos, sem regressão) e `pnpm test:coverage:check` — gates ≥80% global; ≥90% em safety/validation/orchestration (sem regressão)
- [ ] T031 [P] Rodar `pnpm storybook:test` (novos stories, 0 a11y violations) e `pnpm test:e2e` (com fake provider), `pnpm test:visual`, `pnpm test:performance` (JS ≤250 KiB — TTS NÃO no bundle inicial; LCP/nav/geração budgets)
- [ ] T032 [P] Atualizar documentação: `README.md` e `specs/004-ai-natural-tts/quickstart.md` com a narração por IA + erro controlado + variáveis de env + registro do método do SC-002; `tasks.md` marcando concluídos (evidência final)
- [ ] T033 Rodar `pnpm build` (produção) e confirmar que `/api/narrate` é dinâmico e `POST /api/stories` continua `no-store`; invariantes de anonimato testados

---

## Dependencies & order

- **Ordem de stories**: US1 → US2 → US3 (mas US2/US3 só dependem de **Foundational** T004, não de US1 completo; podem ser paralelas se os arquivos não colidirem).
- **Blocos**: Setup (T001–T003) → Foundational (T004–T006) bloqueia US1/US2/US3 → US1 faz T007–T017 → US2 T018–T024 → US3 T025–T028 → Polish T029–T033.

```text
T001--T002--T003                       # Setup (T002 e T003 paralelizáveis)
      |            |
T004--T005--T006                       # Foundational bloqueia stories
      |        |        |
      +--------+--------+---> US1 (T007..T017)
      |                        US2 (T018..T024) — paralela a US3 se diferentes arquivos
      |                        US3 (T025..T028)
      ---------------------> Polish T029..T033
```

## Parallel execution examples

- **Setup**: T002 e T003 podem rodar em paralelo (arquivos independentes: fixture de teste vs catálogos i18n).
- **Foundational**: T004 e T005 são independentes (interface provider vs contrato YAML); T006 depende de T004.
- **US1**: T007 é pré-requisito de T008/T010; T016 e T017 são independentes (E2E vs teste de naturalidade) e podem rodar em paralelo após T012/T014.
- **US2/US3**: T018–T024 (erro controlado + indisponível) e T025–T028 (persistência) tocam arquivos diferentes (client/runtime/rota vs specs de teste) → podem ser paralelizadas APÓS T004.
- **Polish**: T030, T031, T032 são independentes (suítes diferentes); rodam em paralelo; T033 por último (build).

## Independent test criteria (por story)

- **US1**: abrir uma história (fake), acionar "ouvir", o áudio de IA toca (Blob determinístico), estado `speaking`/`mode:ai`, interrompe ao trocar de cena — tudo dentro de uma única spec E2E + unit do hook/route; SC-002 verificado por teste comparativo (T017) + observação documentada.
- **US2**: com IA ativa e falha do provider (429/502) ⇒ erro controlado acessível, sem Web Speech, retries limitados; estado indisponível sem voz testado (T023).
- **US3**: sem chamada a `/narrate` antes do "ouvir"; recarregar não re-apresenta áudio; rota `no-store`; rede bloqueada a não-local — verificação isolada via E2E de privacidade + teste de contrato da rota.

## Implementation strategy

- **MVP**: entregar primeiro **US1** (narração de IA no caminho feliz com fake provider + teste de naturalidade SC-002), depois **US2** (erro controlado e indisponível) para robustez e **US3** (zero persistência/invariantes). Cada story termina verde e testável de forma independente; o Polish confirma gates/budget/cobertura e atualiza docs/evidência (incluindo o registro do método de observação do SC-002 no `quickstart.md`).
