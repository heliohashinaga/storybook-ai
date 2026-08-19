# Research: Mobile UX Refinements

**Generated**: 2026-08-19 | **Feature**: [spec.md](spec.md)

Resolve os `NEEDS CLARIFICATION`/dependências da Phase 0. Escopo desta feature é de apresentação;
os itens abaixo esclarecem como atingir os outcomes mensuráveis da spec sem violar as regras do
projeto (tokens/primitivas, a11y `≥44px`, Storybook=app, sem JS novo no bundle).

---

## R-01 — Tamanho mínimo de toque acessível (US2 / FR-004 / SC-003)

**Decision**: Manter e **não reduzir abaixo** do mínimo acessível de alvo (~44px em altura/diâmetro)
em controles interativos. A percepção de "botão grande" no mobile é resolvida reduzindo densidade
visual (padding vertical e o `min-h` *acima* do mínimo) e dimensões do conteúdo, não o alvo em si.

**Rationale**: A spec (US2) define o alvo duplo — toque acessível **e** proporção. Reduzir o alvo quebra
a barra de a11y do princípio III. A redução deve atuar sobre `min-h` apenas quando este excede o
mínimo (ex.: botão de cenas `min-h-14`→`min-h-12`, 56→48px) e sobre `py` decorativo, preservando o
toque `≥44–48px`.

**Alternatives considered**:
- Reduzir tudo a `min-h` pequenos (ex.: 40px): rejeitado — viola a11y e o mínimo recomendado.
- Não mudar nada: não atende à queixa de "botões muito grandes".

---

## R-02 — Quebra de linha / overflow de texto no mobile (US1 / FR-001, FR-002 / SC-001, SC-002)

**Decision**: Para strings longas localizadas (descrições de tema, nome de idioma, unidade de cenas):
- garantir que os contêineres usem `min-w-0` onde necessário em grids flexíveis (evita que o
  conteúdo force a coluna para fora da tela);
- aplicar `break-words`/`leading-snug` nas descrições para quebra em palavra limpa (sem
  sobreposição);
- para nomes de idioma, permitir quebra centrada em até 2 linhas (`text-center leading-snug`) em
  telas estreitas;
- para a unidade de cenas, `whitespace-nowrap` no número+unidade para evitar separação feia.

**Rationale**: Overflow horizontal e quebra mid-word são causados por falta de `min-w-0` em
grid/overflow-wrapping e por padrões de `truncate`. São correções CSS locais, token-compatíveis,
sem carregar JS.

**Alternatives considered**:
- `overflow-hidden` cego: perde conteúdo → rejeitado (esconde sem meio de revelar, FR-001).
- JavaScript de medição por componente: desnecessário; problemas resolvíveis em CSS.

---

## R-03 — Título do reader (US3 / FR-003 / SC-004)

**Decision**: Trocar o `truncate` (ellipsis de 1 linha) do `<h1>` por clamp em até 2 linhas
(`line-clamp-2` com `min-w-0`), mantendo `font-display text-title`. Títulos longos ficam legíveis
por completo no mobile.

**Rationale**: `truncate` corta o título (queixa "texto que quebra"); `line-clamp-2` preserva o
texto com quebra controlada, atende FR-003/SC-004, e é uma classe utilitária existente (sem JS).

**Alternatives considered**:
- Manter `truncate`: não atende SC-004 (título cortado).
- Permitir quebra infinita: sujaria o cap em títulos muito longos → clamp de 2 linhas é o equilíbrio.

---

## R-04 — Densidade/proporção dos controles no mobile (US2 / FR-004)

**Decision**: Ajustar densidade de forma **responsiva** onde o desktop é tocado: usar variantes
`sm:` para restaurar tamanhos em telas maiores e valores menores apenas abaixo disso. Exemplos:
- botões de cenas: `min-h-14` → `min-h-12 sm:min-h-14`;
- cartões de tema: no mobile `p-md` e emoji `text-2xl` (desktop mantém `px-lg py-lg text-3xl`);
- OAuth: manter `min-h-12`; reduzir apenas `py-3`→`py-2` para enxugar o visual mantendo o toque;
- CTA principal: `size="md" sm:size="lg"`.

**Rationale**: variantes `sm:` preservam o layout de desktop já aprovado e limitam a mudança ao
mobile — alinhado a "sem regressão em desktop" (Technical Context) e aos baselines visuais.

**Alternatives considered**:
- Reduzir globalmente: afetaria desktop e baselines sem necessidade → rejeitado.

---

## R-05 — Validação visual / baselines (SC-005)

**Decision**: Todo ajuste visual exige: (1) atualização intencional dos baselines
(`tests/visual/`, ex.: `reader.spec.ts`) com `--update-snapshots` após build de produção; (2)
`storybook:test` sem novas violações de a11y; (3) `unit`/`lint`/`typecheck`/`format:check` verdes.

**Rationale**: A mudança é de apresentação e mexe em pixels; sem re-aprovar snapshots o CI falha.
Como a mudança é intencional, regenerar e commit é o fluxo correto (não é "diff acidental").

**Alternatives considered**: Nenhuma — regenerar é o contrato do `tests/visual`.

---

## R-06 — Sem JS novo no bundle (Princípio IV)

**Decision**: Todas as correções são via classes Tailwind/tokens e CSS. Nenhuma nova dependência nem
hook; medições de overflow que já existem (reader) permanecem como estão. Budgets de rota ficam
inalterados.

**Rationale**: mudança puramente de apresentação; adicionar utilitário/hook seria anti-padrão e
violaria o princípio de performance.

## Resumo de decisões

| Item | Decisão |
|------|---------|
| Alvo de toque | `≥44px`; reduzir apenas o que exceder o mínimo (densidade/padding) |
| Texto mobile | `min-w-0` + `break-words`/`leading-snug`; `whitespace-nowrap` na unidade |
| Título reader | `truncate` → `line-clamp-2` (com `min-w-0`) |
| Densidade controles | variantes `sm:` para preservar desktop; tamanhos menores só no mobile |
| Baselines visuais | regenerar intencionalmente + commit; storybook a11y/unit verdes |
| Bundle | sem JS novo; CSS/tokens apenas |
