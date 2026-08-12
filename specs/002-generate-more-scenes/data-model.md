# Data Model: Gerar mais cenas (contagem variável 3–5)

**Feature**: `002-generate-more-scenes`
**Persistence model**: identico ao `001` — **apenas memória do browser**. Não há banco, conta,
cookie, localStorage/session storage ou armazenamento server-side de histórias. O único estado
server-side efêmero permanece o registro anônimo de rate-limit (chave pseudo-anônima, sem história
e sem identificador).

## Privacy Boundary

A feature **não coleta o nome nem qualquer identificador direto** da criança. A única superfície
nova é um **campo inteiro e anônimo** `sceneCount` (3–5) na requisição. Nenhum valor livre é
aceito; faixa fixa. Todos os invariantes de `001` (sem nome/idade exata em payloads/provedores,
plano-texto, `no-store`) permanecem inalterados.

| Dado | Onde pode existir | Onde não deve existir |
|------|-------------------|----------------------|
| `sceneCount` (inteiro 3–5) | Estado do form (memória), payload da requisição, prompt server-interno, história retornada | Storage durável, logs de conteúdo, analytics |
| Nome/identificador direto | Em lugar nenhum | Tudo (inalterado) |
| Idade exata | Input/estado ativo no browser | Payloads do provider, logs, storage durável |

## Enumerations e Configuração (mudanças em relação a 001)

| Name | Valores | Regra |
|------|---------|-------|
| `SceneCount` | `3`, `4`, `5` (**novo**) | Inteiro 3–5 com **default 3**. Faixa fixa; derivada de constantes `MIN_SCENES`/`MAX_SCENES`; nenhum texto livre. |
| `Locale` | `pt-BR`, `en` | Inalterado. |
| `AgeBand` | `2-4`, `5-7`, `8-9` | Inalterado em relação ao 001 (banda superior `8-9`). |
| `Theme` | `courage`, `friendship`, `kindness` | Inalterado; temas livres fora de escopo. |
| `StoryStatus` | ... (inalterado) | O fluxo de status aplica-se a qualquer contagem. |
| `SafetyDecision` | `approved`, `regenerated`, `rejected` | Inalterado. |

## Client-Only Entities (campos alterados)

### `StoryPreferences`

| Campo | Tipo | Validação / Notas |
|------|------|-------------------|
| `age` | integer | Inalterado (2–9, client-only). |
| `locale` | `Locale` | Inalterado. |
| `theme` | `Theme` | Inalterado. |
| `sceneCount` | `SceneCount` (**novo**) | Obrigatório na UI; **default 3**; opções 3/4/5; reflete a escolha do responsável. |

### `GeneratedStory`

| Campo | Tipo | Validação / Notas |
|------|------|-------------------|
| `scenes` | `GeneratedScene[K]` | **Mudou**: `K ∈ {3,4,5}` (era exatamente 3). `ordinal` 1..K, único, contíguo, ascendente. |
| `locale`, `theme`, `ageBand`, `title`, `id`, `createdAt` | ... | Inalterado. |

### `GeneratedScene`

| Campo | Tipo | Validação / Notas |
|------|------|-------------------|
| `ordinal` | integer | **Mudou**: 1..K com `K ∈ {3,4,5}` (era 1–3). único/contíguo. |
| `title`, `body`, `illustrationDataUri`, `altText` | ... | Inalterado. |

## Server/API Entities (campos alterados)

### `GenerateStoryRequest`

| Campo | Tipo | Validação / Notas |
|------|------|-------------------|
| `ageBand` | `AgeBand` | Inalterado. |
| `locale` | `Locale` | Inalterado. |
| `theme` | `Theme` | Inalterado. |
| `sceneCount` | `SceneCount` (**novo**) | **Opcional, default 3** (`z.optional().default(3)`); revalidado no servidor (contrato) antes de chamar o provider; `400 invalid_input` se fora de 3–5. |

### `SafeGeneratedStory`

| Campo | Tipo | Validação / Notas |
|------|------|-------------------|
| `sceneCount` | `SceneCount` (**novo**) | Eco do `sceneCount` validado da requisição. |
| `scenes` | `SafeGeneratedScene[K]` | **Mudou**: `K ∈ {3,4,5}` (era exatamente 3). O orquestrador garante sucesso **completo** (nunca parcial). |
| demais | ... | Inalterado. |

### `SafeGeneratedScene`

`ordinal` 1..K (`K ∈ {3,4,5}`). Demais campos inalterados.

## Validação (regras adicionais/alteradas)

1. `sceneCount` é inteiro 3–5; faixa fixa no cliente (erro localizado) e revalidada no servidor.
2. A requisição **sem** `sceneCount` assume **3** — comportamento idêntico ao `v1`.
3. Uma história **só é sucesso** se tiver exatamente `sceneCount` cenas **todas** moderadas e com
   ilustração (FR-005, FR-008, SC-004). Conjunto parcial nunca é tratado como sucesso.
4. `ordinal` é 1..K, único, contíguo, em ordem de leitura ascendente.
5. O teto end-to-end é **≤120s** para todas as contagens (SC-001); o dimensionamento do timeout
   provider/retries por `K` é adiado para a implementação após medição real (FR-008). `K=5` é o caso esperadamente mais lento.

## Relações (mudanças)

```text
StorySession 1 ── 0..N GeneratedStory
GeneratedStory 1 ── K GeneratedScene          # K ∈ {3,4,5}
StoryPreferences 1 ── 0..N GeneratedStory     (associação só em memória; sceneCount é escolha atual)
GenerateStoryRequest 1 ── 1 SafeGeneratedStory
SafeGeneratedStory 1 ── K SafeGeneratedScene  # K ∈ {3,4,5}
```

Nenhuma relação representa usuário, biblioteca, registro de banco ou asset de storage durável.
