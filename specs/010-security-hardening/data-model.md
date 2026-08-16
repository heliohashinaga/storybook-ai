# Modelo de Dados — Hardening de Segurança 2026

**Sem mudança de modelo de dados.** Esta feature trata exclusivamente de
hardening de segurança; **nenhum** contrato de dados público muda.

- Contratos de entrada/saída permanecem conforme
  `contracts/story-generation.openapi.yaml` e os Zod `.strict()` em
  `src/features/story-generation/server/schemas.ts` e
  `src/features/story-read-aloud/server/narrate-http-errors.ts`.
- **Invariante preservado:** servidor recebe apenas `ageBand` | `locale` |
  `theme` | `sceneCount` (stories) e `sceneText` (≤2000) | `locale` (narrate).
- **Nenhuma identidade persistida:** a única chave em memória é o hash saltado
  do IP usado em rate-limit (curto-lived); PR #2 ajusta *como* essa chave é
  derivada (IP confiável vs `ANONYMOUS_GLOBAL_KEY`), mas não o que é persistido.

Se um PR futuro (ex.: PR #3) apenas trocar versões de dependência, o modelo
permanece inalterado.
