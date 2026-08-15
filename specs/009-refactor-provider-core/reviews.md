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
- [ ] `build-story-pdf.tsx` re-declara `WEBP_DATA_URI_PREFIX`: reutilizar via re-export seguro vs
  manter por fronteira (decisão na revisão de US2).
- [ ] Restaurar `.specify/feature.json` para `007` ao final conforme workflow.

---

*(secções seguintes a preencher conforme cada fase de review/converge.)*
