# Contracts — Sistema multi-agente de geração de histórias

**Phase 1 output** — contratos de interface do pipeline multi-agente.

Dois conjuntos de contrato:

1. **Contrato externo (público) — INALTERADO**: `POST /api/stories` conforme
   `specs/002-generate-more-scenes/contracts/story-generation.openapi.yaml`. Este plano **não
   altera** o shape de `GeneratedStory`, métodos, códigos de erro, nem `Cache-Control: no-store`
   (SC-006). O endpoint `/api/narrate` (também já publicado) permanece como entrega de áudio por
   demanda da role Reader.
2. **Contrato interno (pipeline de agentes) — NOVO**: documentado abaixo. É a orquestração que
   substitui a chamada monolítica, com assinaturas tipadas para coordenação, retry e erro por
   estágio.

## Contrato interno: Pipeline de agentes

Orquestração por **funções tipadas em processo** (research.md §1). Assinatura pública do pipeline:

```
generateStoryPipeline(ctx: JobContext): Promise<AgentResult<GeneratedStory>>
```

### Etapas e dependências (ordem obrigatória)

```
Planner → Writer → Reviewer ┬→ Illustrator → (imagens por cena)
                             └→ Reader      → (áudio por demanda, opcional/ativado por config)
```

- **Reviewer** opera sombre a saída do **Writer** (gate antes de ilustração).
- **Illustrator** e **Reader** NUNCA antecedem a aprovação das cenas.
- **Coordinator** encadeia; aplica `retry.ts` (default `maxAttempts=2`, configurável via env
  server-only) e monta `GeneratedStory` apenas quando todos os estágios obrigatórios concluírem.

### Tipos (resumo — detalhe em `data-model.md`)

- `JobContext` — entrada anonimizada (`ageBand`, `locale`, `theme`, `sceneCountRequested`, trace token).
- `AgentResult<T> = Ok<T> | Err{stage, message, transient}` — erro tipado por estágio.
- `Outline`, `Scene`, `SafetyVeredict` — saídas dos agentes ($data-model).
- `GeneratedStory` — contrato externo preservado.

### Regras de resposta

- `Err` com `transient=false` (ou esgotados retries) → resposta de erro tipado; **nunca**
  `GeneratedStory` parcial.
- `Err` vindo do Reviewer pós-regeneração → erro seguro, genérico e localizado.
- Sucesso: `Ok(GeneratedStory)` completo — narrativa + todas as ilustrações; áudio por demanda
  (não embutido).

### Erros (código de estágio → retorno)

| Estágio | Condição | Retorno |
|---------|----------|---------|
| planner/writer | falha transiente esgotada | erro tipado `Err{stage}` |
| reviewer | candidato inseguro pós 1 regeneração | erro seguro genérico localizado |
| illustrator | conjunto parcial de imagens | erro tipado (não "sucesso" parcial) |
| reader | áudio indisponível | erro/fallback controlado (nunca quebra história completa) |

### Versionamento / referências de contrato público

- `POST /api/stories` → `specs/002-generate-more-scenes/contracts/story-generation.openapi.yaml`
  (invariante; não editado neste plano).
- `POST /api/narrate` → contrato de áudio existente da feature `story-read-aloud` (mantido).
