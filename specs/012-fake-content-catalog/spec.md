# Feature Specification: Catálogo fake de histórias e ilustrações gerado pelo provider real

**Feature Branch**: `012-fake-content-catalog`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "quero melhorar as histórias e ilustrações do fake… gerar uma história de 3, 4, 5 cenas de cada tema e salvar para o fake"

## Summary

O modo fake do servidor (`STORIES_TEST_MODE=fake`, `generation-runtime.ts`) usa
`createFixedDevProvider` + `createFixedDevIllustration` (`fixed-dev-provider.ts`). Hoje ele é
determinístico e anônimo, porém **limitado em qualidade**:

- **Histórias**: todos os temas compartilham a mesma ossatura ("A estrelinha e o mar" — estrela +
  conchinha), com 5 células temáticas fixas (opener + 3 middles + closing) remontadas para 3–5
  cenas. São curtas, genéricas e não variam estruturalmente entre `sceneCount`s.
- **Ilustrações**: uma **única** imagem 64×64 WebP (`FIXED_ILLUSTRATION_DATA_URI`, estrela + lua,
  ~200 bytes) é devolvida para **toda** cena de qualquer história — sem relação com tema ou cena.

Esta feature substitui esse conteúdo por um **catálogo determinístico de alta qualidade**, capturado
**uma única vez** com o provider real (DeepSeek p/ textos + seedream p/ imagens, conforme o
`.env.example` do usuário) e **salvo como fixtures no repositório**. O usuário desativou o fake
localmente, então as chaves reais estão ativas e o pipeline real está disponível para a captura.

**Grid de captura (confirmado)**: 6 temas × 2 locais (pt-BR, en) × 3
sceneCounts (3, 4, 5) = **42 histórias** (36 do enum + 6 genéricas de fallback — fixture virtual `generic` com
ilustrações neutras), ~162 ilustrações, comprimidas com sharp
para 512×512 WebP q70 ≈ 20–50 KB/cena; ~3–6 MB no total do repo).

O runtime fake passa a resolver `(locale, theme, sceneCount)` contra o catálogo **com fallback**
para o conteúdo atual (nenhuma combinação fora do grid quebra e os testes existentes que fixam a
história antiga continuam verdes). Captura nunca persiste output reprovado pelo Moderator real
(invariante de segurança: "nada de conteúdo inseguro em UI, logs ou saídas").

## Clarifications

### Session 2026-08-16

- Q: Qual o grid de captura? → A: **36 gerações + 6 genéricas** (6 temas × 2 locais ×
  3/4/5 cenas) — confirmado na sessão; paridade pt-BR/en completa, em rodada única.
- Q: Capturamos as ilustrações também? → A: **sim** — uma WebP por cena, re-comprimida com sharp
  (512×512, q70; budget/cena 60 KB, total ≤8 MB); estimativa ~3–6 MB no repo.
- Q: Como disparar a captura sem tocar em HTTP/rate-limit? → A: script dev server-only
  (`scripts/generate-fake-content.ts`) que instancia o runtime real (`generation-runtime.ts`) com
  os providers/env reais (sem a rota `/api/stories`), itera o grid com paralelismo controlado (~3)
  e grava fixtures. O Moderator real valida cada narrativa; reprovação ⇒ geração descartada e
  registrada (nunca salva).
- Q: O env real está ativo e o custo da captura é aceito? → A: **sim** — chaves reais (DeepSeek/
  seedream) ativas localmente; rodada única de 42 gerações (36 + 6 genéricas) aprovada (~15–40 min).
- Q: Os testes/e2e/storybook que fixam o conteúdo fake atual quebram? → A: não. O lookup tem
  fallback para o builder atual; combinações fora do catálogo mantêm o comportamento de hoje.
- Q: O catálogo é seguro para o repo (privacidade)? → A: sim — conteúdo anônimo de exemplo, sem
  nomes/identificadores (invariante do projeto, verificado por teste), elegível para fixtures.
- Q: CI roda a captura? → A: não. Fixtures são commitadas; o script exige env real (nunca em CI).
- Q: Política para temas novos no catálogo? → A: **tolerante (B)** — somente o fallback mantém o
  fake funcional e honesto; captura seletiva via `--themes` é opcional (nenhum teste de cobertura
  do enum bloqueia adicionar tema).
- Q: O fallback neutro é escrito ou capturado? → A: **capturado** — fixture virtual `generic`
  (pt-BR/en × 3/4/5 cenas, ilustrações neutras) parte da mesma rodada; loader: tema fora do
  catálogo → `generic` → (se ausente/corrompida) builder genérico manual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Histórias reais, variadas e determinísticas (Priority: P1)

O desenvolvedor que roda `STORIES_TEST_MODE=fake` + `pnpm dev` (ou e2e/visual) recebe, para cada
combinação `(tema, locale, sceneCount)`, uma história do catálogo real: estrutura variada por
tema, 3–5 cenas conforme pedido, texto localizado e rico — sempre **a mesma** saída para a mesma
entrada (determinismo em disco).

**Why this priority**: É o propósito central — o fake deixa de ser "cartão de visita" e passa a
refletir a qualidade do produto real para desenvolvimento, Storybook e testes visuais.

**Independent Test**: Teste unit que carrega as fixtures e verifica, para cada combinação do grid:
`story.scenes.length === sceneCount`, temas distintos geram histórias com títulos/corpos distintos
(fuzzy de igualdade estrutural), locale pt-BR ≠ en, e que duas leituras da mesma fixture retornam
exatamente o mesmo objeto.

**Acceptance Scenarios**:

1. **Given** o catálogo gerado, **When** o provider fake recebe `(courage, pt-BR, 3)`, **Then**
   retorna a história `courage-pt-BR-3` com 3 cenas e título temático (não "A estrelinha e o mar").
2. **Given** o mesmo input, **When** o provider é chamado duas vezes, **Then** as saídas são
   idênticas (referência de igualdade).
3. **Given** `(empathy, en, 5)`, **When** o provider resolve, **Then** retorna 5 cenas em inglês
   com estrutura/ilustrações próprias do catálogo.

---

### User Story 2 - Ilustração por cena, coerente com a narrativa (Priority: P1)

Cada cena recebe a **sua** ilustração (WebP comprimida) capturada com o provider real — não mais a
imagem única 64×64 repetida. A ilustração do cenário (prompt da cena) guarda coerência temática e
o tamanho agregado respeita o orçamento do repo.

**Why this priority**: Ilustração é metade do valor percebido do fake; hoje é o ponto mais fraco
(uma imagem para todas as cenas).

**Independent Test**: Teste que abre cada fixture e verifica: `illustrations.length === scenes.length`,
cada `dataUri` é `data:image/webp;base64,…` válido (< sup orçamento/cena configurável, default
60 KB) e `illustrations[i]` corresponde à cena `i` (não repetida exceto quando a captura real
produziu repetição deliberada).

**Acceptance Scenarios**:

1. **Given** uma história de 5 cenas, **When** o fake ilustra, **Then** retorna 5 data-URIs WebP
   distintos entre si e coerentes com os prompts das cenas.
2. **Given** o catálogo completo, **When** medimos o diretório de fixtures, **Then** o peso total é
   ≤ orçamento definido no plan (default 8 MB) e nenhum arquivo excede o budget por cena.
3. **Given** uma combinação sem ilustração capturada, **When** o fake resolve, **Then** usa o
   fallback `FIXED_ILLUSTRATION_DATA_URI` (sem quebrar).

---

### User Story 3 - Fallback, determinismo e zero regressão (Priority: P2)

Combinações fora do catálogo, fixtures ausentes/corrompidas e ambientes sem o grid novo mantêm o
comportamento atual do fake: os testes existentes (e2e, visuais, unit de progresso/conteúdo) e o
Storybook não regridem.

**Why this priority**: Garante que a troca de conteúdo fake não vira breaking change para a suíte
numa área (fake mode) onde determinismo é requisito.

**Independent Test**: Suíte existente completa (650 testes) + caso novo: `createFixedDevProvider`
com `(theme: "fantasy-invented", sceneCount: 5)` fora do grid cai no **conteúdo neutro** (sem texto
de outro tema); fixture com JSON/WebP inválido cai no fallback sem throw.

**Acceptance Scenarios**:

1. **Given** tema fora do catálogo, **When** o provider resolve, **Then** retorna o conteúdo
   **neutro** (nenhum throw, nenhum texto de outro tema).
2. **Given** fixture corrompida (ex.: WebP truncada), **When** a resolução ocorre, **Then** usa o
   fallback e registra aviso (nunca crasha o request).
3. **Given** a suíte completa, **When** roda após a integração, **Then** 650+ testes passam com
   o mesmo cobertura mínima (≥80% total).

---

### User Story 4 - Re-captura reutilizável e documentada (Priority: P2)

O script de captura é parametrizável (subset de temas/locales/counts, `--dry-run`, `--limit`) e
documentado no spec/quickstart, permitindo rodadas futuras (novos temas, locale novo, refresh
após mudança de modelo) sem reescrever ferramenta.

**Why this priority**: A captura custa API e tempo; tornar o script reutilizável preserva o
investimento e permite evoluir o catálogo.

**Independent Test**: `node --run` do script em `--dry-run` (sem chamar provider) imprime o plano
de geração (combinações, estimativa de peso) e sai limpo; `--limit 1 —locales pt-BR` gera só a
combinação pedida.

**Acceptance Scenarios**:

1. **Given** `--dry-run`, **When** o script roda sem env de provider, **Then** imprime grid +
  orçamento e não chama rede.
2. **Given** `--limit 1 --locales pt-BR`, **When** roda com env real, **Then** grava apenas
  `*-pt-BR-*.json` da combinação selecionada.

### Edge Cases

- **Combinação fora do grid / tema novo**: fallback **neutro de qualidade** — fixture virtual
  `generic` (história completa + ilustrações neutras); se ausente/corrompida, builder genérico
  manual. Política tolerante: um tema novo nunca exibe conteúdo de outro tema.
- **Fixture ausente/corrompida**: fallback + `console.warn` (server-only), nunca crash.
- **Safety reject na captura**: a geração é **descartada** (nada é gravado) e contabilizada; se o
  reject for recorrente para uma combinação, o script falha com resumo claro (não grava lixo).
- **Anonimato**: teste varre as fixtures em busca de nomes próprios/padrões de identificador
  (mesmo detector usado nos fakes atuais — template markers, "unsafecontent").
- **Peso**: budget por cena (default 60 KB) e orçamento total (default 8 MB) auditados no script e
  no teste — falha explícita se estourar.
- **NODE_ENV=test**: nenhum delay e catálogo lido de disco (fixtures commitadas) — sem rede.
- **Playwright (e2e/visual/perf) via `next start`**: `playwright.config.ts` zera o delay fake
  (`STORY_FAKE_STEP_DELAY_MS=0`), pois essas suítes rodam server production onde o delay de dev
  não tem valor — mantém as suítes determinísticas e rápidas (teste multi-story de 4 gerações,
  orçamento de perf). O progress UI continua exercitado por testes com `page.route()` deferido
  (`frontend-routing.spec`), não pelo delay de parede. `pnpm dev` preserva o default 1000 ms
  (UX-012).
- **pt-BR vs en**: ambos os catálogos precisam existir e conter as mesmas combinações → só o
  conteúdo difere (check de paridade no teste).
- **Windows/CRLF ou leitura de mídia**: fixtures lidas com `fs` puro (sem path magic); JSON com
  encoding UTF-8.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE prover `scripts/generate-fake-content.ts` (server-only, run dev) que
  itera o grid default (6×2×3), chama o **runtime real** (planner/writer/moderator/illustrator
  com os `*_MODEL` do env, sem a rota HTTP), valida cada narrativa via Moderator real e grava as
  fixtures; flags `--dry-run`, `--limit`, `--locales`, `--themes`, `--counts`.
- **FR-002**: As fixtures DEVEM ficar em `tests/fixtures/story-generation/fake-content/` no formato
  `{theme}-{locale}-{sceneCount}.json`, shape:
  `{ theme, locale, sceneCount, story: { title, scenes: [{ ordinal, title, body, illustrationPrompt }] }, illustrations: [dataUri], meta: { model, capturedAt, sha256? } }`.
- **FR-003**: Ilustrações DEVEM ser re-comprimidas com sharp para 512×512 WebP q70 antes de gravar
  (budget/cena default 60 KB; orçamento total default 8 MB — configuráveis via env/flags).
- **FR-004**: `createFixedDevProvider` DEVE resolver `(locale, theme, sceneCount)` no catálogo e,
  para combinações ausentes/temas fora, usar a fixture virtual `generic` (história + ilustrações
  neutras); se `generic` ausente/corrompida, cair no builder genérico manual (substituindo o atual
  `?? THEME_PT.courage`, que mascara tema desconhecido como coragem).
- **FR-005**: `createFixedDevIllustration` DEVE retornar a ilustração da cena `i` para
  `(locale, theme, sceneCount, i)` do catálogo; fallback em cadeia: ilustração da fixture
  `generic` → builder genérico → `FIXED_ILLUSTRATION_DATA_URI`.
- **FR-006**: O catálogo DEVE ser determinístico (fixtures commitadas; leitura pura de disco;
  nenhum sorteio/relógio no caminho do fake).
- **FR-007**: Antes de gravar, o script DEVE conferir o anonimato (sem nomes/identificadores/
  template markers) e rejeitar a gravação se violado (mesma regra dos fakes atuais).
- **FR-008**: A captura NUNCA DEVE rodar em CI (falha explícita se `process.env.CI` presente) nem
  persistir output reprovado pelo Moderator (US2 do spec 006: regenera 1× e descarta).
- **FR-009**: Testes novos DEVEM cobrir: variedade/variância por tema, paridade pt-BR/en e counts,
  anonimato, fallback (fora do grid + fixture corrompida), budget de mídia e determinismo — sem
  perder os gates existentes (≥80% total; ≥90% safety/validation/orchestration intactos).

### Key Entities

- **Catálogo fake** (`tests/fixtures/story-generation/fake-content/*.json`): fonte de verdade do
  conteúdo no modo fake; resolvido por chave `(locale, theme, sceneCount)`.
- **`createFixedDevProvider` / `createFixedDevIllustration`**: pontos de integração — agora com
  lookup no catálogo + fallback (contrato de saída inalterado: `{ title, scenes: [...] }` e
  `{ dataUri }`).
- **`scripts/generate-fake-content.ts`**: ferramenta única de captura (dev, server-only),
  parametrizável; grava e audita o catálogo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Catálogo com 42 combinações (36 do enum + 6 `generic`) — cada uma com
  `scenes.length === sceneCount` e `illustrations.length === scenes.length`; `pnpm dev` em modo
  fake exibe histórias/ilustrações visivelmente distintas entre temas e counts.
- **SC-002**: Peso total ≤ 8 MB e nenhuma WebP > 60 KB (defaults), verificáveis por teste.
- **SC-003**: Suíte completa verde após a integração (650+ testes, incl. fallback testado);
  Storybook/e2e sem mudança de comportamento para combinações fora do grid.
- **SC-004**: Nenhuma mudança em rotas HTTP, contrato OpenAPI, payloads, privacidade, timing real
  de geração ou nos estados especiais de progresso; gates (`lint`/`format:check`/`typecheck`/
  `test`/`build`) re-rodados após a última edição; `plan.md`/`tasks.md` atualizados.

## Assumptions

- As chaves reais dos providers (DeepSeek/seedream via `.env.local`) estão ativas localmente —
  o usuário desativou `STORIES_TEST_MODE=fake`, então o runtime real é o caminho disponível
  (confirmado na sessão de clarificação).
- O usuário aceita o custo único de API e o tempo (~15–40 min com paralelismo ~3) de uma rodada
  de captura; esta feature assume **uma** rodada única com o grid 36 + 6 genéricas e prevê re-captura futura.
- O conteúdo capturado é anônimo por construção (sem nomes — invariante) e vira fixture do repo
  (não é dado de usuário; não há restrição legal além do disclaimer do README).
- Política de novos temas: **tolerante (B)** — fallback neutro mantém o fake funcional e honesto;
  a captura seletiva (`--themes`) é a forma de elevar a qualidade quando desejado (nenhum teste de
  cobertura do enum bloqueia adicionar tema); temas fora do catálogo resolvem para a fixture
  `generic` (builder genérico manual como última rede).
- O fallback garante compatibilidade total com a suíte atual; o catálogo é aditivo (nenhum teste
  existente é reescrito para o conteúdo novo, exceto os que explicitamente validam variedade).
- O shape de saída do pipeline real é compatível com o contrato do fake atual (verificado durante
  `--dry-run` antes da captura).