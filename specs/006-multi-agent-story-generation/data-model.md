# Data Model — Sistema multi-agente de geração de histórias

**Phase 1 output** — entidades e regras de validação derivadas da spec. O **contrato externo**
(`POST /api/stories` → `GeneratedStory`) NÃO muda; estas entidades são **internas ao pipeline** e
transitórias (em memória por pedido). Nenhuma é persistida.

> Convenção: entidades internas usam `AgentResult`/`Ok`/`Err` tipados (union). Campos marcados
> `*` são obrigatórios. Todas as strings de erro/sucesso localizadas via next-intl.

## 1. Agente / Role

Responsabilidade de um estágio do pipeline. Não é persistido — instância transitória por pedido.

- `id`: `"coordinator" | "planner" | "writer" | "reviewer" | "illustrator" | "reader"`
- `role`: responsabilidade textual (ex.: "gate de segurança")
- `policy`: `{ maxAttempts: number }` — herdado do Coordinator (`retry.ts`), default `2`

**Regras**:
- Cada agente recebe SOMENTE dados anonimizados: `ageBand`, `locale`, `theme` (nunca nome/id).
- Output do agente é tipado via `AgentResult<T>` (ver §5).

## 2. JobContext (contexto do pedido)

Input compartilhado, imutável por pedido.

- `ageBand`: `"2-4" | "5-7" | "8-9"` *(derivado da idade exata em memória, nunca a idade exata)*
- `locale`: `"pt-BR"` (default) | `"en"`
- `theme`: `"courage" | "friendship" | "kindness"`
- `sceneCountRequested`: inteiro 3..5 *(padrão 3; opcional 4-5)* — variável (002)
- `generationToken` *(interno, opcional)*: identificador de trace de pedido em memória

**Validação (server, zod, no route)**: re-validação antes de qualquer provider; idade exata não
transita.

## 3. Outline (saída do Planner)

- `scenes*`: `SceneOutline[]` — ordenada por índice
- `languageHint`*(narrativa)*: `locale`
- `voice/tone`*(opcional)*: diretriz de tom derivado do `theme`

### SceneOutline

- `index*`: inteiro
- `purpose*`: foco temático da cena (string curta, não-técnica)
- `setting`*(opcional)*: ambiente/contexto visual sugerido

**Regras**: contempla faixa `3..5` cenas; segue tema; não contém identificador direto.

## 4. Cena (resultado por cena)

- `index*`
- `narrative*`: texto localizado da cena (Writer → Reviewer)
- `imagePrompt*`: prompt de imagem **sempre em inglês** (Illustrator)
- `illustration*`: URL/asset da ilustração (opcional em transição até completar o conjunto)
- `narrativeAudio`*(opcional)*: referência/URL do áudio narrativo sob demanda (Reader) — NÃO embute
  audio como blob/base64 no payload da resposta (SC-006/SC-010); entregue por cena via `POST /api/narrate`
  (texto localizado da cena).

**Regras**:
- Nunca um conjunto parcial de ilustrações **nem** de narração vira "sucesso" (FR-005/FR-005-b).
- Ilustração/narração de cena só é gerada após aprovação do Reviewer.

## 5. AgentResult / Erro tipado

Union interna para robustez/observabilidade.

- `Ok<T>`: `{ ok: true, value: T }`
- `Err`: `{ ok: false, stage: AgentId, message: string (localizada), transient: boolean }`

**Regras**:
- `transient: true` → Coordinator refaz via `retry.ts` (`maxAttempts` default 2).
- `transient: false` (ou esgotados retries) → erro tipado final; **nunca** `GeneratedStory` parcial.

## 6. SafetyVeredict (Reviewer)

- `approved*`: booleano
- `reason`*(rejeição)*: motivo codificado (violência/tom/faixa etária/outro)
- `languageIssues / ageAppropriateness`*(opcional)*: flags de detalhe do gate

**Regras (gate autoritativo)**:
- Rejeita → Writer regenera **uma única vez** com restrições mais fortes (FR-004).
- Segundo candidato rejeitado → erro seguro genérico e localizado; nada inseguro é retornado/logado.
- Ilustração: Reviewer valida tipo de cenário sugerido só quanto a atributos não-inseguros; texto
  narrativo é a única saída de usuário que passa o gate de conteúdo.

## 7. GeneratedStory (contrato externo — INALTERADO)

Modelo existente do `POST /api/stories`. Este plano **não altera** seu shape (SC-006). O pipeline
preenche suas cenas (narrativa + ilustração) e metadados a partir dos resultados dos agentes,
mantendo fixtures/testes/leitor de exportação válidos.

**Regra global**: progresso de escrita do `GeneratedStory` é atômico — só é montado após o
Coordinator concluir todos os estágios obrigatórios com sucesso; caso contrário, erro tipado.

## Mapeamento interno → contrato externo (SC-006/SC-009)

As entidades internas do pipeline diferem do shape externo de `GeneratedStory`:
`Scene` (interna) usa `narrative`/`imagePrompt`, enquanto cada cena do contrato do `POST /api/stories`
usa `ordinal`/`title`/`body`/`illustrationDataUri`. O Coordinator faz o mapeamento interno→externo ao
montar a resposta (ver `contracts/agent-pipeline.md` e task T014), mantendo `GeneratedStory`
inalterado. Ilustração e narrativa agregam-se no `body`/`illustrationDataUri` da cena externa.

## Relacionamentos

```
JobContext 1 ──► 0..1 Outline (Planner)
Outline 1 ──► 1..N Cena
Cena 1 ──► 1 Narrative (Writer → Reviewer)
Cena 1 ──► 0..1 ImagePrompt → Illustration (Illustrator)
Cena 1 ──► 0..1 NarrativeAudio (Reader, sob demanda)
GeneratedStory 1 ──► 0..1 AgentResult: Ok(GeneratedStory) | Err(stage)
```
