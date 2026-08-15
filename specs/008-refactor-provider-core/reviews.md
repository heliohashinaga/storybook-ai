# Reviews — Núcleo Comum dos Adapters de Provider

**2026-08-14** — Início do recurso. Espec, plano e tarefas criados a partir de auditoria de código.

## Decisões a registrar

- **D1**: Formato Spec Kit (decisão do usuário).
- **D2**: Escopo completo (US1 núcleo texto/moderação; US2 transporte/encoding de imagem; US3
  higiene + gates finais).
- **D3**: Prompts duplicados tratados como baseline canônico — movidos sem editar conteúdo
  (`diff` vazio antes de consolidar).
- **D4**: Contrato público inalterado.

## Confirmações pendentes durante a implementação

> **Atualização (2026-08-14)**: confirmado por grep que `image-optimizer.ts` é **órfão em
> produção** — `optimizeImageBytes`/`DEFAULT_MAX_DATA_URI_LENGTH` nunca são chamados em nenhum
> arquivo de `src/`. A guarda de data-URI (4 MiB) **não está aplicada no runtime real de geração**.
> Integrar o `image-client.ts` ao `image-optimizer.ts` (US2) fecha essa lacuna — o encoding/resize
> passa a rodar no caminho real, não só nos testes.

- [x] `image-optimizer.ts` órfão em produção (confirmado): integrar ao `image-client.ts` usando
  `optimizeImageBytes`/`defaultSharpEncoder` no caminho real, aplicando `DEFAULT_MAX_DATA_URI_LENGTH`
  (decisão: integrar, pois a guarda é exigida e hoje não roda em produção).
- [x] `build-story-pdf.tsx` re-declara `WEBP_DATA_URI_PREFIX`: **decisão por fronteira** —
  `build-story-pdf.tsx` é client (`"use client"`) e `provider-core` é `server-only`; a constante foi
  deixada re-declarada localmente no client (T021).
- [ ] Restaurar `.specify/feature.json` para `007` ao final conforme workflow.

## Review de Implementação (2026-08-15)

### US1/US2 — `provider-core` extraído (commit `bdc20b4`)

- Criado `src/features/story-generation/server/provider-core/` com `schemas.ts`, `prompts.ts`,
  `chat-json.ts`, `provider-errors.ts`, `moderation.ts`, `image-client.ts` e `index.ts` (server-only).
- Adaptadores thin shell: openrouter 350→168; opencode 231→120; `create-opencode-illustration` 125→60.
- **SC-001**: zero definição duplicada fora de `provider-core/` (grep confirmado).
- **SC-005**: reduções substanciais (abertorouter não atingiu o alvo exato 80–100 por reter o wrapper
  `createOpenRouterIllustration`; redução mesmo assim de 52%).
- **image-optimizer un-orphaned**: `image-client.ts` usa `optimizeImageBytes`/`WEBP_DATA_URI_PREFIX`,
  com fallback ao data-URI não-conservado quando o optimizador rejeita — a guarda de 4 MiB do
  `illustrator.ts` continua como garantia final.
- **Testes**: baseline 501 → 535 (30 novos em `tests/unit/provider-core/` + 4 de US4), todos verdes;
  fixtures dos adapters inalteradas (SC-002).
- **ADR**: criado `docs/adr/0008-provider-core-extraction.md` (T028).

### US3

- [x] **T023**: `generation-runtime.ts` sem mudanças — imports e roteamento por provider intactos.
- [x] **T024**: `fixed-dev-provider.ts` mantido como está — é **dados** (copy por tema/locale), não
  duplicação de lógica de helpers; consolidar com fixtures de teste criaria acoplamento dev×teste sem
  benefício. Decisão documentada.
- [x] **T026**: contrato OpenAPI inalterado (N.A.).
- [x] **T027**: verificação de privacidade — nenhum identificador novo introduzido; fronteira
  `server-only` mantida (grep/review).
- [ ] **T025/T028/T035**: gates finais + ADR + restore em andamento.

---

*(secções seguintes a preencher conforme cada fase de review/converge.)*
