# Data Model — Spec 009 Frontend Routes

Esta spec **não introduz entidades persistentes**. O produto permanece 100%
anônimo: os únicos "objetos" são estado de interface e URI, ambos em memória/não
sensíveis. Nada é serializado a cookies, localStorage, indexDB ou cache.

## 1. Rota (URI) — representa apenas o **tipo de tela**

Cada rota codifica unicamente a etapa do fluxo de UI. Não há dado de conteúdo.

| Campo     | Tipo       | Exemplo     | Persistente? | Sensível? |
|-----------|------------|-------------|--------------|-----------|
| `path`    | string     | `/form`     | não (URL)    | não       |
| `screen`  | enum       | `form`/`reader`/`export` | não (in-memory) | não |

### Query param opcional (não persistido)
- `?story=<i>` — **índice** de conta da sessão (`0 ≤ i < storyCount()`).
  Usado só para sugerir a seleção no multihistória; **sempre revalidado** contra a
  lista em memória; fora de faixa ⇒ ignorado (cai na conta ativa). Nunca
  armazenado, nunca decodifica conteúdo.

## 2. Estado de Sessão (in-memory, não alterado)

Reusado do contexto; esta spec apenas **expõe guarda de leitura** (sem
serializar):

| Campo          | Tipo      | Anotação |
|----------------|-----------|----------|
| `hasSession()` | boolean   | true se há ≥1 história concluída |
| `storyCount`   | int       | nº de histórias em memória |
| `activeIndex`  | int       | índice da conta ativa selecionada |

> Nota de privacidade: idade exata, `ageBand`, `locale`, `theme` e o conteúdo das
> histórias **continuam apenas em memória** e **nunca** aparecem em URL/params.

## 3. Invariantes

1. `path` + `?story=` (índice) são os únicos dados em URL; nunca `story`, idade,
   `ageBand`, `locale`, UUID ou identificador.
2. Sem cookies/localStorage/indexDB/cache — nenhuma entidade desta spec é durável.
3. `POST /api/stories` continua único entry point de servidor.
4. Validação do `?story=` no client: se `i`, se `i ≥ storyCount` ⇒ ignora.

> **Nota — `?story=` é seleção, não etapa de geração.** O índice não tem relação
> com as etapas de progresso (`writing`→`illustrating`→`reviewing`), que são
> data-driven por tempo e não tocam a URL. A tela de progresso de geração
> continua efêmera dentro de `/form` e **não possui rota/param próprios**.
