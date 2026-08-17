# Reviews — Consolidação da Orquestração dos Adapters de Provider

**2026-08-17** — Início do recurso. Espec, plano e tarefas criados a partir da auditoria de código
(duplicação `generateStory`/`moderateText`/`moderateImage` entre `openrouter` e `opencode`).

## Decisões a registrar

- **D1**: Formato Spec Kit (decisão do usuário) — branch + spec `013-refactor-provider-orchestration`.
- **D2**: Escopo completo (US1 factory; US2 adapters finos; US3 paridade + gates). Feature
  **behavior-preserving** — nenhuma mudança de UI, contrato, env ou prompt.
- **D3**: A factory recebe o **client OpenAI pronto** (tipo `OpenAI`, do pacote `openai`) + modelos
  + `fetchImpl?`; a construção do client (`getClient()` com `baseUrl`/`defaultHeaders`/app-identity)
  permanece em cada adapter (Decisão-3 do `plan.md`).
- **D4**: Corpo da factory movido **verbatim** dos adapters — sem editar semântica/prompt/timeout/
  retry/erro (`diff` vazio antes de consolidar).
- **D5**: ADR-0010 já criado e commitado no setup (T032 = revisar, não criar — remediado no analyze).

## Confirmações pendentes durante a implementação

- [ ] Restaurar `.specify/feature.json` para `012-fake-content-catalog` ao final conforme workflow
  (`T035`).
- [ ] Prova de ausência de duplicação fora de `provider-core/` por grep (`T030`, SC-004).
- [ ] Follow-up de imagem: se houver drift entre `createOpenRouterIllustration`/
  `create-opencode-illustration` e `provider-core/image-client.ts` e o diff **não** for trivial
  (mudança mecânica, ≤ ~15 linhas, sem alteração de comportamento, coberto por teste existente),
  registrar aqui como follow-up e **não** mesclar nesta feature (Decisão-4; `T022`).

## Review de Implementação (a preencher)

> Pendente de `/speckit.implement` — registros de US1/US2/US3 e SC-001..SC-005 serão adicionados
> aqui durante a implementação.
