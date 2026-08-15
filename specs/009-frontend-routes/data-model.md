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

> **Sem query param de seleção.** A seleção da conta ativa no multihistória é
> feita inteiramente via `StorySessionContext` (UI interna). O `?story=<i>` foi
> **adiado / fora do escopo** desta spec (decisão `/speckit.clarify`, 2026-08-15)
> — `/reader` não recebe índice pela URL nesta entrega.

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

1. `path` (tipo de tela) é o único dado em URL; nunca `story`, idade,
   `ageBand`, `locale`, UUID ou identificador — e **nenhum** query de seleção
   (`?story=` adiado/fora de escopo).
2. Sem cookies/localStorage/indexDB/cache — nenhuma entidade desta spec é durável.
3. `POST /api/stories` continua único entry point de servidor.

> **Nota — sem rota por história.** Como nada persiste (invariante 2), uma rota
> que enderece uma história específica (`/story/{id}` ou por query) seria
> **inválida por design**: exigiria persistência ou embutir conteúdo na URL, o
> que viola o anonimato do AGENTS.md. A seleção multistória permanece só via
> memória (`StorySessionContext`), sem representação na URL.
