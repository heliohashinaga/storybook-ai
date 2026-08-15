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

- [ ] `image-optimizer.ts` órfão: integrar ao `image-client.ts` vs consolidar/remover (decisão na
  revisão de US2).
- [ ] `build-story-pdf.tsx` re-declara `WEBP_DATA_URI_PREFIX`: reutilizar via re-export seguro vs
  manter por fronteira (decisão na revisão de US2).
- [ ] Restaurar `.specify/feature.json` para `007` ao final conforme workflow.

---

*(secções seguintes a preencher conforme cada fase de review/converge.)*
