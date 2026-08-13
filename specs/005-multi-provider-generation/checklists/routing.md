# Checklist — Requisitos de Roteamento por Provedor (Spec 005)

Unidade de teste para a **qualidade dos requisitos de roteamento** — valida se os requisitos de roteamento multi-provedor estão completos, claros, consistentes e mensuráveis. Não verifica implementação.

**Criado**: 2026-08-13
**Foco**: Roteamento por capacidade (OpenCode `opencode-go` / OpenRouter), convenção `provedor/resto`, env por capacidade, ausência de `defaultProvider`, semântica de erro, anonimato no roteamento.

---

## Requisitos de Roteamento (Completeness)

- [x] CHK001 São definidos requisitos que cobrem o roteamento de cada capacidade (texto, moderação, imagem) para um provedor de fio? [Completeness, Spec §FR-001, §FR-002]
- [x] CHK002 Os requisitos definem os ids canônicos dos dois provedores (`opencode-go` e `openrouter`) e deixam explícito que **qualquer capacidade pode ser servida por qualquer um deles**, conforme o prefixo do respectivo `*_MODEL` (sem vínculo fixo capacidade→provedor)? [Completeness, Spec §FR-001, §FR-002, Premissas §D3]
- [x] CHK003 O spec cobre o roteamento do TTS/voice (feature `004-ai-natural-tts`, assumido OpenRouter) como **fora de escopo**, sem ambiguidade? [Completeness, Out-of-Scope]
- [x] CHK004 Está documentado que a capacidade `speech` (se existir) é roteada separadamente e não faz parte desta feature? [Completeness, Gap]
- [x] CHK005 Os requisitos especificam o que acontece com cada `*_MODEL`, incluindo `MODERATION_MODEL`, na rota por capacidade? [Completeness, Spec §FR-002]

## Convenção de Roteamento (Clarity)

- [x] CHK006 A convenção `provedor/resto` (primeiro segmento antes da 1ª `/` = provedor) está inequívoca e documentada? [Clarity, Spec §FR-002]
- [x] CHK007 O spec define claramente que **não existe `defaultProvider`** — o provedor é derivado exclusivamente do prefixo do valor do modelo? [Clarity, Spec §FR-002, Premissas §D2]
- [x] CHK008 Está explícito que um `*_MODEL` **sem prefixo** de provedor é erro de configuração no boot (nunca silencioso)? [Clarity, Edge Case, Spec §FR-002]
- [x] CHK009 O identificador canônico do provedor (`opencode-go` vs `opencode`) é consistente em todos os requisitos e no modelo de dados? [Clarity, Consistency, Spec §FR-002, data-model]
- [x] CHK010 A regra de mapeamento prefixo→provedor (ex.: `opencode-go/qwen/qwen3.7-flash` → `opencode-go`; `openrouter/...` → `openrouter`) está especificada com exemplos concretos? [Clarity, Spec §FR-002, data-model]
- [x] CHK011 O spec define como o modelo efetivamente usado é derivado (removendo o prefixo de provedor do valor do modelo)? [Clarity, data-model `RoutedConfig.model`]
- [x] CHK012 Os requisitos distinguem "prefixo desconhecido" (erro de config) de "serviço indisponível" (falha de provider), sem confundi-los? [Clarity, Spec §FR-002, FR-005]

## Env por Capacidade (Consistency & Completeness)

- [x] CHK013 Os requisitos de env listam as chaves e modelos por capacidade de forma completa (`OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `MODERATION_MODEL`)? [Completeness, Spec §FR-002]
- [x] CHK014 O spec especifica a **remoção do esquema legado** `OPENROUTER_*` (decisão D5-C), sem fallback? [Consistency, Spec §FR-008, Premissas §D5]
- [x] CHK015 Há requisitos para validar o env no boot (Zod) que rejeitem config inválida de roteamento (prefixo ausente/desconhecido) de forma tipada e não silenciosa? [Completeness, Spec §FR-003]
- [x] CHK016 Os requisitos especificam o comportamento de `STORIES_TEST_MODE=fake` em relação ao roteamento (sem chamadas reais a provedores)? [Consistency, Spec §FR-006]
- [x] CHK017 O mapeamento `apiKeyEnv` é derivado do **prefixo** do provedor do `*_MODEL` (prefixo `openrouter`→`OPENROUTER_API_KEY`; `opencode-go`→`OPENCODE_GO_API_KEY`), não da capacidade — está especificado assim? [Completeness, data-model `RoutedConfig.apiKeyEnv`, plan]

## Semântica de Erro (Scenario/Exception Coverage)

- [x] CHK018 Os requisitos definem como o roteamento trata um provider que falha durante uma capacidade (sem história parcial)? [Coverage, Spec §FR-005, SC-006]
- [x] CHK019 Está definido que uma falha de capacidade retorna erro tipado/`ProviderError` com mapeamento de erro adequado, nunca um conjunto parcial de ilustrações? [Coverage, Exception Flow, Spec §FR-005]
- [x] CHK020 Os requisitos cobrem a falha de **cada** provedor individualmente (OpenCode vs OpenRouter) e o impacto da capacidade específica afetada? [Coverage, Edge Case, Spec §FR-005]
- [x] CHK021 O spec especifica o comportamento de fallback/recovery após a falha de um provedor (regeneração com constraints, erro genérico seguro)? [Coverage, Recovery, Spec §FR-005]
- [x] CHK022 Os requisitos definem o que acontece quando a `IMAGE_MODEL` falha mas texto/moderação têm sucesso (e vice-versa)? [Coverage, Exception Flow, Spec §FR-005]
- [x] CHK023 O spec especifica o tratamento de rate limiting das chamadas do usuário do app (bucket por IP + hash/salt rotativo, IP não retido em claro; default 10 req/60 s para geração e `TTS_RATE_LIMIT_*` para narração) como requisito, com parâmetros mensuráveis? [Completeness, plan Constraints, Gap]

## Anonimato e Privacidade no Roteamento (Non-Functional)

- [x] CHK024 Os requisitos garantem que cada provedor recebe **apenas** o payload da sua própria capacidade (sem vazamento entre texto/imagem/moderação)? [Non-Functional, Privacy, Spec §FR-004]
- [x] CHK025 Está especificado que chaves/credenciais (`OPENROUTER_API_KEY`, `OPENCODE_GO_API_KEY`) nunca são logadas ou expostas? [Non-Functional, Security, Spec §FR-004]
- [x] CHK026 Os requisitos de anonimato são consistentes entre FR-004, SC-003 e as User Stories (nenhum identificador direto em nenhum provedor)? [Consistency, Spec §FR-004, SC-003]
- [x] CHK027 Está definido que os módulos de roteamento/provedor são `server-only`, sem exposição ao cliente? [Non-Functional, Security, Spec §FR-004]

## Performance e Operacional (Non-Functional)

- [x] CHK028 Os requisitos especificam orçamentos de performance mensuráveis para a geração dual (ex.: ≤120 s E2E, ≤250 KiB JS)? [Measurability, Spec §SC-005]
- [x] CHK029 O spec define se o roteamento acrescenta overhead observável (latência extra) e como é mensurado? [Non-Functional, Measurability, Gap]
- [x] CHK030 Há requisitos de observabilidade/registro de diagnóstico do roteamento que **não** violem o anonimato? [Non-Functional, Coverage, Gap]

## Consistência entre Artefatos (Consistency & Traceability)

- [x] CHK031 As regras de roteamento são consistentes entre `spec.md` (§FR-002), `data-model.md` (Capability/RoutedConfig) e `tasks.md` (T004/T007)? [Consistency]
- [x] CHK032 O contrato `provider-routing.openapi.yaml` está alinhado com as regras de roteamento do spec (prefixo conhecido/desconhecido)? [Consistency, Contract]
- [x] CHK033 Não há terminologia divergente (ex.: `opencode` vs `opencode-go`; `ProviderRoutingResult` vs `RoutedConfig`) entre os artefatos? [Consistency, Traceability]
- [x] CHK034 Os requisitos de roteamento mapeiam para tarefas de implementação/verificação (cobertura de FR-001/FR-002 → T004/T007/T012) e testes de aceitação? [Traceability]
- [x] CHK035 Os critérios de aceitação de roteamento (User Stories/aceitação) são mensuráveis e testáveis com fakes determinísticos? [Acceptance Criteria, Measurability]
- [x] CHK036 Os requisitos especificam o adapter de ilustração **por provedor** (imagem via `createOpenRouterIllustration` quando `IMAGE_MODEL=openrouter/...`; via `createOpenCodeIllustration` quando `opencode-go/...`), com mesmo contrato `IllustrationGenerator`? [Completeness, Coverage, data-model]

---

> **Nota de rastreabilidade**: ≥80% dos itens incluem referência de section (`[Spec §X]`) ou marcador de gap (`[Gap]`/`[Coverage]`). Itens marcados como `[Gap]` referem-se a requisitos ainda não explicitado no spec.
