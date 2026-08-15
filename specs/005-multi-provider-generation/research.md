# Research: Geração multi-provedor (roteamento por capacidade)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `005-multi-provider-generation`

Este documento resolve os pontos técnicos de configuração e roteamento de capacidade para o adapter dual (OpenCode texto/moderação + OpenRouter imagem). Todas as decisões seguem o esquema **somente novo** (D5-C) e a convenção de rotação por segmento `provedor/resto` (D2/FR-002).

---

## R1. Endpoint e formato do OpenCode (texto + moderação)

- **Decision**: Provedor OpenCode usa o ponto **OpenAI-compatible** `https://opencode.ai/zen/go/v1` com `Authorization: Bearer OPENCODE_GO_API_KEY`; `/chat/completions` para texto e moderação; `/models` para listagem.
- **Rationale**: O endpoint `zen/go/v1` é compatível com o cliente OpenAI (chat completions), o que permite **reutilizar o mesmo padrão** já presente no `OpenRouterStoryProvider` (SDK OpenAI com `baseUrl` injetável + `fetchImpl` para testes determinísticos). Economiza código e mantém o contrato de transporte uniforme.
- **Alternatives considered**: Usar um client dedicado do OpenCode. Não existe no projeto e adicionaria dependência sem ganho; o OpenAI-compatible já cobre o caso. Documentação oficial reforça o Bearer key e o formato de chat — ajustes pontuais a modelos com formato Anthropic (edge) ficam para a fase de implementação via note de tarefa, sem mudar o contrato.

## R2. Endpoint e formato do OpenRouter (imagem)

- **Decision**: Imagem permanece em OpenRouter `https://openrouter.ai/api/v1` (o atual `DEFAULT_BASE_URL`), reaproveitando `createOpenRouterIllustration`/`image-optimizer` (lazy `sharp`, WebP data URI) sem mudar o contrato de ilustração.
- **Rationale**: O caminho de imagem atual já é estável, testado e server-only. O spec/plano não pede migração de imagem para outro provedor — apenas separar a **capacidade texto/moderação** para OpenCode e manter **imagem** em OpenRouter. Reduz risco e escopo.
- **Alternatives considered**: Migrar imagem para OpenCode. Descartado: imagem é a única capacidade de OpenRouter no roteamento, e o caminho atual está maduro (bounded concurrency, EC5, ADR 0005). Não justifica reescrever.

## R3. Esquema de variáveis de ambiente por capacidade

- **Decision**: Novo esquema por capacidade (removendo `OPENROUTER_*`, D5-C): `OPENROUTER_API_KEY` (provedor OpenRouter, usado para imagem), `OPENCODE_GO_API_KEY` (provedor OpenCode, texto/moderação), `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL` (cada um com `provedor/resto`).
- **Rationale**: O roteador por capacidade deriva o provedor e o modelo de cada `*_MODEL` pelo primeiro segmento antes da 1ª `/` (FR-002). Exemplos de aceitação: `TEXT_MODEL=opencode-go/qwen/qwen3.7-flash`, `IMAGE_MODEL=openrouter/qwen/qwen3.7-flash`. Defaults por capacidade seguem (texto/moderação→OpenCode, imagem→OpenRouter) quando o `*_MODEL` não traz prefixo explícito. TTS/leitura em voz é roteado como as demais capacidades via `READER_MODEL` (feature `004`, consolidado neste roteamento pelo prefixo do modelo).
- **Alternatives considered**: Manter `OPENROUTER_*` com compat. A decisão D5-C já escolheu **somente o novo esquema**, sem fallback; manter dupla leitura adicionaria confusão e breaking com o contrato de env. Remoção é controlada/registrada e o Zod (`src/lib/env.ts`) valida o novo conjunto.

## R4. Roteador por capacidade (FR-002/D2)

- **Decision**: Módulo puro `provider-routing.ts` que, dado um `*_MODEL` e a capacidade (text | moderation | image), resolve `{ provider: "opencode-go" | "openrouter", model }` pela regra do primeiro segmento; retorna o provedor concreto correspondente.
- **Rationale**: Manter o roteamento **puro e testável de forma determinística** (sem chamadas externas) evita acoplamento e permite cobertura total via Vitest. O runtime monta um par de provedores (texto/moderação via OpenCode; imagem via OpenRouter) e o `POST /api/stories` os consome sob a interface `StoryGenerationProvider`/by-capability — o usuário nunca vê o roteamento (US1).
- **Alternatives considered**: Seleção hardcoded no `generation-runtime`. Rejeitado: viola o requisito de flexibilidade por capacidade (FR-002) e dificulta teste. Falha de qualquer capacidade é manejada com erro tipado (`ProviderError`/`kind`); nunca história parcial (invariante).

## R5. Testes determinísticos e fakes

- **Decision**: Manter `STORIES_TEST_MODE=fake` com `createFixedDevProvider()`; testes de roteamento, env (novo esquema) e provedores usam `fetchImpl`/fakes determinísticos; nenhum teste chama AI real. E2E/Storybook rodam com fakes e budgets vigentes.
- **Rationale**: Standard do repositório (AGENTS.md/Testing Rules; constitution testing standards) e requisito fr.000 para o roteamento dual ser testável sem provedor real. Preserva E2E determinístico, a11y e performance budgets.
- **Alternatives considered**: MSW para mockar endpoints. Não necessário — o padrão `fetchImpl` já injetado cobre os provedores de forma determinística, e adicionar MSW é custo sem ganho.

---

## Sumário consolidado de decisões

| Item | Decisão | Alternativas descartadas |
| --- | --- | --- |
| OpenCode endpoint | `https://opencode.ai/zen/go/v1` (OpenAI-compatible, Bearer key) | client dedicado do OpenCode |
| Imagem | permanece OpenRouter `/api/v1` (caminho atual, lazy sharp) | migrar imagem p/ OpenCode |
| Env | novo esquema por capacidade; remoção `OPENROUTER_*` (D5-C) | compat dupla com `OPENROUTER_*` |
| Roteamento | módulo puro `provider-routing.ts` (primeiro segmento de `*_MODEL`) | hardcoded no runtime |
| Testes | fakes/`fetchImpl` determinísticos + `STORIES_TEST_MODE=fake` | MSW |
