# Research: Gerar mais cenas (contagem variável 3–5)

**Feature**: `002-generate-more-scenes`
**Date**: 2026-08-11

Consolida a pesquisa de **quantos "cenas/páginas" são adequados por faixa etária** e como isso se
traduz na faixa **3–5 cenas** do spec, no dimensionamento de tempo (FR-008) e na UX de percepção
de espera. Reutiliza a stack de `001`; nenhuma decisão de arquitetura é alterada.

---

## Decisão 1: Referências da indústria por faixa etária (quantas "páginas/cenas" são comuns)

**Decision**: A faixa **3–5 cenas** adotada no spec 002 é coerente com as referências de
comprimento por idade quando mapeadas ao modelo do produto (onde **1 cena ≈ 1 spread/ilustração**
de livro ilustrado, não 1 página impressa). Não subir acima de 5.

**Rationale**: os guias de mercado agrupam por faixa/prateleira (borne os ranges sobrepõem e
fontes divergem). Mapeados ao produto:

| Faixa | Formato comum (impresso) | Mapeamento 1 cenā ≈ 1 spread | Leituras típicas |
|-------|--------------------------|------------------------------|------------------|
| **2–4** | Board/young picture book, 12–24 pág., 50–500 palavras | 3–5 *spreads* (cada cena com ilustração) | 4–12 min |
| **5–7** | Early reader / picture book, 24–64 pág., 200–5.000 palavras | 3–5 *spreads* | 6–15 min |
| **8–9** | Middle grade, textos longos (4k–15k palavras em chapter books) | 3–5 *spreads* por leitura pontual | 10–15+ min |

- A contagem de "páginas" de livro ilustrado é uma **convenção de impressão** (múltiplos de 8 →
  32 pág. padrão ≈ 14–16 *spreads*); o número de **cenas narrativas** é muito menor (padrão
  "Problem → 3 tentativas → clímax → resolução", ex. 14 spreads, mas apenas ~5 beats narrativos).
- Para 2–4, a duração focada é ~2–5 min por ano de idade (4–6 min aos 2, até 12 min aos 4),
  sugerindo **leituras curtas (3 cenas)** para os menores.
- Para 5–9, a capacidade de leitura sustenta **4–5 cenas** confortavelmente dentro da janela
  diária recomendada (10–15 min; interativas > passivas).
- **Acima de 5** (6–8 cenas) esticaria demais a atenção dos menores (2–4) e o budget de geração
  (cada cena = 1 ilustração). Fica fora de escopo.

**Alternatives considered**:
- **3–7 ou permitir até 8**: exigiria timeouts maiores e desafiaria a atenção de 2–4; faixa acima
  de 5 fora de escopo do spec (assumption já registrada).
- **Contagem fixa por faixa etária** (ex. 2–4 → sempre 3): rejeitado — o spec 002 decidiu
  **escolha do responsável**, não derivação automática por idade.

---

## Decisão 2: Dimensionamento de tempo por contagem (FR-008) e comunicação da espera

**Decision**: Manter o budget end-to-end **≤120s** como teto único para todas as contagens (SC-001). O **dimensionamento específico do timeout do provider e retries por contagem é ADIADO** para a fase de implementação após medição real — o plano não antecipa valores concretos por contagem (FR-008). O orquestrador usa a **mesma regra de sucesso completa** já existente (nenhuma das N cenas pode
falhar/parcial), nunca um subset como sucesso (FR-005).

**Rationale**:
- Mais cenas = mais ilustrações + mais superfície de moderação → tempo de geração tende a crescer. O **quanto** cresce por contagem é uma suposição não medida: será aferido na implementação e, se 5 cenas aproximar o teto, o UI comunica a espera maior (percepção,
  princípio de performance/perceived performance) em vez de **falhar com timeout espúrio**.
- A geração de texto é essencialmente constante; o custo incremental está nas **ilustrações** e na
  **checagem de consistência de estilo** (todas as N devem partilhar a mesma personagem/style).
- Histórias de 5 cenas entregues dentro do teto é **SC-001**; nunca entregar parcela parcial é
  **FR-005/FR-008/SC-004**.

**Alternatives considered**:
- **Elevar o teto para >120s**: maior latência piora a perceived performance e contraria o budget;
  prefere-se dimensionar e comunicar a espera. (O teto de 120s é único para todas as contagens; a
  parametrização por contagem, se a medição real apontar a necessidade, é revisada na implementação — issue do plano, não do contrato.)
- **Limitar só a 3 cenas para 2–4**: mantém tempo curto para os menores, mas contraria a escolha
  do responsável; a faixa 3–5 já comporta "3 cenas" como a escolha curta.

---

## Decisão 3: Reader, progresso e exportação refletem a contagem real

**Decision**: Nenhum ponto do UI deve assumir "3" fixo. O leitor já itera sobre `story.scenes`
(`scenes.length`), o que naturalmente exibe "Cena X de Y" com Y real; a exportação constrói um
Página por cena na ordem — confirmar/cobrir com testes que 4–5 cenas navegam e exportam **sem
truncar** (FR-009 / SC-006).

**Rationale**:
- A navegação, o texto "Cena X de Y" e o PDF por cena são dirigidos pela array de cenas; tornar a
  faixa variável 3–5 é retrocompatível (3 cenas = comportamento de v1).
- Exige catalogar pontos/strings/testes que assumem "3" (ex. terminologia, e2e, visual) e
  generalizá-los para `total = scenes.length`.

**Alternatives considered**: correção de contagem hardcoded no leitor/PDF (rejeitado — quebraria o
modelo dinâmico existente).

---

## Decisão 4: Validação em duas camadas e retrocompatibilidade da contagem

**Decision**: `sceneCount` é um inteiro **3–5 com default 3**, validação no cliente (erro rápido
localizado) e re-validação no servidor no contrato (400/422) antes de qualquer chamada ao
provedor; requisição **sem** `sceneCount` assume **3** (comportamento de v1) — FR-003/FR-004/FR-010.

**Rationale**: mantém o contrato anônimo (apenas um valor inteiro), retrocompatível e à prova de
injeção (faixa fixa, não texto livre). Prompts do provider nunca incorporam texto de livre do
usuário.

**Alternatives considered**: permitir contagens derivadas do texto (rejeitado); faixa livre além
de 5 (rejeitado — fora de escopo).

---

## Decisão 5: Impacto em contratos e testes

**Decision**: Atualizar `contracts/story-generation.openapi.yaml` (campo `sceneCount` 3–5,
default 3, optional, na requisição `generateStory`; `minItems`/`maxItems` 3–5 na resposta;
`Cache-Control: no-store`) e os testes de contrato correspondentes. Fixtures/fakes evolvem por
contagem (3/4/5) com coverage de cenas variáveis na pipeline (nunca parcial como sucesso).

**Rationale**: alinhado à constituição (test-first, contrato é fonte de verdade, sem regressão de
anonimato). Provider falso determinístico (fixed-dev-provider) e fixture `buildSafeCandidate`
parametrizam por `sceneCount` para os três valores, com e2e pt-BR/en.
